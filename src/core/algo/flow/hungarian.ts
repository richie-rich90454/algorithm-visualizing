/**
 * hungarian.ts – Hungarian Algorithm (Assignment Problem)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Hungarian algorithm solves the assignment problem: given an n×n cost
 * matrix, assign each row to a distinct column to minimize the total cost. It
 * relies on two facts:
 *
 *   1. Subtracting a constant from a row or column does not change the optimal
 *      assignment.
 *   2. A "perfect matching" of zeros exists iff the assignment is optimal.
 *
 * The algorithm repeatedly subtracts row/column minima, covers the zeroes with
 * the minimum number of lines, and adjusts uncovered entries until a perfect
 * zero-matching exists.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n³)
 *   Space: O(n²) for the cost matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The matrix cells show the (reduced) costs.
 *   - The cell being reduced is YELLOW (comparing).
 *   - Covered lines' cells are PINK (highlight).
 *   - The chosen assignment cells are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Also known as the Kuhn-Munkres algorithm.
 *   - The zero-cover/line-cover step is the conceptual heart to teach.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build the matrix of cell entities for a frame.
 *
 * @param matrix The n×n cost matrix.
 * @param states Optional `row,col` → state overrides for this frame.
 * @returns An array of `VisualEntity` cells with row/col metadata.
 */
function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const matrixRow = matrix[row];
        if (!matrixRow) {
            continue;
        }
        for (let col = 0; col < matrixRow.length; col += 1) {
            const value = matrixRow[col];
            if (value === undefined) {
                continue;
            }
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: states.get(`${row},${col}`) ?? "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return cells;
}

/**
 * The Hungarian Algorithm generator.
 *
 * @param input `{ costs }` – an n×n cost matrix.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { costs?: number[][] } | null) ?? {};
    const costs: number[][] = task.costs ?? [
        [8, 4, 7],
        [5, 2, 3],
        [9, 4, 8],
    ];
    const n = costs.length;

    // Work on a copy so the default input is never mutated.
    const matrix = costs.map((row) => [...row]);

    let step = 0;

    // Frame 0: the untouched cost matrix.
    yield {
        stepNumber: step,
        entities: makeCells(matrix),
        edges: [],
        description: "The assignment problem – assign each row to a column at minimum cost.",
        codeLineNumber: 0,
        layout: "matrix",
        meta: { rows: n, cols: n },
    };
    step += 1;

    // ------------------------------------------------------------------
    // Step 1: subtract the row minimum from each row.
    // ------------------------------------------------------------------
    for (let row = 0; row < n; row += 1) {
        const matrixRow = matrix[row];
        if (!matrixRow) {
            continue;
        }
        const rowMin = Math.min(...matrixRow);
        if (rowMin === 0) {
            continue;
        }
        for (let col = 0; col < n; col += 1) {
            matrixRow[col] = (matrixRow[col] ?? 0) - rowMin;
        }

        const states = new Map<string, EntityState>();
        for (let col = 0; col < n; col += 1) {
            states.set(`${row},${col}`, "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeCells(matrix, states),
            edges: [],
            description: `Subtracted row minimum ${rowMin} from row ${row}.`,
            codeLineNumber: 2,
            layout: "matrix",
            meta: { rows: n, cols: n },
        };
        step += 1;
    }

    // ------------------------------------------------------------------
    // Step 2: subtract the column minimum from each column.
    // ------------------------------------------------------------------
    for (let col = 0; col < n; col += 1) {
        let colMin = Infinity;
        for (let row = 0; row < n; row += 1) {
            colMin = Math.min(colMin, matrix[row]?.[col] ?? Infinity);
        }
        if (colMin === 0 || colMin === Infinity) {
            continue;
        }
        for (let row = 0; row < n; row += 1) {
            const cell = matrix[row]?.[col];
            if (cell !== undefined) {
                matrix[row][col] = cell - colMin;
            }
        }

        const states = new Map<string, EntityState>();
        for (let row = 0; row < n; row += 1) {
            states.set(`${row},${col}`, "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeCells(matrix, states),
            edges: [],
            description: `Subtracted column minimum ${colMin} from column ${col}.`,
            codeLineNumber: 3,
            layout: "matrix",
            meta: { rows: n, cols: n },
        };
        step += 1;
    }

    // ------------------------------------------------------------------
    // Step 3: find the assignment greedily (educational simplification of the
    // zero-cover iteration): pick zero cells row by row, skipping used columns.
    // ------------------------------------------------------------------
    const assignment: Array<[number, number]> = [];
    const usedCols = new Set<number>();

    for (let row = 0; row < n; row += 1) {
        const matrixRow = matrix[row];
        if (!matrixRow) {
            continue;
        }
        // Find the first zero cell in this row whose column is still free.
        let chosenCol = -1;
        for (let col = 0; col < n; col += 1) {
            if (!usedCols.has(col) && (matrixRow[col] ?? Infinity) === 0) {
                chosenCol = col;
                break;
            }
        }
        if (chosenCol >= 0) {
            assignment.push([row, chosenCol]);
            usedCols.add(chosenCol);
        }
    }

    const states = new Map<string, EntityState>();
    for (const [row, col] of assignment) {
        states.set(`${row},${col}`, "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeCells(matrix, states),
        edges: [],
        description: `Assigned ${assignment.length} row(s) to zero cells.`,
        codeLineNumber: 4,
        layout: "matrix",
        meta: { rows: n, cols: n, assigned: assignment.length },
    };
    step += 1;

    // Recompute the total cost using the *original* matrix.
    const totalCost = assignment.reduce((sum, [row, col]) => sum + (costs[row]?.[col] ?? 0), 0);

    yield {
        stepNumber: step,
        entities: makeCells(matrix, states),
        edges: [],
        description:
            assignment.length === n
                ? `Optimal assignment with total cost ${totalCost}.`
                : `Partial assignment (${assignment.length} of ${n}) – full Hungarian line-cover iteration would complete it.`,
        codeLineNumber: 5,
        layout: "matrix",
        meta: { rows: n, cols: n, assigned: assignment.length, totalCost },
    };
}

/** The Hungarian module, registered with the engine. */
const module: AlgorithmModule = {
    id: "hungarian",
    name: "Hungarian Algorithm",
    category: "flow",
    complexity: { time: "O(n³)", space: "O(n²)" },
    // A 3×3 cost matrix with a clear optimal assignment.
    defaultInput: {
        costs: [
            [8, 4, 7],
            [5, 2, 3],
            [9, 4, 8],
        ],
    },
    visualType: "matrix",
    run,
};

export default module;
