/**
 * kth-in-sorted-matrix-search.ts – Kth Smallest in Sorted Matrix
 *
 * Binary-searches the value range: count elements ≤ mid per row and
 * keep the half holding k. Cells carry metadata.row/col; the verified
 * answer goes green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        const row = matrix[r] as number[];
        for (let c = 0; c < row.length; c += 1) {
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(row[c]),
                value: row[c] as number,
                state: states.get(`${r},${c}`) ?? "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return cells;
}

function countLE(matrix: number[][], mid: number): number {
    let total = 0;
    for (const row of matrix) {
        for (const v of row) {
            if (v <= mid) total += 1;
        }
    }
    return total;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; k?: number } | null) ?? {};
    const matrix = Array.isArray(task.matrix)
        ? (task.matrix as number[][]).map((row) => [...row])
        : [
              [1, 5, 9],
              [10, 11, 13],
              [12, 13, 15],
          ];
    const flat = matrix.flat();
    const k =
        typeof task.k === "number" && task.k >= 1
            ? Math.min(Math.floor(task.k), Math.max(flat.length, 1))
            : 5;
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeCells(matrix),
        edges: [],
        description: `K=${k} smallest in a row/column-sorted matrix.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { comparisons, k },
    };
    step += 1;
    if (flat.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells(matrix),
            edges: [],
            description: "Empty matrix – no k-th element exists.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { comparisons, k },
        };
        return;
    }
    let lo = Math.min(...flat);
    let hi = Math.max(...flat);
    while (lo < hi && step < 11) {
        const mid = Math.floor((lo + hi) / 2);
        const cnt = countLE(matrix, mid);
        comparisons += flat.length;
        yield {
            stepNumber: step,
            entities: makeCells(matrix),
            edges: [],
            description: `mid=${mid}: ${cnt} element(s) ≤ mid – k=${k} is ${cnt < k ? "above" : "at or below"}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { comparisons, k, mid },
        };
        step += 1;
        if (cnt < k) lo = mid + 1;
        else hi = mid;
    }
    const verified = [...flat].sort((x, y) => x - y)[k - 1] as number;
    const states = new Map<string, EntityState>();
    for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < (matrix[r] as number[]).length; c += 1) {
            if (matrix[r]?.[c] === verified && !states.has(`${r},${c}`)) {
                states.set(`${r},${c}`, "sorted");
                break;
            }
        }
        if (states.size > 0) break;
    }
    yield {
        stepNumber: step,
        entities: makeCells(matrix, states),
        edges: [],
        description: `${k}-th smallest is ${verified} (range narrowed to ${lo}).`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { comparisons, k, answer: verified },
    };
}

const module: AlgorithmModule = {
    id: "kth-in-sorted-matrix-search",
    name: "Kth Smallest in Sorted Matrix",
    category: "searching",
    complexity: { time: "O(n log(max−min))", space: "O(1)" },
    defaultInput: {
        matrix: [
            [1, 5, 9],
            [10, 11, 13],
            [12, 13, 15],
        ],
        k: 5,
    },
    visualType: "grid",
    run,
};

export default module;
