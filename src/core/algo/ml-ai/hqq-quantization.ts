/**
 * hqq-quantization.ts - Half-Quadratic Quantization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * HQQ casts weight quantization as an optimization problem: find an on-grid
 * value close to each true weight while encouraging a structured penalty.
 * Half-quadratic splitting introduces an auxiliary variable so each substep
 * has a closed form. The data step is a projection onto the uniform
 * quantization grid; the penalty step is soft thresholding, the proximal
 * operator of the absolute value.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * iterations) for n weights
 *   Space: O(n) for the weight and auxiliary arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the true weights beside the quantized reconstruction.
 *   - Converged bars are green; the final frame reports the reconstruction error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface QuantInput {
    weights?: number[];
    bits?: number;
    lambda?: number;
    beta?: number;
    iterations?: number;
}

/** Soft thresholding: the proximal operator of t times the absolute value. */
export function softThreshold(x: number, t: number): number {
    if (x > t) return x - t;
    if (x < -t) return x + t;
    return 0;
}

/** Project a value onto a uniform grid with the given minimum and step. */
export function quantProject(v: number, min: number, step: number, levels: number): number {
    if (step <= 0) return v;
    const index = Math.max(0, Math.min(levels - 1, Math.round((v - min) / step)));
    return min + index * step;
}

/**
 * Run the half-quadratic splitting iteration. Each round soft-thresholds the
 * current on-grid values, then projects the data-fused estimate back onto the
 * grid. Returns the reconstruction, the auxiliary values and the mean squared
 * error after each round.
 */
export function hqqSolve(weights: number[], bits: number, lambda: number, beta: number, iterations: number) {
    const b = Math.max(1, Math.min(16, Math.floor(bits)));
    const levels = 2 ** b;
    const min = weights.length === 0 ? 0 : Math.min(...weights);
    const max = weights.length === 0 ? 1 : Math.max(...weights);
    const step = max === min ? 1 : (max - min) / (levels - 1);
    const rounds = Math.max(1, Math.floor(iterations));
    let grid = weights.map((w) => quantProject(w, min, step, levels));
    let aux = grid.map((v) => softThreshold(v, lambda / Math.max(1e-12, beta)));
    const errors: number[] = [];
    for (let r = 0; r < rounds; r += 1) {
        grid = weights.map((w, i) =>
            quantProject((w + beta * (aux[i] ?? 0)) / (1 + beta), min, step, levels),
        );
        aux = grid.map((v) => softThreshold(v, lambda / Math.max(1e-12, beta)));
        errors.push(
            weights.reduce((s, w, i) => s + (w - (grid[i] ?? 0)) ** 2, 0) /
                Math.max(1, weights.length),
        );
    }
    return { reconstruction: grid, aux, errors, min, step, levels };
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `w-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as QuantInput | null) ?? {};
    const weights: number[] = task.weights ?? [-1.2, -0.4, 0, 0.3, 0.9, 1.4];
    const bits = task.bits ?? 3;
    const lambda = typeof task.lambda === "number" ? task.lambda : 0.15;
    const beta = typeof task.beta === "number" ? task.beta : 1;
    const iterations = task.iterations ?? 3;
    const { reconstruction, errors, min, step, levels } = hqqSolve(weights, bits, lambda, beta, iterations);
    const initial = weights.map((w) => quantProject(w, min, step, levels));

    let stepNo = 0;
    yield {
        stepNumber: stepNo,
        entities: bars(weights, weights.map(() => "idle")),
        edges: [],
        description: `Quantize ${weights.length} weights to ${levels} levels on a grid of step ${step.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "setup", bits, lambda, beta, levels, step, errors: [], reconstruction: [] },
    };
    stepNo += 1;

    yield {
        stepNumber: stepNo,
        entities: bars(initial, initial.map(() => "comparing")),
        edges: [],
        description: "Project each weight onto the nearest point of the uniform grid.",
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "project", bits, lambda, beta, levels, step, errors: [], reconstruction: initial },
    };
    stepNo += 1;

    yield {
        stepNumber: stepNo,
        entities: bars(
            reconstruction,
            reconstruction.map((_, i) => (weights[i] === reconstruction[i] ? "sorted" : "comparing")),
        ),
        edges: [],
        description: `After ${errors.length} half-quadratic round(s), mean squared error is ${(errors[errors.length - 1] ?? 0).toFixed(6)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "refine", bits, lambda, beta, levels, step, errors, reconstruction },
    };
    stepNo += 1;

    yield {
        stepNumber: stepNo,
        entities: bars(reconstruction, reconstruction.map(() => "sorted")),
        edges: [],
        description: `Done: reconstructed weights lie on the ${levels}-level grid with error ${(errors[errors.length - 1] ?? 0).toFixed(6)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            phase: "done",
            bits,
            lambda,
            beta,
            levels,
            step,
            errors,
            reconstruction,
            mse: errors[errors.length - 1] ?? 0,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Half-quadratic quantization turns a hard discrete optimization into a loop of two easy steps. One step nudges the quantized values toward the true weights and snaps them back to the allowed grid; the other soft-thresholds them to enforce the penalty. Because both steps are closed form, the method scales to very large models without a calibration set.",
        invariants: [
            "Every projected value lies exactly on the uniform quantization grid.",
            "Soft thresholding drives small auxiliary values to exactly zero.",
            "The recorded mean squared error is computed against the original weights each round.",
        ],
        correctness:
            "Soft thresholding is the exact minimizer of one half the squared distance to x plus t times the absolute value, which is the proximal operator of the L1 penalty. Projecting to the nearest grid index is the exact minimizer of squared distance over the discrete grid. Half-quadratic splitting alternately minimizes the data term fused with the auxiliary variable and the penalty term, so each round does not increase the augmented objective, and the returned reconstruction is always a valid on-grid value.",
        complexityRationale:
            "Each of the iterations touches every weight a constant number of times, giving O(n times iterations) time. Two length-n arrays hold the grid and auxiliary values, so space is O(n).",
        uses: [
            "Post-training quantization of large language models",
            "Memory reduction for on-device inference",
            "Data-free model compression without a calibration set",
        ],
        references: [
            "Badri and Shaji, Half-Quadratic Quantization of Large Machine Learning Models, 2023",
            "Geman and Reynolds, Constrained Restoration and the Recovery of Discontinuities, 1992",
        ],
        workedExample:
            "With weights 0.0, 0.4, 0.9 and 3 bits, the grid spans the observed range in eight steps. A weight of 0.4 snaps to the nearest grid point, soft thresholding with lambda 0.15 and beta 1 pulls a grid point of 0.25 down to 0.10, and the next projection picks the closest grid value to the fused estimate.",
    },
    id: "hqq-quantization",
    name: "Half-Quadratic Quantization",
    category: "ml-ai",
    complexity: { time: "O(n * iterations)", space: "O(n)" },
    defaultInput: { weights: [-1.2, -0.4, 0, 0.3, 0.9, 1.4], bits: 3, lambda: 0.15, beta: 1, iterations: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "read the weights, bit width, lambda, beta and iteration count",
        "build a uniform grid from the observed minimum and maximum",
        "project every weight onto its nearest grid point",
        "repeat for the given number of rounds",
        "soft-threshold the grid values to form the auxiliary variable",
        "fuse weights with the auxiliary value and re-project onto the grid",
        "done: report the reconstruction and its mean squared error",
    ],
};

export default module;
