/**
 * diffusion-policy.ts - Diffusion Policy Action Denoising Core
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Diffusion Policy generates robot actions by denoising a whole action
 * sequence at once, conditioned on the current observation. This module runs
 * the teachable core: a variance schedule, the forward corruption of a clean
 * action sequence, and a deterministic reverse chain that estimates the added
 * noise from the observation-conditioned mean, predicts the clean sequence at
 * every step, and reconstructs it. Only the first few predicted actions are
 * executed (a receding horizon) before the policy would be queried again.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * H * d) for T reverse steps, horizon H, action dimension d
 *   Space: O(H * d) for the action sequence and the schedule
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Action values are bars; the conditioned clean sequence is GREEN.
 *   - Each reverse step shows the current noisy action estimate.
 *   - The final frame reports the recovery error and the executed actions.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    observation?: number[];
    clean?: number[];
    horizon?: number;
    actionDim?: number;
    steps?: number;
    executeSteps?: number;
    noise?: number[];
}

function padOrTruncate(values: number[], length: number, fallback: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < length; i += 1) {
        out.push(values[i] ?? fallback);
    }
    return out;
}

function deterministicNoise(length: number): number[] {
    let seed = 1234567;
    const out: number[] = [];
    for (let i = 0; i < length; i += 1) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        out.push((seed / 0x7fffffff) * 2 - 1);
    }
    return out;
}

/** Cumulative product of the per-step signal rates, indexed 0..steps. */
function alphaBars(steps: number): number[] {
    const bars = [1];
    let running = 1;
    for (let t = 1; t <= steps; t += 1) {
        const beta = 0.01 + (0.2 * t) / steps;
        running *= 1 - beta;
        bars.push(running);
    }
    return bars;
}

function bars(
    values: number[],
    prefix: string,
    state: EntityState,
): VisualEntity[] {
    return values.map((value, index) => ({
        id: `${prefix}-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, actionIndex: Math.floor(index), value },
    }));
}

function maxAbsDifference(left: number[], right: number[]): number {
    let worst = 0;
    for (let i = 0; i < left.length; i += 1) {
        worst = Math.max(worst, Math.abs((left[i] ?? 0) - (right[i] ?? 0)));
    }
    return worst;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const horizon = Math.max(1, Math.min(16, Math.floor(task.horizon ?? 4)));
    const actionDim = Math.max(1, Math.min(8, Math.floor(task.actionDim ?? 1)));
    const steps = Math.max(1, Math.min(32, Math.floor(task.steps ?? 8)));
    const executeSteps = Math.max(0, Math.min(horizon, Math.floor(task.executeSteps ?? 2)));
    const total = horizon * actionDim;
    const observation = Array.isArray(task.observation) && task.observation.length > 0
        ? task.observation
        : [1, -0.5];
    const clean = Array.isArray(task.clean)
        ? padOrTruncate(task.clean, total, 0)
        : padOrTruncate(observation, total, 0);
    const noise = Array.isArray(task.noise)
        ? padOrTruncate(task.noise, total, 0)
        : deterministicNoise(total);
    const schedule = alphaBars(steps);

    yield {
        stepNumber: 0,
        entities: bars(clean, "clean", "sorted"),
        edges: [],
        description: `Conditioned clean action sequence of length ${total} from a ${observation.length}-value observation.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            phase: "condition",
            observation,
            horizon,
            actionDim,
            steps,
            schedule: schedule.map((value) => Number(value.toFixed(6))),
        },
    };

    let current = clean.map((value, i) =>
        Math.sqrt(schedule[steps] ?? 0) * value + Math.sqrt(1 - (schedule[steps] ?? 0)) * (noise[i] ?? 0),
    );
    let worstNoiseError = 0;

    for (let t = steps; t >= 1; t -= 1) {
        const alphaBar = schedule[t] ?? 1;
        const sqrtBar = Math.sqrt(alphaBar);
        const sqrtOneMinusBar = Math.sqrt(Math.max(0, 1 - alphaBar));
        const epsPred = current.map(
            (value, i) => (value - sqrtBar * (clean[i] ?? 0)) / Math.max(sqrtOneMinusBar, 1e-12),
        );
        worstNoiseError = Math.max(worstNoiseError, maxAbsDifference(epsPred, noise));

        const x0Pred = current.map(
            (value, i) => (value - sqrtOneMinusBar * (epsPred[i] ?? 0)) / Math.max(sqrtBar, 1e-12),
        );
        const prevBar = schedule[t - 1] ?? 1;
        const sqrtPrev = Math.sqrt(prevBar);
        const sqrtOneMinusPrev = Math.sqrt(Math.max(0, 1 - prevBar));
        current = x0Pred.map(
            (value, i) => sqrtPrev * value + sqrtOneMinusPrev * (epsPred[i] ?? 0),
        );

        yield {
            stepNumber: steps - t + 1,
            entities: bars(current, `step-${t}`, "active"),
            edges: [],
            description: `Reverse step ${t}: estimated noise and predicted the clean action sequence.`,
            codeLineNumber: t === 1 ? 6 : 5,
            layout: "array",
            meta: {
                phase: "denoise",
                t,
                alphaBar,
                noiseEstimateError: maxAbsDifference(epsPred, noise),
                cleanEstimateError: maxAbsDifference(x0Pred, clean),
            },
        };
    }

    const recoveryError = maxAbsDifference(current, clean);
    const executed = current.slice(0, executeSteps * actionDim);
    yield {
        stepNumber: steps + 1,
        entities: bars(current, "recovered", "sorted"),
        edges: [],
        description: `Recovered the action sequence with error ${recoveryError.toExponential(2)}; executing ${executed.length} action value(s).`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            phase: "result",
            recovered: current,
            clean,
            recoveryError,
            worstNoiseError,
            executed,
            executedLength: executed.length,
            executeSteps,
            horizon,
            actionDim,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of producing one action at a time, diffuse an entire short action sequence at once. Start with random noise, then repeatedly ask a conditioned denoiser which part of the signal is noise, subtract it, and predict a cleaner sequence. After the last step, send only the first few actions to the robot and repeat the whole process with a fresh observation.",
        invariants: [
            "The variance schedule is fixed and decreasing across reverse steps.",
            "The noise estimate is computed relative to the observation-conditioned clean mean.",
            "Each reverse step reconstructs a clean prediction before re-noising to the previous level.",
            "The number of executed action values is the receding horizon times the action dimension.",
        ],
        correctness:
            "Write the noised sequence as sqrt(alphaBar_t) times the clean mean plus sqrt(1 minus alphaBar_t) times the noise. Because the denoiser is conditioned on that same clean mean, dividing the difference by sqrt(1 minus alphaBar_t) recovers the added noise exactly. Plugging it into the clean-sequence prediction therefore returns the original mean at every step, and the final deterministic reverse state equals the conditioned clean action sequence up to floating-point error.",
        complexityRationale:
            "Each of the T reverse steps scans all H times d action values to estimate noise, predict the clean sequence, and re-noise, giving O(T * H * d) time; storing the sequence and the schedule uses O(H * d) space.",
        uses: [
            "Visuomotor robot control from images or state observations",
            "Multi-step action sequence generation with receding-horizon execution",
            "Conditional generation where outputs are continuous control vectors",
        ],
        references: [
            "Chi et al., Diffusion Policy: Visuomotor Policy Learning via Action Diffusion, RSS 2023",
            "Ho, Jain, and Abbeel, Denoising Diffusion Probabilistic Models, NeurIPS 2020",
        ],
        workedExample:
            "With a four-step action sequence conditioned on an observation, eight reverse steps, and a receding horizon of two, the chain starts from a corrupted sequence and removes the predicted noise until it recovers the clean actions; the controller executes only the first two actions before generating a new plan.",
    },
    id: "diffusion-policy",
    name: "Diffusion Policy",
    category: "ml-ai",
    complexity: { time: "O(T * H * d)", space: "O(H * d)" },
    defaultInput: {
        observation: [0.8, -0.4],
        clean: [1.2, 0.6, -0.3, 0.9],
        horizon: 4,
        actionDim: 1,
        steps: 8,
        executeSteps: 2,
        noise: [0.25, -0.5, 0.75, -0.25],
    },
    visualType: "array",
    run,
    pseudocode: [
        "schedule the variance across the reverse steps",
        "corrupt the clean action sequence with Gaussian noise",
        "condition the noise prediction on the observation",
        "start from the fully noised action sequence",
        "for each reverse step estimate the added noise",
        "predict the clean sequence and re-noise to the prior level",
        "repeat down to zero noise to recover the actions",
        "execute only the first few actions, then replan",
    ],
};

export default module;
