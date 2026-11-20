/**
 * lora-plus.ts - LoRA Plus with Trainable Bias
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * LoRA Plus augments the standard low-rank adapter with a trainable bias
 * vector. The forward pass adds the frozen base projection, the scaled low-rank
 * update, and the bias. The bias lets the adapter shift the output distribution
 * without changing any weight, which is useful when a downstream task needs a
 * constant offset that a pure low-rank product cannot express. The combined
 * result is algebraically identical to adding the scaled update to the base
 * matrix first and then applying the bias.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d * r * d + d^2) for the adapter product and base projection
 *   Space: O(d^2) for the merged delta weight
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the base contribution, adapter contribution, and final output.
 *   - The final frame is green once all three terms are combined.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    baseWeight?: number[][];
    A?: number[][];
    B?: number[][];
    bias?: number[];
    input?: number[];
    alpha?: number;
    rank?: number;
}

function matMul(left: number[][], right: number[][]): number[][] {
    const m = left.length;
    const k = right.length;
    const n = k > 0 ? (right[0]?.length ?? 0) : 0;
    const result: number[][] = [];
    for (let i = 0; i < m; i += 1) {
        const row: number[] = [];
        for (let j = 0; j < n; j += 1) {
            let sum = 0;
            for (let t = 0; t < k; t += 1) {
                sum += (left[i]?.[t] ?? 0) * (right[t]?.[j] ?? 0);
            }
            row.push(sum);
        }
        result.push(row);
    }
    return result;
}

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, weight, j) => sum + weight * (vector[j] ?? 0), 0));
}

function makeBars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state,
        x: i,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const base = (task.baseWeight ?? [
        [1, 0],
        [0, 1],
    ]).map((row) => row.slice());
    const A = (task.A ?? [
        [1, 0],
        [0, 1],
    ]).map((row) => row.slice());
    const B = (task.B ?? [
        [2, 1],
        [1, 3],
    ]).map((row) => row.slice());
    const bias = (task.bias ?? [0.5, -0.5]).slice();
    const x = (task.input ?? [1, 2]).slice();
    const alpha = typeof task.alpha === "number" ? task.alpha : 1;
    const rank = typeof task.rank === "number" && task.rank > 0 ? Math.floor(task.rank) : 2;
    const scale = alpha / rank;
    const lowRank = matMul(B, A);
    const delta = lowRank.map((row) => row.map((value) => value * scale));
    const baseContribution = matVec(base, x);
    const adapterContribution = matVec(delta, x);
    const output = baseContribution.map((value, i) => value + (adapterContribution[i] ?? 0) + (bias[i] ?? 0));
    const merged = base.map((row, i) => row.map((value, j) => value + (delta[i]?.[j] ?? 0)));
    const mergedOutput = matVec(merged, x).map((value, i) => value + (bias[i] ?? 0));
    const maxError = output.reduce((max, value, i) => Math.max(max, Math.abs(value - (mergedOutput[i] ?? 0))), 0);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(baseContribution, "idle"),
        edges: [],
        description: `Forward pass with a frozen base weight and a rank-${rank} adapter plus bias.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: 1, cols: output.length, alpha, rank, scale: Number(scale.toFixed(6)) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(adapterContribution, "active"),
        edges: [],
        description: `The scaled low-rank product B times A contributes ${adapterContribution.map((v) => v.toFixed(2)).join(", ")}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { rows: 1, cols: output.length, scale: Number(scale.toFixed(6)), delta: delta.flat().map((v) => Number(v.toFixed(6))) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(output, "comparing"),
        edges: [],
        description: `Add the trainable bias ${bias.map((v) => v.toFixed(2)).join(", ")} to base plus adapter.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { rows: 1, cols: output.length, output: output.map((v) => Number(v.toFixed(6))), bias },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(output, "sorted"),
        edges: [],
        description: `Done: merged-weight evaluation matches the three-term sum (max error ${maxError.toExponential(1)}).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { rows: 1, cols: output.length, output: output.map((v) => Number(v.toFixed(6))), maxError, merged: merged.flat().map((v) => Number(v.toFixed(6))) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain low-rank adapter can only rotate the weight in ways a product of two thin matrices allows; it has no free offset. LoRA Plus adds a small trainable bias vector to the output, so the adapter can also translate the result. Because adding a bias after a projection is the same as adding it after merging the adapter into the base weight, deployment stays cheap.",
        invariants: [
            "The adapter update is alpha over rank times the product B A.",
            "The output is base times input plus adapter times input plus bias.",
            "Merging the update into the base weight and then adding bias gives the same output.",
        ],
        correctness:
            "Matrix multiplication distributes over addition, so (W + (alpha/r) B A) x + b = W x + (alpha/r) B A x + b. Both expressions therefore produce identical outputs up to floating-point rounding, which is what the max-error check verifies. The bias term is a free vector that a pure low-rank product cannot represent, so it strictly enlarges the family of expressible updates.",
        complexityRationale:
            "Forming B A costs O(d * r * d), applying base and delta projections costs O(d^2) each, and the bias is O(d); the merged delta matrix uses O(d^2) space, dominated by the adapter product.",
        uses: [
            "Parameter-efficient fine-tuning with task-specific offsets",
            "Adapter merges for low-latency inference",
            "Domain adaptation where output calibration matters",
        ],
        references: [
            "Hu et al., LoRA: Low-Rank Adaptation of Large Language Models, ICLR 2022",
            "Li & Liang, Prefix-Tuning, ACL 2021",
        ],
        workedExample:
            "With identity base, A = B = identity, alpha 1, rank 2, input [1, 2] and bias [0.5, -0.5], the adapter scale is 0.5. The base gives [1, 2], the adapter gives [0.5, 1], and the bias gives a final output of [2, 2.5]. Merging 0.5 times the identity into the base weight and adding the same bias reproduces [2, 2.5] exactly.",
    },
    id: "lora-plus",
    name: "LoRA Plus",
    category: "ml-ai",
    complexity: { time: "O(d * r * d + d^2)", space: "O(d^2)" },
    defaultInput: {
        baseWeight: [
            [1, 0],
            [0, 1],
        ],
        A: [
            [1, 0],
            [0, 1],
        ],
        B: [
            [2, 1],
            [1, 3],
        ],
        bias: [0.5, -0.5],
        input: [1, 2],
        alpha: 1,
        rank: 2,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the frozen base weight and the LoRA factors",
        "compute the scaled low-rank update alpha over r times B A",
        "project the input through the base weight",
        "project the input through the adapter update",
        "add both projections and the trainable bias",
        "done: return the combined output with a merge check",
    ],
};

export default module;
