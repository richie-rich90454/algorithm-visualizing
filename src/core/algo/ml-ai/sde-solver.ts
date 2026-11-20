/**
 * sde-solver.ts - Euler-Maruyama Reverse SDE Solver
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A reverse-time stochastic differential equation describes diffusion sampling
 * with both a deterministic drift and a stochastic diffusion term. The
 * Euler-Maruyama method advances the sample by the drift times the step size
 * plus a diffusion term scaled by the square root of the step size and a fresh
 * standard normal draw. This module replays the exact update on a small vector
 * using an Ornstein-Uhlenbeck drift, with a seeded generator for the noise.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d) for d coordinates
 *   Space: O(steps * d) for the stored trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the sample vector after each reverse step.
 *   - The final frame marks the denoised output.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SdeInput {
    initial?: number[];
    theta?: number;
    diffusion?: number;
    dt?: number;
    steps?: number;
    seed?: number;
}

/** Generate standard normal draws with a seeded Box-Muller transform. */
export function standardNormals(count: number, seed: number): number[] {
    let state = seed >>> 0;
    const uniform = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
    const out: number[] = [];
    for (let i = 0; i < count; i += 1) {
        const u1 = Math.max(uniform(), 1e-12);
        const u2 = uniform();
        out.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
    }
    return out;
}

/** Integrate the reverse SDE with Euler-Maruyama and return every intermediate state. */
export function eulerMaruyama(
    initial: number[],
    theta: number,
    diffusion: number,
    dt: number,
    steps: number,
    seed: number,
): number[][] {
    const d = initial.length;
    const noise = standardNormals(steps * d, seed);
    let x = initial.slice();
    const trajectory: number[][] = [x.slice()];
    const sqrtDt = Math.sqrt(dt);
    for (let k = 0; k < steps; k += 1) {
        x = x.map((value, i) => {
            const drift = -theta * value;
            const z = noise[k * d + i] ?? 0;
            return value + drift * dt + diffusion * sqrtDt * z;
        });
        trajectory.push(x.slice());
    }
    return trajectory;
}

function bars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `dim-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SdeInput | null) ?? {};
    const initial: number[] = (task.initial ?? [2, -1.5, 1]).slice();
    const theta = task.theta ?? 1;
    const diffusion = task.diffusion ?? 0.4;
    const dt = task.dt ?? 0.1;
    const steps = Math.max(1, Math.floor(task.steps ?? 6));
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const trajectory = eulerMaruyama(initial, theta, diffusion, dt, steps, seed);
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(initial, "idle"),
        edges: [],
        description: `Start a reverse SDE from a ${initial.length}-coordinate noisy sample.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "start", theta, diffusion, dt, steps, seed, sample: initial },
    };
    step += 1;

    for (let k = 0; k < steps; k += 1) {
        const sample = trajectory[k + 1] ?? [];
        yield {
            stepNumber: step,
            entities: bars(sample, "comparing"),
            edges: [],
            description: `Step ${k + 1}: apply drift and a seeded diffusion kick.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { phase: "step", iteration: k + 1, sample, theta, diffusion, dt },
        };
        step += 1;
    }

    const final = trajectory[steps] ?? [];
    yield {
        stepNumber: step,
        entities: bars(final, "sorted"),
        edges: [],
        description: `Done: ${steps} Euler-Maruyama step(s) produced the final sample of dimension ${final.length}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "done", steps, sample: final, trajectory },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Diffusion models reverse a noising process. In continuous time that reversal is a stochastic differential equation with a drift that pulls toward cleaner data and a diffusion term that keeps a little randomness. Euler-Maruyama is the direct numerical scheme: take a small drift step, then add scaled Gaussian noise. Fewer, larger steps are cheaper but less accurate.",
        invariants: [
            "Each step adds noise scaled by the square root of the step size.",
            "A fixed seed reproduces the entire noise sequence and trajectory.",
            "With zero diffusion the scheme reduces to deterministic Euler integration.",
        ],
        correctness:
            "The generator draws one standard normal per coordinate per step using Box-Muller, so the noise sequence is fixed by the seed. The Euler-Maruyama update is exactly the current value plus the drift times dt plus diffusion times the square root of dt times that normal. Setting diffusion to zero removes the stochastic term, leaving the explicit Euler method for the ordinary differential equation, whose iterates match the closed-form decay of the Ornstein-Uhlenbeck drift in the limit of small dt.",
        complexityRationale:
            "Each of the steps updates d coordinates with constant work, so time is O(steps * d). Storing the full trajectory for playback uses O(steps * d) space.",
        uses: [
            "Sampling from continuous-time diffusion and score-based models",
            "Numerical integration of stochastic processes in finance and physics",
            "Teaching the link between SDEs and diffusion samplers",
        ],
        references: [
            "Kloeden and Platen, Numerical Solution of Stochastic Differential Equations, 1992",
            "Song et al., Score-Based Generative Modeling through SDEs, ICLR 2021",
        ],
        workedExample:
            "With one coordinate starting at 2, theta 1, diffusion 0, dt 0.1 and one step, the drift is negative 2 and the update is 2 plus negative 2 times 0.1, which is 1.8. Repeating multiplies the value by 0.9 each step, matching the Euler approximation of exponential decay toward zero.",
    },
    id: "sde-solver",
    name: "Euler-Maruyama SDE Solver",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(steps * d)" },
    defaultInput: { initial: [2, -1.5, 1], theta: 1, diffusion: 0.4, dt: 0.1, steps: 6, seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "read the initial sample, drift, diffusion, step size and seed",
        "generate a seeded standard normal per coordinate per step",
        "for each step compute the drift at the current sample",
        "add drift times step size plus diffusion times square-root step size times noise",
        "store the updated sample in the trajectory",
        "done: report the final sampled vector",
    ],
};

export default module;
