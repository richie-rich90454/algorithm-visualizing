/**
 * longest-increasing-path-dp.ts - Longest Increasing Path in a Grid
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a grid of numbers, a path may move up, down, left, or right, but it may
 * only step onto a strictly larger value. This module finds the length of the
 * longest such path. Because edges always go from a smaller value to a larger
 * one, the grid is a directed acyclic graph: visiting cells in increasing
 * value order lets each cell reuse the answers already computed for its
 * smaller neighbors, and a stored best-neighbor pointer rebuilds one optimal
 * path.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(R * C) after sorting the cells, plus O(R * C log(R * C)) to sort
 *   Space: O(R * C) for the memo table and path pointers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid cell shows its numeric value.
 *   - The cell currently being solved is blue (active).
 *   - Solved cells are green; neighbors feeding the current cell are yellow.
 *   - The final frame paints one longest path with the path state.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Grid = number[][];

function makeCells(
    grid: Grid,
    dp: number[][],
    states: Map<string, EntityState>,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < grid.length; r += 1) {
        for (let c = 0; c < (grid[r]?.length ?? 0); c += 1) {
            const key = `${r},${c}`;
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(grid[r]?.[c] ?? 0),
                value: grid[r]?.[c] ?? 0,
                state: states.get(key) ?? "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, length: dp[r]?.[c] ?? 0 },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { grid?: Grid } | null) ?? {};
    const grid: Grid = Array.isArray(input)
        ? (input as Grid)
        : [...(task.grid ?? [
              [1, 2, 3],
              [6, 5, 4],
              [7, 8, 9],
          ])];
    const rows = grid.length;
    const cols = rows > 0 ? (grid[0]?.length ?? 0) : 0;

    const dp: number[][] = grid.map((row) => row.map(() => 1));
    const next: number[][] = grid.map((row) => row.map(() => -1));
    const states = new Map<string, EntityState>();

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(grid, dp, states),
        edges: [],
        description: `Grid with ${rows} rows and ${cols} columns - every cell starts with a path length of 1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, best: 0, cellsComputed: 0 },
    };
    step += 1;

    if (rows === 0 || cols === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Empty grid - the longest increasing path has length 0.",
            codeLineNumber: 6,
            layout: "grid",
            meta: { rows, cols, best: 0, cellsComputed: 0 },
        };
        return;
    }

    const order: Array<{ r: number; c: number; value: number }> = [];
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            order.push({ r, c, value: grid[r]?.[c] ?? 0 });
        }
    }
    order.sort((a, b) => a.value - b.value);

    let best = 1;
    let bestKey = "0,0";
    let cellsComputed = 0;
    const directions: Array<[number, number]> = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
    ];

    for (const cell of order) {
        const key = `${cell.r},${cell.c}`;
        states.set(key, "active");
        yield {
            stepNumber: step,
            entities: makeCells(grid, dp, states),
            edges: [],
            description: `Solving cell (${cell.r}, ${cell.c}) with value ${cell.value} - checking smaller neighbors.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows, cols, best, cellsComputed },
        };
        step += 1;

        for (const [dr, dc] of directions) {
            const nr = cell.r + dr;
            const nc = cell.c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                continue;
            }
            const neighborValue = grid[nr]?.[nc] ?? 0;
            if (neighborValue >= cell.value) {
                continue;
            }
            const candidate = (dp[nr]?.[nc] ?? 0) + 1;
            if (candidate > (dp[cell.r]?.[cell.c] ?? 0)) {
                dp[cell.r]![cell.c] = candidate;
                next[cell.r]![cell.c] = nr * cols + nc;
                states.set(`${nr},${nc}`, "highlight");
            }
        }

        states.set(key, "sorted");
        if ((dp[cell.r]?.[cell.c] ?? 0) > best) {
            best = dp[cell.r]?.[cell.c] ?? 1;
            bestKey = key;
        }
        cellsComputed += 1;
        yield {
            stepNumber: step,
            entities: makeCells(grid, dp, states),
            edges: [],
            description: `Cell (${cell.r}, ${cell.c}) has longest increasing path length ${dp[cell.r]?.[cell.c]}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { rows, cols, best, cellsComputed },
        };
        step += 1;
    }

    // Rebuild one optimal path by following the stored best-neighbor pointers.
    let cursor = bestKey;
    while (cursor !== "") {
        states.set(cursor, "path");
        const [rText, cText] = cursor.split(",");
        const r = Number(rText);
        const c = Number(cText);
        const pointer = next[r]?.[c] ?? -1;
        if (pointer < 0) {
            break;
        }
        cursor = `${Math.floor(pointer / cols)},${pointer % cols}`;
    }

    yield {
        stepNumber: step,
        entities: makeCells(grid, dp, states),
        edges: [],
        description: `Longest increasing path has length ${best}, starting from cell ${bestKey}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows, cols, best, cellsComputed },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An increasing path never revisits a value, because each step must go up. Treat every smaller four-direction neighbor as a predecessor pointing into the current cell. If cells are processed from the smallest value to the largest, each cell can read finished answers from its smaller neighbors and extend the best one by one.",
        invariants: [
            "Every move goes from a smaller value to a strictly larger value, so the graph is acyclic.",
            "dp[r][c] is the longest increasing path starting at cell (r, c).",
            "The stored pointer for a cell leads to a neighbor whose memo value is dp[r][c] - 1.",
        ],
        correctness:
            "Any increasing path from a cell must take its first step to one of its smaller neighbors. The best such path is one plus the best path from that neighbor. Processing cells in increasing value order guarantees every smaller neighbor is already solved, so the recurrence considers all and only valid first steps; taking the maximum gives the true longest path.",
        complexityRationale:
            "Sorting the R * C cells costs O(R C log(R C)), and each cell examines four neighbors once, so the DP is O(R C). The memo table and pointer array use O(R C) space.",
        uses: [
            "Finding monotone trails in terrain or image grids",
            "A worked example of dynamic programming on an implicit DAG",
            "Longest-chain analysis in numeric matrices",
        ],
        references: [
            "LeetCode, Longest Increasing Path in a Matrix, problem 329",
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, Chapter 15",
        ],
        workedExample:
            "For the grid [[1,2,3],[6,5,4],[7,8,9]] the path 1, 2, 3, 4, 5, 8, 9 moves only to larger neighbors and has length 7, which is the longest; the final frame highlights those cells.",
    },
    id: "longest-increasing-path-dp",
    name: "Longest Increasing Path in a Grid",
    category: "dynamic-programming",
    complexity: { time: "O(R C log(R C))", space: "O(R C)" },
    defaultInput: {
        grid: [
            [1, 2, 3],
            [6, 5, 4],
            [7, 8, 9],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the grid and set every cell's memo value to 1",
        "visit cells in increasing value order",
        "for each smaller four-direction neighbor",
        "if its memo value plus one is larger, update this cell",
        "store that neighbor to rebuild the path",
        "track the largest memo value over all cells",
        "done: report the longest increasing path length",
    ],
};

export default module;
