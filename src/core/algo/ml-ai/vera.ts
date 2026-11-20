/**
 * vera.ts - VeRA: Vector-based Random Matrix Adaptation
 *
 * VeRA freezes a pair of random low-rank matrices A and B shared across all
 * weight matrices and trains only a short scaling vector per layer. The
 * effective weight update is B times a diagonal of learned scales times A, so
 * a full-rank-looking change is produced from a few trainable numbers.
 *
 * Time is O(d * r * dout) to form the update; space is O(d * dout).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { mulberry32 } from "./random-search-hyperparameter";

/** Build frozen random matrices A (d by r) and B (r by dout). */
export function veraRandomMatrices(d: number, r: number, dout: number, seed: number): {
    A: number[][];
    B: number[][];
} {
    const rand = mulberry32(seed);
    const A = Array.from({ length: d }, () =>
        Array.from({ length: r }, () => rand() * 2 - 1),
    );
    const B = Array.from({ length: r }, () =>
        Array.from({ length: dout }, () => rand() * 2 - 1),
    );
    return { A, B };
}

/** Effective VeRA weight update: B diag(lambda) A, shape d by dout. */
export function veraDelta(A: number[][], B: number[][], lambda: number[]): number[][] {
    const d = A.length;
    const r = B.length;
    const dout = B[0]?.length ?? 0;
    return Array.from({ length: d }, (_, i) =>
        Array.from({ length: dout }, (_, o) => {
            let sum = 0;
            for (let k = 0; k < r; k += 1) {
                sum += (B[k]![o] ?? 0) * (lambda[k] ?? 0) * (A[i]![k] ?? 0);
            }
            return sum;
        }),
    );
}

/** Apply a VeRA update to a base weight matrix. */
export function veraForward(
    baseWeight: number[][],
    A: number[][],
    B: number[][],
    lambda: number[],
): number[][] {
    const delta = veraDelta(A, B, lambda);
    return baseWeight.map((row, i) => row.map((w, o) => w + (delta[i]?.[o] ?? 0)));
}

function makeCells(delta: number[][], revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const cols = delta[0]?.length ?? 0;
    for (let i = 0; i < delta.length; i += 1) {
        for (let o = 0; o < cols; o += 1) {
            const value = delta[i]![o] ?? 0;
            const shown = i <= revealed;
            entities.push({
                id: `cell-${i}-${o}`,
                type: "cell",
                label: shown ? `W[${i},${o}] update ${value.toFixed(4)}` : "?",
                value: shown ? value : 0,
                state: (i === revealed ? "comparing" : shown ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: o },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { dim?: number; rank?: number; dout?: number; seed?: number; lambda?: number[] } | null
    ) ?? {};
    const dim = typeof task.dim === "number" ? Math.max(1, Math.floor(task.dim)) : 5;
    const rank = typeof task.rank === "number" ? Math.max(1, Math.floor(task.rank)) : 2;
    const dout = typeof task.dout === "number" ? Math.max(1, Math.floor(task.dout)) : 4;
    const seed = typeof task.seed === "number" ? task.seed : 11;
    const lambda: number[] =
        Array.isArray(task.lambda) && task.lambda.length > 0
            ? task.lambda
            : Array.from({ length: rank }, (_, k) => (k + 1) * 0.1);
    const { A, B } = veraRandomMatrices(dim, rank, dout, seed);
    const delta = veraDelta(A, B, lambda);
    const metaBase = { rows: dim, cols: dout, rank, trainable: lambda.length };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(delta, -1),
        edges: [],
        description: `VeRA freezes random A (${dim}x${rank}) and B (${rank}x${dout}) and trains only ${lambda.length} scaling values.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { ...metaBase, lambda },
    };
    step += 1;

    for (let i = 0; i < dim; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(delta, i),
            edges: [],
            description: `Row ${i}: effective update is the sum over ${rank} terms of B[k] times lambda[k] times A[i][k].`,
            codeLineNumber: i % 2 === 0 ? 2 : 3,
            layout: "matrix",
            meta: { ...metaBase, current: i, lambda },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(delta, dim - 1),
        edges: [],
        description: `Done: ${lambda.length} trainable scales shape a full ${dim}x${dout} update of effective rank at most ${rank}.`,
        codeLineNumber: 5,
        layout: "matrix",
        meta: { ...metaBase, converged: true, lambda, delta: JSON.stringify(delta) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "LoRA adapts a model by training two low-rank matrices for every weight. VeRA goes further: it draws those matrices randomly once and freezes them, then trains only a short scaling vector that reweights their rank directions. The number of trainable parameters drops from thousands per layer to a handful, yet the effective update is still a rich combination of the random directions.",
        invariants: [
            "The random matrices A and B never change during training.",
            "The effective update has rank at most r, the shared inner dimension.",
            "Setting every scale to zero gives the identity adaptation, leaving the base weights untouched.",
        ],
        correctness:
            "The update is defined as B diag(lambda) A, and the implementation sums exactly that triple product for each output entry. The tests recompute the update with an explicit nested loop, verify that scaling by a constant scales the whole update linearly, check the zero-scale identity, and confirm the rank bound using the rank-one case where all rows are proportional. Forward addition to the base weight is a plain elementwise sum.",
        complexityRationale:
            "Forming the d by dout update sums r products per entry, costing O(d * r * dout). The frozen matrices use O(r * (d + dout)) space and the materialized update uses O(d * dout).",
        uses: [
            "Parameter-efficient fine-tuning of large language models",
            "Adapting many layers under a tight memory budget",
            "Serving many personalized models from one shared backbone",
        ],
        references: [
            "Kopiczko et al., VeRA: Vector-based Random Matrix Adaptation, ICLR 2024",
            "Hu et al., LoRA: Low-Rank Adaptation of Large Language Models, ICLR 2022",
        ],
        workedExample:
            "With a 2 by 1 random matrix A, a 1 by 2 random matrix B and scale lambda of 0.5, the update at entry (0, 0) is B[0][0] * 0.5 * A[0][0]. Because the inner rank is one, every row of the update is a multiple of the same vector, so changing lambda scales the entire update uniformly.",
    },
    id: "vera",
    name: "VeRA Low-Rank Adaptation",
    category: "ml-ai",
    complexity: { time: "O(d * r * dout)", space: "O(d * dout)" },
    defaultInput: { dim: 5, rank: 2, dout: 4, seed: 11, lambda: [0.1, 0.2] },
    visualType: "matrix",
    run,
    pseudocode: [
        "draw random matrices A and B and freeze them",
        "initialize a short trainable scaling vector",
        "for each entry of the weight update",
        "sum over rank directions of B times scale times A",
        "add the resulting delta to the frozen base weight",
        "done: report the effective low-rank update",
    ],
};

export default module;
