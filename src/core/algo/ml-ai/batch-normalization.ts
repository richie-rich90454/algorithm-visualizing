/**
 * batch-normalization.ts - Batch Normalization on a Mini-batch
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Batch normalization standardizes the activations of a mini-batch: subtract
 * the batch mean and divide by the batch standard deviation, then apply a
 * learnable scale gamma and shift beta. This keeps activation distributions
 * stable during training and lets deeper networks converge faster. This demo
 * shows the exact per-feature computation on a one-dimensional batch.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a batch of n values
 *   Space: O(n) for the normalized and scaled outputs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per batch element, showing the values at the current phase.
 *   - Green bars are finalized; yellow bars are being transformed.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    values?: number[];
    gamma?: number;
    beta?: number;
    eps?: number;
}

function makeBars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, value },
    }));
}

/** The batch-normalization generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const values = (task.values ?? [1, 2, 3, 4, 5]).slice();
    const gamma = typeof task.gamma === "number" ? task.gamma : 2;
    const beta = typeof task.beta === "number" ? task.beta : 0.5;
    const eps = typeof task.eps === "number" ? task.eps : 1e-5;

    const n = values.length;
    const mean = n > 0 ? values.reduce((a, v) => a + v, 0) / n : 0;
    const variance = n > 0 ? values.reduce((a, v) => a + (v - mean) ** 2, 0) / n : 0;
    const std = Math.sqrt(variance + eps);
    const normalized = values.map((v) => (v - mean) / std);
    const output = normalized.map((v) => gamma * v + beta);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(values, "idle"),
        edges: [],
        description: `Mini-batch of ${n} values; compute per-feature mean and variance.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: 1, cols: n, mean: 0, variance: 0, gamma, beta },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(values, "comparing"),
        edges: [],
        description: `Batch mean = ${mean.toFixed(4)}, variance = ${variance.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { rows: 1, cols: n, mean, variance, gamma, beta },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(normalized, "active"),
        edges: [],
        description: `Normalize each value: (x - mean) / sqrt(variance + eps), giving zero mean and unit variance.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { rows: 1, cols: n, mean, variance, gamma, beta, normalized },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(output, "sorted"),
        edges: [],
        description: `Apply the learnable scale and shift: y = gamma * xhat + beta with gamma ${gamma}, beta ${beta}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { rows: 1, cols: n, mean, variance, gamma, beta, normalized, output },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(output, "sorted"),
        edges: [],
        description: `Done: ${n} standardized values rescaled to mean ${beta.toFixed(3)} and standard deviation ${Math.abs(gamma).toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { rows: 1, cols: n, mean, variance, gamma, beta, normalized, output, count: n },
    };
}

/** The batch-normalization module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "As data flows through a deep network, the distribution of activations can shift from layer to layer, which slows learning. Batch normalization recenters and rescales each mini-batch to zero mean and unit variance, then gives the network two trainable knobs, gamma and beta, so it can choose the final scale and offset that work best.",
        invariants: [
            "The mean and variance are computed over the current mini-batch only.",
            "The normalized values have mean zero and variance one, up to the small epsilon used for numerical stability.",
            "The final output is an affine transform gamma times the normalized value plus beta.",
        ],
        correctness:
            "For values x with mean mu and variance sigma squared, the standardized value (x - mu) / sqrt(sigma squared plus eps) has mean zero and variance at most one. Multiplying by gamma and adding beta is a bijection for nonzero gamma, so the network can recover any desired affine distribution while the intermediate standardization remains exact and reproducible.",
        complexityRationale:
            "Computing the mean, the variance, the normalized values, and the affine output each scans the n batch values once, so the total time is O(n). Storing the normalized and scaled arrays uses O(n) space.",
        uses: [
            "Stabilizing training of deep convolutional networks",
            "Allowing larger learning rates in feedforward models",
            "A standard layer in modern vision and language architectures",
        ],
        references: [
            "Ioffe and Szegedy, Batch Normalization: Accelerating Deep Network Training, 2015",
            "Goodfellow, Bengio, and Courville, Deep Learning, Chapter 8, 2016",
        ],
        workedExample:
            "For the batch 1, 2, 3, 4, 5 the mean is 3 and the population variance is 2. Each value is standardized by subtracting 3 and dividing by the square root of 2, so 1 becomes about -1.414. With gamma 2 and beta 0.5 the final output for that element is about -2.328.",
    },
    id: "batch-normalization",
    name: "Batch Normalization",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [1, 2, 3, 4, 5], gamma: 2, beta: 0.5, eps: 1e-5 },
    visualType: "array",
    run,
    pseudocode: [
        "read the mini-batch values and the parameters gamma and beta",
        "compute the batch mean",
        "compute the batch variance",
        "standardize each value using mean and variance plus epsilon",
        "scale and shift each standardized value by gamma and beta",
        "collect the rescaled values for the next layer",
        "done: emit the normalized batch for the next layer",
    ],
};

export default module;
