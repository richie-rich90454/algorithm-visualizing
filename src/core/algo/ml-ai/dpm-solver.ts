/**
 * dpm-solver.ts - DPM-Solver First-Order Exponential Update
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DPM-Solver solves the diffusion probability-flow ODE with an exact integrating
 * factor instead of a plain Euler step. For the variance-exploding process in
 * the noise scale sigma, the ODE is dx/dsigma = (x - D) / sigma, where D is the
 * denoised estimate. Assuming D is constant over a step gives the exact update
 * x_next = D + (x - D) * sigma_next / sigma. Repeating this across a decreasing
 * noise schedule walks the sample toward the data distribution in far fewer
 * steps than Euler, and for a constant denoiser it is exact at every step.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k noise levels in the schedule
 *   Space: O(k) for the sampled trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the sample value at each successively smaller noise level.
 *   - The last frame is green once the sample reaches the denoised value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    sigmas?: number[];
    startValue?: number;
    denoised?: number;
}

function makeBars(values: number[], current: number): VisualEntity[] {
    return values.map((value, i) => {
        let state: EntityState = "idle";
        if (i === current) {
            state = "active";
        } else if (i < current) {
            state = "visited";
        }
        return {
            id: `bar-${i}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: i,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, step: i, value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const sigmas = (task.sigmas ?? [8, 4, 2, 1, 0.5, 0.1]).slice();
    const startValue = typeof task.startValue === "number" ? task.startValue : 3;
    const denoised = typeof task.denoised === "number" ? task.denoised : 0;
    const trajectory: number[] = [startValue];
    let x = startValue;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(trajectory, 0),
        edges: [],
        description: `Start from x = ${startValue} at noise level sigma = ${sigmas[0]}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: 1, cols: sigmas.length, sigmas, levels: sigmas.length, denoised, currentSigma: sigmas[0] ?? 0 },
    };
    step += 1;

    for (let i = 0; i < sigmas.length - 1; i += 1) {
        const sigma = sigmas[i] ?? 1;
        const nextSigma = sigmas[i + 1] ?? sigma;
        const ratio = sigma !== 0 ? nextSigma / sigma : 0;
        x = denoised + (x - denoised) * ratio;
        trajectory.push(Number(x.toFixed(8)));
        yield {
            stepNumber: step,
            entities: makeBars(trajectory, i + 1),
            edges: [],
            description: `Step ${i + 1}: sigma ${sigma} to ${nextSigma}, exact ratio ${ratio.toFixed(3)} gives x = ${x.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { rows: 1, cols: sigmas.length, sigmas, denoised, step: i + 1, sigma, nextSigma, ratio: Number(ratio.toFixed(8)), x: Number(x.toFixed(8)) },
        };
        step += 1;
    }

    const firstSigma = sigmas[0] ?? 1;
    const lastSigma = sigmas[sigmas.length - 1] ?? firstSigma;
    const closedForm = denoised + (startValue - denoised) * (firstSigma !== 0 ? lastSigma / firstSigma : 0);
    yield {
        stepNumber: step,
        entities: makeBars(trajectory, trajectory.length - 1),
        edges: [],
        description: `Done: x = ${x.toFixed(4)} matches the exact solution and approaches the denoised value ${denoised}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            rows: 1,
            cols: sigmas.length,
            sigmas,
            denoised,
            trajectory,
            closedForm: Number(closedForm.toFixed(8)),
            maxError: Number(Math.abs(x - closedForm).toExponential(4)),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A diffusion sampler repeatedly denoises a sample, but a naive Euler step follows the ODE only approximately. DPM-Solver factors out the known linear part of the diffusion ODE, so if the neural denoiser is treated as locally constant the update can be solved exactly. For the variance-exploding process this is a simple ratio of consecutive noise levels, letting a handful of steps land on the same answer Euler would need many more steps to approach.",
        invariants: [
            "The noise levels in the schedule strictly decrease toward zero.",
            "Each update multiplies the residual from the denoised value by sigma_next over sigma.",
            "For a constant denoiser the trajectory matches the closed-form ODE solution at every step.",
        ],
        correctness:
            "The variance-exploding probability-flow ODE dx/dsigma = (x - D) / sigma separates as dx / (x - D) = dsigma / sigma, giving ln|x - D| = ln(sigma) + C and hence x(sigma) = D + C sigma. Matching the boundary at sigma_i yields x(sigma_next) = D + (x(sigma_i) - D) sigma_next / sigma_i, exactly the update used here. Composing the ratios telescopes to the closed form D + (x_start - D) sigma_last / sigma_first, so every intermediate step and the final value are exact for constant D, while Euler's (1 - h) factor only approximates the exponential decay.",
        complexityRationale:
            "Each of the k noise levels needs a single multiply and add, so the solver is O(k) time; storing the sampled trajectory for visualization uses O(k) space.",
        uses: [
            "Fast sampling from diffusion image and audio models",
            "Few-step text-to-image generation",
            "Scientific simulation of stochastic differential equations",
        ],
        references: [
            "Lu et al., DPM-Solver: A Fast ODE Solver for Diffusion Probabilistic Model Sampling, NeurIPS 2022",
            "Song et al., Score-Based Generative Modeling through SDEs, ICLR 2021",
        ],
        workedExample:
            "Starting at x = 3 with denoised target 0 and sigmas [8, 4, 2, 1, 0.5, 0.1], the first ratio 4/8 gives x = 1.5, then 2/4 gives 0.75, and so on. After all steps x = 0.0375, matching the closed form 0 + 3 times 0.1/8 = 0.0375. Euler with the same six steps lands elsewhere because it uses (1 - h) rather than the exact sigma ratio.",
    },
    id: "dpm-solver",
    name: "DPM-Solver",
    category: "ml-ai",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { sigmas: [8, 4, 2, 1, 0.5, 0.1], startValue: 3, denoised: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "read the decreasing noise schedule and the initial sample",
        "for each pair of consecutive noise levels",
        "compute the ratio sigma_next over sigma",
        "set x to denoised plus (x minus denoised) times the ratio",
        "record the sample at this noise level",
        "done: return the trajectory and its exact closed-form check",
    ],
};

export default module;
