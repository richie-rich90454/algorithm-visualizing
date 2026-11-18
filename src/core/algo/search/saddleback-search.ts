/**
 * saddleback-search.ts – Saddleback Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Searches a row- and column-sorted matrix in linear time by starting at the
 * top-right corner, the saddle point of the ordering. If the current cell is
 * too big, everything below it is even bigger, so move left; if too small,
 * everything to its left is even smaller, so move down. Each step eliminates
 * a full row or column, and walking off the edge proves the target absent.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rows + cols) – one row or column discarded per comparison
 *   Space: O(1) auxiliary – only the current row and column
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The cell under test is YELLOW (comparing).
 *   - The confirmed hit turns GREEN (sorted) with metadata.row/col.
 *   - A miss ends all IDLE after the walk leaves the grid.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires rows and columns sorted ascending; also called staircase search.
 *   - Eliminates a row or column per step – no backtracking, ever.
 *   - Starting from the bottom-left corner works symmetrically.
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
            description: "Empty matrix holds no cells, so there is nothing to search.",
            codeLineNumber: 5,
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
                codeLineNumber: 2,
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
            codeLineNumber: value > target ? 3 : 4,
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
        codeLineNumber: 5,
        layout: "grid",
        meta: { comparisons, target },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Saddleback search starts at the top-right corner of a row- and column-sorted matrix. If the current cell is too large, moving left is the only option; if too small, moving down is the only option. Each step eliminates a whole row or column.",
        "invariants": [
            "Everything below the current cell in its column is at least the current value.",
            "Everything left of the current cell in its row is at most the current value."
        ],
        "correctness": "A too-large cell rules out the rest of its column below; a too-small cell rules out the rest of its row to the left. Walking off the grid means every possible location was eliminated, so the target is absent.",
        "complexityRationale": "Each comparison removes one row or one column, so at most rows + cols steps, O(rows + cols) time, with only two indices, O(1) space.",
        "uses": [
            "Searching multiplication tables and sorted grids",
            "Teaching monotone-matrix search",
            "Database range queries on ordered indexes"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 6.2.1 (searching)",
            "Sedgewick and Wayne, Algorithms, Section 1.1 exercises"
        ],
        "workedExample": "In a grid sorted by row and column, start at the top-right value; if it exceeds the target go left, if below go down. For a small matrix and target 6 the walk lands exactly on 6 after a few moves."
    },
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
    pseudocode: [
        "start at the top-right corner with row ← 0 and col ← cols-1",
        "while inside the grid: compare the current cell with target",
        "if cell = target: return its (row, col) as the match",
        "if cell > target: col ← col-1 to discard the whole column",
        "if cell < target: row ← row+1 to discard the whole row",
        "done: walked off the edge, so report target absent",
    ],
};

export default module;
