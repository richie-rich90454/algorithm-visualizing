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
 * Visualization mapping
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

    // Edge case: empty grid.
    if (rows === 0 || cols === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Empty grid – no sub-rectangle exists.",
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows, cols, best: 0 },
        };
        return;
    }

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

            // Run 1D Kadane on rowSums, tracking the winning row interval.
            let colBest = -Infinity;
            let colStart = 0;
            let colEnd = -1;
            let runSum = -Infinity;
            let runStart = 0;
            for (let r = 0; r < rows; r += 1) {
                const value = rowSums[r] ?? 0;
                if (runSum + value > value) {
                    runSum += value;
                } else {
                    runSum = value;
                    runStart = r;
                }
                if (runSum > colBest) {
                    colBest = runSum;
                    colStart = runStart;
                    colEnd = r;
                }
            }

            if (colBest > best) {
                best = colBest;
                bestRect = [];
                for (let r = colStart; r <= colEnd; r += 1) {
                    for (let c = left; c <= right; c += 1) {
                        bestRect.push(`${r},${c}`);
                    }
                }
            }

            // Show the current window being compressed, keeping the best
            // rectangle so far highlighted.
            const active = `${0},${right}`;
            yield {
                stepNumber: step,
                entities: makeGrid(grid, new Set(bestRect), active),
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

    education: {
        "intuition": "2D Kadane finds the maximum-sum rectangle in a matrix by reducing the problem to repeated 1D Kadane scans. It fixes a left and right column, collapses the rows between them into a single array of row sums, and runs classic Kadane on that array. Trying every column pair finds the best rectangle overall.",
        "invariants": [
            "For a fixed column pair, rowSums[r] equals the sum of row r across the chosen columns.",
            "1D Kadane on rowSums returns the best row interval for the current column band.",
            "best holds the largest rectangle sum seen over all processed column pairs."
        ],
        "correctness": "A rectangle is determined by a left column, right column, top row and bottom row. For a fixed column pair, compressing to row sums turns the choice of top and bottom rows into a maximum-subarray problem, which 1D Kadane solves optimally. Enumerating every column pair therefore examines all rectangles, so the maximum found is global.",
        "complexityRationale": "There are O(cols^2) column pairs, and each is built and scanned in O(rows) time, giving O(rows·cols^2) total. The only auxiliary storage is the rowSums array of length rows, O(rows) space.",
        "uses": [
            "Finding the brightest rectangular region in an image",
            "Two-dimensional maximum-profit and submatrix problems",
            "Geospatial analysis of maximum-sum grid regions",
            "Computer vision and financial matrix analysis"
        ],
        "references": [
            "Bentley, Programming Pearls, Column 7",
            "Cormen et al., Introduction to Algorithms (CLRS), Chapter 4"
        ],
        "workedExample": "For the module's 3x3 grid, fixing columns 0..1 gives row sums [3,1,-4] and a best of 4. Fixing columns 1..2 gives row sums [1,6,-2], whose 1D Kadane returns 7 from rows 0..1. The best rectangle is those two rows and columns 1..2, with sum 2+(-1)+4+2=7."
    },
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
    pseudocode: [
        "initialize grid with rows and columns loaded",
        "for left column boundary across the grid",
        "for right column compress rows into 1D sums",
        "run 1D Kadane over the compressed rows",
        "remember best sum with its rectangle bounds",
        "scan all column pairs for maximum",
        "done: maximum submatrix sum with location",
    ],
};

export default module;
