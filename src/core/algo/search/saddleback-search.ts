/**
 * saddleback-search.ts – Saddleback Search
 *
 * Searches a row- and column-sorted matrix from the top-right corner:
 * move left when the cell is too big, down when too small. The verified
 * hit goes green with metadata.row/col.
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; target?: number } | null) ?? {};
    const matrix = Array.isArray(task.matrix)
        ? (task.matrix as number[][]).map((row) => [...row])
        : [
              [1, 4, 7, 10],
              [2, 5, 8, 11],
              [3, 6, 9, 12],
          ];
    const target = typeof task.target === "number" ? task.target : 5;
    let step = 0;
    let comparisons = 0;
    const rows = matrix.length;
    const cols = rows > 0 ? ((matrix[0] as number[]).length ?? 0) : 0;

    yield {
        stepNumber: step,
        entities: makeCells(matrix),
        edges: [],
        description: `Saddleback search for ${target} from the top-right corner.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { comparisons, target },
    };
    step += 1;
    if (rows === 0 || cols === 0) {
        yield {
            stepNumber: step,
            entities: makeCells(matrix),
            edges: [],
            description: "Empty matrix – nothing to search.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { comparisons, target },
        };
        return;
    }
    let r = 0;
    let c = cols - 1;
    while (r < rows && c >= 0 && step < 12) {
        const value = matrix[r]?.[c];
        if (value === undefined) break;
        comparisons += 1;
        if (value === target) {
            yield {
                stepNumber: step,
                entities: makeCells(matrix, new Map([[`${r},${c}`, "sorted"]])),
                edges: [],
                description: `Found ${target} at (${r},${c}) after ${comparisons} comparisons.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { comparisons, target, found: [r, c] },
            };
            return;
        }
        const next = value > target ? [r, c - 1] : [r + 1, c];
        yield {
            stepNumber: step,
            entities: makeCells(matrix, new Map([[`${r},${c}`, "comparing"]])),
            edges: [],
            description: `${value} at (${r},${c}) is too ${value > target ? "big – moving left" : "small – moving down"}.`,
            codeLineNumber: value > target ? 1 : 2,
            layout: "grid",
            meta: { comparisons, target },
        };
        step += 1;
        r = next[0] as number;
        c = next[1] as number;
    }
    yield {
        stepNumber: step,
        entities: makeCells(matrix),
        edges: [],
        description: `${target} is not in the matrix – walked off the edge.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { comparisons, target },
    };
}

const module: AlgorithmModule = {
    id: "saddleback-search",
    name: "Saddleback Search",
    category: "searching",
    complexity: { time: "O(n + m)", space: "O(1)" },
    defaultInput: {
        matrix: [
            [1, 4, 7, 10],
            [2, 5, 8, 11],
            [3, 6, 9, 12],
        ],
        target: 5,
    },
    visualType: "grid",
    run,
};

export default module;
