/**
 * heun-sampler.ts - Heun Predictor-Corrector Diffusion Sampler
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Diffusion samplers integrate a probability-flow ODE from noisy samples to
 * clean ones. A single Euler step is first-order accurate, so a coarse schedule
 * can miss the trajectory. The Heun sampler uses a predictor step to estimate
 * the slope at the end of the interval, then averages the two slopes for a
 * second-order corrector step. It gives noticeably better samples for the same
 * number of network evaluations.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d) for d sample coordinates and two drift evaluations per step
 *   Space: O(steps * d) for the stored trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - The current sample vector is drawn as a single grid row.
 *   - Each step highlights the corrected coordinate values.
 *   - Frame meta carries the noise schedule, slopes, and full trajectory.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HeunInput {
    initial?: number[];
    sigmas?: number[];
}

/** Drift of the illustrative Ornstein-Uhlenbeck probability-flow ODE. */
export function drift(x: number[], sigma: number): number[] {
    return x.map((v) => -sigma * v);
}

/** One Heun predictor-corrector step with a unit time interval. */
export function heunStep(x: number[], sigma: number, sigmaNext: number): { next: number[]; predictor: number[]; slopeStart: number[]; slopeEnd: number[] } {
    const slopeStart = drift(x, sigma);
    const predictor = x.map((v, i) => v + (slopeStart[i] ?? 0));
    const slopeEnd = drift(predictor, sigmaNext);
    const next = x.map((v, i) => v + 0.5 * ((slopeStart[i] ?? 0) + (slopeEnd[i] ?? 0)));
    return { next, predictor, slopeStart, slopeEnd };
}

/** Integrate the sample through the whole decreasing noise schedule. */
export function heunSample(initial: number[], sigmas: number[]): { trajectory: number[][]; predictors: number[][] } {
    let x = [...initial];
    const trajectory: number[][] = [[...x]];
    const predictors: number[][] = [];
    for (let i = 0; i + 1 < sigmas.length; i += 1) {
        const step = heunStep(x, sigmas[i] ?? 0, sigmas[i + 1] ?? 0);
        x = step.next;
        trajectory.push([...x]);
        predictors.push(step.predictor);
    }
    return { trajectory, predictors };
}

function makeCells(values: number[], active: number): VisualEntity[] {
    return values.map((value, col) => ({
        id: `value-${col}`,
        type: "cell" as const,
        label: value.toFixed(4),
        value,
        state: (col === active ? "active" : "visited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col, coordinate: col },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HeunInput | null) ?? {};
    const initial = (task.initial ?? [1, -0.5, 2]).map(Number);
    const sigmas = Array.isArray(task.sigmas) && task.sigmas.length > 1
        ? task.sigmas.map(Number)
        : [3, 1.5, 0.7, 0.2];
    const { trajectory, predictors } = heunSample(initial, sigmas);
    const dim = initial.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(initial, -1),
        edges: [],
        description: `Heun diffusion sampler over ${sigmas.length - 1} steps from sigma ${sigmas[0]} to ${sigmas[sigmas.length - 1]}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: dim, dim, sigmas, trajectory, predictors, stepIndex: -1 },
    };
    step += 1;

    for (let i = 0; i + 1 < sigmas.length; i += 1) {
        const slopeStart = drift(trajectory[i] ?? initial, sigmas[i] ?? 0);
        const slopeEnd = drift(predictors[i] ?? initial, sigmas[i + 1] ?? 0);
        yield {
            stepNumber: step,
            entities: makeCells(trajectory[i + 1] ?? initial, i),
            edges: [],
            description: `Step ${i}: predictor ${(predictors[i] ?? []).map((v) => v.toFixed(3)).join(",")}, corrected sample ${(trajectory[i + 1] ?? []).map((v) => v.toFixed(3)).join(",")}.`,
            codeLineNumber: i === 0 ? 2 : 4,
            layout: "grid",
            meta: {
                rows: 1,
                cols: dim,
                dim,
                sigmas,
                trajectory,
                predictors,
                slopeStart,
                slopeEnd,
                stepIndex: i,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(trajectory[trajectory.length - 1] ?? initial, sigmas.length - 2),
        edges: [],
        description: `Finished ${sigmas.length - 1} Heun steps; final sample ${(trajectory[trajectory.length - 1] ?? []).map((v) => v.toFixed(4)).join(",")}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 1, cols: dim, dim, sigmas, trajectory, predictors, stepIndex: sigmas.length - 2 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Generative diffusion turns noise into data by following a smooth flow. A naive sampler takes one step using the slope at the current point, which overshoots when the slope changes quickly. Heun first guesses where the step lands, measures the slope there, and averages the two slopes. This predictor-corrector pair cancels the leading error term at no extra modeling cost.",
        invariants: [
            "The noise schedule decreases from the first sigma to the last.",
            "Each predictor uses the slope at the current point and the current sigma.",
            "The corrected step averages the starting and predicted ending slopes with equal weight.",
        ],
        correctness:
            "Heun's method is the explicit trapezoid rule for an ordinary differential equation. Its local truncation error is proportional to the cube of the step size because averaging the endpoint slopes cancels all second-order terms of the Taylor expansion. For the linear drift used here, one step multiplies the sample by 1 minus sigma times dt plus one half sigma squared dt squared, which agrees with the exact exponential factor through second order.",
        complexityRationale:
            "Each interval evaluates the drift twice and combines d coordinates, so the cost is O(steps times d). Storing the trajectory for replay uses O(steps times d) space.",
        uses: [
            "High-quality sampling from diffusion and flow models",
            "Fast image and audio generation with coarse schedules",
            "Numerical integration of learned probability-flow ODEs",
        ],
        references: [
            "Karras, Aittala, Aila, Laine, Elucidating the Design Space of Diffusion-Based Generative Models, NeurIPS 2022",
            "Heun, Neue Methoden zur approximativen Integration der Differentialgleichungen, 1900",
        ],
        workedExample:
            "With a constant sigma of 0.5 and step size one, a sample of 1 has starting slope -0.5. The predictor is 0.5, whose slope is -0.25. The corrected next value is 1 plus half of (-0.5 minus 0.25), or 0.625, close to the exact exp(-0.5) of about 0.6065.",
    },
    id: "heun-sampler",
    name: "Heun Predictor-Corrector Diffusion Sampler",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(steps * d)" },
    defaultInput: { initial: [1, -0.5, 2], sigmas: [3, 1.5, 0.7, 0.2] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the noisy initial sample and decreasing sigma schedule",
        "for each pair of consecutive noise levels",
        "compute the drift at the current sample",
        "take an Euler predictor step to the interval end",
        "compute the drift at the predicted sample with the next sigma",
        "average the two slopes and take the corrected step",
        "store the sample for this noise level",
        "done: return the full sampling trajectory",
    ],
};

export default module;
