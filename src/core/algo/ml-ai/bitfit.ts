/**
 * bitfit.ts - Bias-Only Fine-Tuning of a Linear Layer
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BitFit freezes every weight matrix in a network and trains only the bias
 * vectors. On a single linear layer the weight gradients are still computed
 * for illustration, but they are discarded: only the bias receives an update.
 * This tiny parameterization often adapts a pretrained model surprisingly well.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * d) for an m-output, d-input linear layer
 *   Space: O(m * d) for the frozen weights and the m trainable biases
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the prediction before the step, the bias gradient, and the
 *     prediction after the step.
 *   - Metadata records which parameter tensors are frozen and which change.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BitFitInput {
    weights?: number[][];
    bias?: number[];
    x?: number[];
    target?: number[];
    lr?: number;
}

const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

/** One gradient step that updates only the bias vector. */
export function bitFitStep(
    weights: number[][],
    bias: number[],
    x: number[],
    target: number[],
    lr: number,
) {
    const yBefore = weights.map((row, i) => dot(row, x) + (bias[i] ?? 0));
    const error = yBefore.map((value, i) => value - (target[i] ?? 0));
    const gradBias = error.slice();
    const gradWeight = weights.map((row, i) => row.map((_w, j) => (error[i] ?? 0) * (x[j] ?? 0)));
    const biasAfter = bias.map((value, i) => value - lr * (gradBias[i] ?? 0));
    const yAfter = weights.map((row, i) => dot(row, x) + (biasAfter[i] ?? 0));
    const lossBefore = 0.5 * error.reduce((sum, value) => sum + value * value, 0);
    const lossAfter = 0.5 * yAfter.reduce((sum, value, i) => sum + (value - (target[i] ?? 0)) ** 2, 0);
    return { yBefore, gradBias, gradWeight, biasAfter, yAfter, lossBefore, lossAfter };
}

function bars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `out-${index}`,
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
    const task = (input as BitFitInput | null) ?? {};
    const weights: number[][] = task.weights ?? [
        [1, 0.5, -0.5],
        [0.2, -1, 0.8],
    ];
    const bias: number[] = Array.isArray(task.bias) ? task.bias.slice() : [0, 0];
    const x: number[] = Array.isArray(task.x) && task.x.length > 0 ? task.x.slice() : [1, 2, -1];
    const target: number[] = Array.isArray(task.target) ? task.target.slice() : [2.5, -0.5];
    const lr = typeof task.lr === "number" && task.lr > 0 ? task.lr : 0.1;
    const r = bitFitStep(weights, bias, x, target, lr);
    const m = weights.length;
    const d = weights[0]?.length ?? 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(r.yBefore, "idle"),
        edges: [],
        description: `Linear layer with ${m} outputs: freeze ${m * d} weights, train ${m} biases.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x, y: r.yBefore, frozenWeights: m * d, trainableBiases: m, lossBefore: Number(r.lossBefore.toFixed(8)), phase: "before" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(r.gradBias, "comparing"),
        edges: [],
        description: "Compute the loss gradient; only the bias component is kept for the update.",
        codeLineNumber: 2,
        layout: "array",
        meta: { x, gradBias: r.gradBias, phase: "gradient", frozenWeights: m * d, trainableBiases: m },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(r.biasAfter, "active"),
        edges: [],
        description: `Move each bias against its gradient with step size ${lr}; weights stay fixed.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { x, bias: bias, biasAfter: r.biasAfter, phase: "update", frozenWeights: m * d, trainableBiases: m },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(r.yAfter, "sorted"),
        edges: [],
        description: `Loss fell from ${r.lossBefore.toFixed(4)} to ${r.lossAfter.toFixed(4)} using only ${m} trainable biases.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            x,
            y: r.yAfter,
            biasAfter: r.biasAfter,
            lossBefore: Number(r.lossBefore.toFixed(8)),
            lossAfter: Number(r.lossAfter.toFixed(8)),
            frozenWeights: m * d,
            trainableBiases: m,
            phase: "done",
            converged: r.lossAfter <= r.lossBefore,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "BitFit asks how much a model can learn by changing almost nothing. Every weight matrix is frozen, and only the small bias vectors are allowed to move. For a linear layer the prediction is the fixed matrix product plus the bias, so nudging the bias directly shifts the output toward the target with a tiny number of trainable values.",
        invariants: [
            "All weight matrices remain exactly constant across the step.",
            "Only the bias vector is updated, using its own loss gradient.",
            "The output is always the fixed matrix product plus the current bias.",
        ],
        correctness:
            "For squared error the gradient with respect to the bias is the prediction error. The weight gradients are computed but discarded as required by BitFit. Updating the bias by minus the learning rate times its gradient moves the output by that same amount, so with a small enough step the squared error cannot increase; this is the steepest descent step restricted to the bias subspace.",
        complexityRationale:
            "Computing the prediction scans the m by d weight matrix once, O(m*d), and the bias update touches m values. Storage is O(m*d) for the frozen weights plus O(m) for the trainable biases.",
        uses: [
            "Cheap adaptation of large pretrained models",
            "Low-memory fine-tuning on small datasets",
            "A teaching example of extreme parameter efficiency",
        ],
        references: [
            "Ben Zaken, Goldberg, and Ravfogel, BitFit: Simple Parameter-Efficient Fine-Tuning, ACL 2022",
            "Howard and Ruder, Universal Language Model Fine-Tuning, 2018",
        ],
        workedExample:
            "For a two-output layer with weights applied to a three-dimensional input and biases initially zero, an error of 0.5 in the first output moves that bias by minus 0.05 with learning rate 0.1. The weights never change, and the new prediction is the old one shifted by that bias change.",
    },
    id: "bitfit",
    name: "BitFit Bias-Only Tuning",
    category: "ml-ai",
    complexity: { time: "O(m * d)", space: "O(m * d)" },
    defaultInput: {
        weights: [
            [1, 0.5, -0.5],
            [0.2, -1, 0.8],
        ],
        bias: [0, 0],
        x: [1, 2, -1],
        target: [2.5, -0.5],
        lr: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "freeze all weight matrices",
        "predict with the fixed weights plus the current biases",
        "compute the loss gradient for the biases",
        "ignore the weight gradients entirely",
        "move each bias against its gradient",
        "recompute the prediction and the loss",
        "done: report the updated biases and loss",
    ],
};

export default module;
