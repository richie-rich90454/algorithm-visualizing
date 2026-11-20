/**
 * dora.ts - Weight-Decomposed Low-Rank Adaptation (Teachable Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DoRA splits a weight matrix into a per-column magnitude vector and a
 * direction matrix whose columns have unit norm. Fine-tuning updates the
 * direction with a low-rank product B times A and updates the magnitude with
 * a separate vector, then recombines them by rescaling each direction column
 * to the new magnitude. This module performs that decomposition and
 * recombination exactly on a tiny matrix with deterministic updates.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(dOut * dIn * r) for the low-rank product at rank r
 *   Space: O(dOut * dIn) for the weight and direction matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the original weight, unit direction, low-rank update,
 *     and recomposed weight in successive frames.
 *   - Magnitudes and column norms are reported in metadata.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface DoraInput {
    weight?: number[][];
    rank?: number;
    seed?: number;
}

function weightStream(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return Math.round(((state / 4294967296) * 2 - 1) * 100) / 100;
    };
}

function matrixCells(matrix: number[][]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < (matrix[row]?.length ?? 0); col += 1) {
            const value = matrix[row]?.[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: value.toFixed(3),
                value,
                state: "comparing" as const,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DoraInput | null) ?? {};
    const rows = Array.isArray(task.weight) && task.weight.length > 0
        ? task.weight.map((row) => [...row])
        : [
              [3, 0, 1],
              [0, 4, 2],
              [1, 2, 5],
          ];
    const dOut = rows.length;
    const dIn = rows[0]?.length ?? 3;
    const rank = Math.max(1, typeof task.rank === "number" ? Math.trunc(task.rank) : 1);
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 5;
    const next = weightStream(seed);

    const magnitude = Array.from({ length: dIn }, (_unused, col) =>
        Math.sqrt(rows.reduce((s, row) => s + (row[col] ?? 0) ** 2, 0)) || 1,
    );
    const direction = rows.map((row) => row.map((value, col) => value / (magnitude[col] ?? 1)));
    const A = Array.from({ length: rank }, () => Array.from({ length: dIn }, next));
    const B = Array.from({ length: dOut }, () => Array.from({ length: rank }, next));
    const deltaM = Array.from({ length: dIn }, next);
    const deltaV = Array.from({ length: dOut }, (_unused, r) =>
        Array.from({ length: dIn }, (_v, c) =>
            (B[r] ?? []).reduce((s, b, k) => s + b * (A[k]?.[c] ?? 0), 0),
        ),
    );
    const updatedDirection = direction.map((row, r) => row.map((value, c) => value + (deltaV[r]?.[c] ?? 0)));
    const newMagnitude = magnitude.map((m, c) => m + (deltaM[c] ?? 0));
    const finalWeight = updatedDirection.map((row) =>
        row.map((value, c) => {
            const norm = Math.sqrt(updatedDirection.reduce((s, rr) => s + (rr[c] ?? 0) ** 2, 0)) || 1;
            return (newMagnitude[c] ?? 0) * (value / norm);
        }),
    );
    const columnNorms = Array.from({ length: dIn }, (_unused, c) =>
        Math.sqrt(finalWeight.reduce((s, row) => s + (row[c] ?? 0) ** 2, 0)),
    );

    const meta = {
        rows: dOut,
        cols: dIn,
        rank,
        magnitude,
        deltaM,
        direction: direction.flat(),
        deltaV: deltaV.flat(),
        newMagnitude,
    };
    const frames: Array<{ matrix: number[][]; phase: string; description: string; line: number }> = [
        {
            matrix: rows,
            phase: "weight",
            description: `Original weight matrix is ${dOut} by ${dIn}.`,
            line: 0,
        },
        {
            matrix: direction,
            phase: "decompose",
            description: `Split into magnitude (${magnitude.map((m) => m.toFixed(3)).join(", ")}) and unit columns.`,
            line: 1,
        },
        {
            matrix: deltaV,
            phase: "update",
            description: `Low-rank update B times A of rank ${rank} changes the direction; a separate vector changes the magnitude.`,
            line: 3,
        },
        {
            matrix: finalWeight,
            phase: "recompose",
            description: `Recomposed weight has column norms ${columnNorms.map((n) => n.toFixed(3)).join(", ")}.`,
            line: 5,
        },
    ];
    yield {
        stepNumber: 0,
        entities: matrixCells(rows),
        edges: [],
        description: frames[0]?.description ?? "",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...meta, phase: "weight", finalWeight: [], columnNorms: [] },
    };
    yield {
        stepNumber: 1,
        entities: matrixCells(direction),
        edges: [],
        description: frames[1]?.description ?? "",
        codeLineNumber: 1,
        layout: "grid",
        meta: { ...meta, phase: "decompose", finalWeight: [], columnNorms: [] },
    };
    yield {
        stepNumber: 2,
        entities: matrixCells(deltaV),
        edges: [],
        description: frames[2]?.description ?? "",
        codeLineNumber: 3,
        layout: "grid",
        meta: { ...meta, phase: "update", deltaM, finalWeight: [], columnNorms: [] },
    };
    yield {
        stepNumber: 3,
        entities: matrixCells(finalWeight),
        edges: [],
        description: frames[3]?.description ?? "",
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...meta, phase: "recompose", finalWeight: finalWeight.flat(), columnNorms },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A low-rank adapter changes a weight by a thin product of two matrices, but that couples the size of a change to its direction. DoRA first separates how large each column of the weight is from which way it points. It then learns a small change to the direction and a separate change to the magnitude, and puts them back together so each updated column has exactly the requested length.",
        invariants: [
            "Each direction column has unit norm before the update.",
            "The low-rank direction change is B times A with the chosen rank.",
            "After recombination the norm of each weight column equals its new magnitude.",
        ],
        correctness:
            "Decomposition divides each column by its norm, so a column of the direction has norm one. Recombination divides each updated direction column by its norm and multiplies by the updated magnitude, which forces the resulting column norm to equal that magnitude. With both updates set to zero, the recombination returns the original weight exactly, confirming that the two steps are inverses up to the learned changes.",
        complexityRationale:
            "Forming B times A costs O(dOut times dIn times rank), and normalizing and rescaling columns costs O(dOut times dIn). The stored matrices are the weight, its direction, the low-rank factors, and the magnitude vector, all O(dOut times dIn) space.",
        uses: [
            "Parameter-efficient fine-tuning of large language models",
            "Adapting vision transformers to new tasks with few trainable weights",
            "Multi-task serving with many lightweight adapters",
        ],
        references: [
            "Liu et al., DoRA: Weight-Decomposed Low-Rank Adaptation, 2024",
            "Hu et al., LoRA: Low-Rank Adaptation of Large Language Models, 2021",
        ],
        workedExample:
            "For a single column (3, 0, 4) the magnitude is 5 and the direction is (0.6, 0, 0.8), which has norm one. If the learned magnitude becomes 6 and the direction changes slightly, recombination rescales the updated direction to norm one and multiplies by 6, so the new column has length 6.",
    },
    id: "dora",
    name: "Weight-Decomposed Low-Rank Adaptation (DoRA, Teachable Core)",
    category: "ml-ai",
    complexity: { time: "O(dOut * dIn * r)", space: "O(dOut * dIn)" },
    defaultInput: {
        weight: [
            [3, 0, 1],
            [0, 4, 2],
            [1, 2, 5],
        ],
        rank: 1,
        seed: 5,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start from a pretrained weight matrix W",
        "compute each column magnitude m and unit direction V",
        "form the low-rank direction update B times A",
        "form the separate magnitude update delta m",
        "add the updates to get V prime and m prime",
        "normalize each column of V prime to unit length",
        "scale each column by its new magnitude to rebuild W prime",
        "done: report the recomposed weight and its column norms",
    ],
};

export default module;
