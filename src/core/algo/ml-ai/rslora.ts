/**
 * rslora.ts - Rank-Stabilized LoRA Scaling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rank-Stabilized LoRA changes the scaling factor of low-rank adapters from
 * alpha over r to alpha over the square root of r. With standard LoRA the
 * update magnitude grows as the rank grows, which makes high-rank adapters
 * unstable. The square-root scaling keeps the update magnitude comparable
 * across ranks, so increasing the rank adds capacity without amplifying the
 * update. This module computes the rank-stabilized delta weight B times A.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r * d1 * d2) to multiply a d1-by-r matrix by r-by-d2
 *   Space: O(d1 * d2) for the resulting delta weight
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the scaled low-rank update matrix.
 *   - The scale and rank are reported alongside the result.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    rank?: number;
    alpha?: number;
    A?: number[][];
    B?: number[][];
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

function makeCells(matrix: number[][], state: EntityState): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        const row = matrix[r] ?? [];
        for (let c = 0; c < row.length; c += 1) {
            const value = row[c] ?? 0;
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: value.toFixed(3),
                value,
                state,
                x: c,
                y: r,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, value },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const A = (task.A ?? [
        [1, 0],
        [0, 1],
    ]).map((row) => row.slice());
    const B = (task.B ?? [
        [2, 1],
        [1, 3],
    ]).map((row) => row.slice());
    const rank = typeof task.rank === "number" && task.rank > 0 ? Math.floor(task.rank) : 2;
    const alpha = typeof task.alpha === "number" ? task.alpha : 2;
    const scale = alpha / Math.sqrt(rank);
    const product = matMul(B, A);
    const delta = product.map((row) => row.map((value) => value * scale));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(product, "idle"),
        edges: [],
        description: `Multiply the low-rank factors B and A with rank ${rank} and alpha ${alpha}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: product.length, cols: (product[0]?.length ?? 0), rank, alpha, scale: Number(scale.toFixed(6)) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(product, "comparing"),
        edges: [],
        description: `Rank-stabilized scale is alpha over the square root of rank: ${scale.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: product.length, cols: (product[0]?.length ?? 0), rank, alpha, scale: Number(scale.toFixed(6)) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(delta, "sorted"),
        edges: [],
        description: `Scale every entry of the product by ${scale.toFixed(4)} to form the adapter update.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: delta.length, cols: (delta[0]?.length ?? 0), rank, alpha, scale: Number(scale.toFixed(6)), delta: delta.flat().map((v) => Number(v.toFixed(6))) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(delta, "sorted"),
        edges: [],
        description: `Done: rank ${rank} update has scale ${scale.toFixed(4)}, independent of the old alpha-over-r blowup.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: delta.length, cols: (delta[0]?.length ?? 0), rank, alpha, scale: Number(scale.toFixed(6)), delta: delta.flat().map((v) => Number(v.toFixed(6))) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A LoRA adapter adds a low-rank matrix B times A to a frozen weight. Its usual scale alpha divided by r makes the update larger as the rank grows, which can destabilize training. Dividing by the square root of r instead keeps the update size roughly constant as capacity increases, so a higher rank buys expressiveness without changing how aggressively the adapter updates the model.",
        invariants: [
            "The scaling factor is alpha divided by the square root of the rank.",
            "The delta weight is the matrix product B A multiplied by that scalar.",
            "Doubling the rank multiplies the scale by one over the square root of two, not one half.",
        ],
        correctness:
            "For factors whose entries have comparable variance, the entries of B A sum over r terms and therefore grow on the order of r. Multiplying by alpha over the square root of r leaves the update on the order of alpha times the square root of r, which varies gently with rank; the classic alpha over r factor would cancel the growth entirely and shrink large adapters. The computed delta is exactly scale times the ordinary matrix product, so the forward pass reproduces the adapter's contribution.",
        complexityRationale:
            "Multiplying a d1-by-r matrix by an r-by-d2 matrix takes O(r * d1 * d2) scalar operations, and scaling the d1-by-d2 result is dominated by that cost; storing the result uses O(d1 * d2) space.",
        uses: [
            "High-rank parameter-efficient fine-tuning of large language models",
            "Multi-adapter serving where ranks vary per task",
            "Stabilizing LoRA hyperparameter sweeps",
        ],
        references: [
            "Kalajdzievski, A Rank Stabilization Scaling Factor for Fine-Tuning with LoRA, 2023",
            "Hu et al., LoRA: Low-Rank Adaptation of Large Language Models, ICLR 2022",
        ],
        workedExample:
            "With alpha 2 and rank 4 the rank-stabilized scale is 2 / 2 = 1, while classic LoRA would use 2 / 4 = 0.5. If the product B A has entries near 2, the stabilized update has entries near 2 rather than 1, so choosing a larger rank does not silently shrink or explode the adapter's effect.",
    },
    id: "rslora",
    name: "Rank-Stabilized LoRA",
    category: "ml-ai",
    complexity: { time: "O(r * d1 * d2)", space: "O(d1 * d2)" },
    defaultInput: {
        rank: 2,
        alpha: 2,
        A: [
            [1, 0],
            [0, 1],
        ],
        B: [
            [2, 1],
            [1, 3],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read low-rank factors A and B and the rank r",
        "compute the matrix product B times A",
        "set scale to alpha divided by the square root of r",
        "multiply every entry of the product by the scale",
        "add the result to the frozen base weight",
        "done: return the rank-stabilized adapter update",
    ],
};

export default module;
