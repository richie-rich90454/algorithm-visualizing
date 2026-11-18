/**
 * layer-normalization.ts - Layer Normalization on One Feature Vector
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Layer normalization rescales the features of a single example so they have
 * zero mean and unit variance, then applies a learned scale and shift. Unlike
 * batch normalization it needs no statistics across examples, which makes it a
 * staple of sequence models. This demo normalizes one short vector exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d) for a d-dimensional feature vector
 *   Space: O(d) for the normalized and output vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the input, then the centered values, then the final output.
 *   - The active frame highlights the values being computed.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface LayerNormInput {
    x?: number[];
    gamma?: number[];
    beta?: number[];
    eps?: number;
}

/** One bar per feature value. */
function bars(values: number[], state: "idle" | "active" | "sorted"): VisualEntity[] {
    return values.map((value, index) => ({
        id: `feat-${index}`,
        type: "bar" as const,
        label: value.toFixed(2),
        value: Number(value.toFixed(6)),
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** Normalize one vector across its own features. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LayerNormInput | null) ?? {};
    const x: number[] = Array.isArray(task.x) && task.x.length > 0 ? task.x.slice() : [1, 2, 3, 4, 5];
    const d = x.length;
    const gamma: number[] = Array.isArray(task.gamma) ? task.gamma.slice() : new Array<number>(d).fill(1);
    const beta: number[] = Array.isArray(task.beta) ? task.beta.slice() : new Array<number>(d).fill(0);
    const eps = typeof task.eps === "number" && task.eps >= 0 ? task.eps : 1e-5;

    const mean = x.reduce((sum, value) => sum + value, 0) / d;
    const variance = x.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / d;
    const std = Math.sqrt(variance + eps);
    const normalized = x.map((value) => (value - mean) / std);
    const output = normalized.map((value, index) => value * (gamma[index] ?? 1) + (beta[index] ?? 0));

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(x, "idle"),
        edges: [],
        description: `Normalizing a ${d}-dimensional vector across its own features.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x: x.map((v) => Number(v.toFixed(6))), mean: 0, variance: 0, output: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(x, "active"),
        edges: [],
        description: `Mean ${mean.toFixed(3)}, variance ${variance.toFixed(3)} computed over all ${d} features.`,
        codeLineNumber: 1,
        layout: "array",
        meta: {
            x: x.map((v) => Number(v.toFixed(6))),
            mean: Number(mean.toFixed(6)),
            variance: Number(variance.toFixed(6)),
            std: Number(std.toFixed(6)),
            output: [],
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(normalized, "active"),
        edges: [],
        description: `Center and scale each feature by the standard deviation ${std.toFixed(3)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            x: x.map((v) => Number(v.toFixed(6))),
            mean: Number(mean.toFixed(6)),
            variance: Number(variance.toFixed(6)),
            normalized: normalized.map((v) => Number(v.toFixed(6))),
            output: [],
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(output, "sorted"),
        edges: [],
        description: `Apply the learned scale and shift to get the final normalized vector.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            x: x.map((v) => Number(v.toFixed(6))),
            mean: Number(mean.toFixed(6)),
            variance: Number(variance.toFixed(6)),
            normalized: normalized.map((v) => Number(v.toFixed(6))),
            output: output.map((v) => Number(v.toFixed(6))),
        },
    };
}

/** The layer normalization module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Layer normalization makes the features of one example behave consistently by subtracting their average and dividing by their spread. After that re-centering, a learned scale and shift let the model choose a useful range. Because each example is normalized on its own, the method works the same way in training and inference.",
        invariants: [
            "The mean and variance are computed across the features of a single example.",
            "A small epsilon is added inside the square root to avoid division by zero.",
            "The scale and shift are applied elementwise after normalization.",
        ],
        correctness:
            "For features x with mean mu and standard deviation sigma, each normalized value (x minus mu) over sigma has mean zero and variance one by the definition of sample mean and variance. Multiplying by gamma and adding beta then restores a learnable mean and scale, so the transform is exactly the layer normalization definition.",
        complexityRationale:
            "Computing the mean and variance scans the d features twice and the normalization and scale scans them once more, so time is O(d). The normalized and output vectors hold d values each, giving O(d) space.",
        uses: [
            "Stabilizing training in transformers and recurrent networks",
            "Normalizing hidden states in sequence models",
            "Making model behavior independent of batch composition",
        ],
        references: [
            "Ba, Kiros, and Hinton, Layer Normalization, 2016",
            "Vaswani et al., Attention Is All You Need, 2017",
        ],
        workedExample:
            "For the vector 1, 2, 3, 4, 5 the mean is 3 and the variance is 2. Dividing the centered values by the square root of 2 gives roughly -1.41, -0.71, 0, 0.71, 1.41. With unit scale and zero shift those are the final outputs.",
    },
    id: "layer-normalization",
    name: "Layer Normalization",
    category: "ml-ai",
    complexity: { time: "O(d)", space: "O(d)" },
    defaultInput: { x: [1, 2, 3, 4, 5], gamma: [1, 1, 1, 1, 1], beta: [0, 0, 0, 0, 0], eps: 1e-5 },
    visualType: "array",
    run,
    pseudocode: [
        "read the feature vector for one example",
        "compute the mean of all features",
        "compute the variance of all features",
        "subtract the mean and divide by the standard deviation",
        "multiply each value by its learned scale",
        "add the learned shift to each value",
        "done: report the normalized vector",
    ],
};

export default module;
