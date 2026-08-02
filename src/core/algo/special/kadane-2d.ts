/**
 * kadane-2d.ts – Kadane's Algorithm (2D maximum submatrix sum)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The 2D Kadane finds the maximum-sum sub-rectangle of a matrix. It fixes a
 * pair of columns, compresses the rows between them into a 1D array of column
 * sums, and runs the classic 1D Kadane on that array. Trying every column
 * pair costs O(cols² · rows).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rows · cols²)
 *   Space: O(rows)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The compressed row-sum array is shown.
 *   - The best sub-rectangle is highlighted GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Reduce 2D to repeated 1D" is the entire idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a matrix of cells for the input grid.
 *
 * @param grid The 2D grid.
 * @param highlight Cells to highlight (row,col) in the best rectangle.
 * @returns Cell entities with row/col metadata.
 */
function makeGrid(
    grid: number[][],
    highlight: Set<string> = new Set(),
    active: string | null = null,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    grid.forEach((row, r) => {
        row.forEach((value, c) => {
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: highlight.has(`${r},${c}`)
                    ? "sorted"
                    : active === `${r},${c}`
                      ? "comparing"
                      : ("unvisited" as EntityState),
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        });
    });
    return cells;
}

/**
 * The Kadane 2D generator.
 *
 * @param input `{ grid }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { grid?: number[][] } | null) ?? {};
    const grid: number[][] = task.grid ?? [
        [1, 2, -1],
        [-3, 4, 2],
        [1, -5, 3],
    ];

    const rows = grid.length;
    const cols = rows > 0 ? (grid[0]?.length ?? 0) : 0;
    let step = 0;

    // Frame 0: the grid.
    yield {
        stepNumber: step,
        entities: makeGrid(grid),
        edges: [],
        description: "2D Kadane – finding the maximum-sum sub-rectangle.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols },
    };
    step += 1;

    let best = -Infinity;
    let bestRect: string[] = [];

    // Fix the left column.
    for (let left = 0; left < cols; left += 1) {
        // Row-sum array for columns left..right.
        const rowSums = new Array<number>(rows).fill(0);

        for (let right = left; right < cols; right += 1) {
            // Accumulate the right column into the row sums.
            for (let r = 0; r < rows; r += 1) {
                rowSums[r] = (rowSums[r] ?? 0) + (grid[r]?.[right] ?? 0);
            }

            // Run 1D Kadane on rowSums.
            let bestHere = -Infinity;
            let bestEnd = 0;
            let start = 0;
            let runStart = 0;
            for (let r = 0; r < rows; r += 1) {
                const value = rowSums[r] ?? 0;
                if (bestHere + value > value) {
                    bestHere += value;
                } else {
                    bestHere = value;
                    runStart = r;
                }
                if (bestHere > bestEnd) {
                    bestEnd = bestHere;
                    start = runStart;
                }
            }

            if (bestEnd > best) {
                best = bestEnd;
                bestRect = [];
                for (let r = start; r < rows; r += 1) {
                    for (let c = left; c <= right; c += 1) {
                        bestRect.push(`${r},${c}`);
                    }
                }
            }

            // Show the current window being compressed.
            const active = `${0},${right}`;
            yield {
                stepNumber: step,
                entities: makeGrid(grid, new Set(), active),
                edges: [],
                description: `Columns [${left}..${right}] compressed – best so far ${best}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { rows, cols, best },
            };
            step += 1;
        }
    }

    const highlight = new Set(bestRect);
    yield {
        stepNumber: step,
        entities: makeGrid(grid, highlight),
        edges: [],
        description: `Maximum submatrix sum = ${best}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows, cols, best },
    };
}

/** The Kadane 2D module, registered with the engine. */
const module: AlgorithmModule = {
    id: "kadane-2d",
    name: "Kadane (2D)",
    category: "dynamic-programming",
    complexity: { time: "O(rows·cols²)", space: "O(rows)" },
    defaultInput: {
        grid: [
            [1, 2, -1],
            [-3, 4, 2],
            [1, -5, 3],
        ],
    },
    visualType: "grid",
    run,
};

export default module;
