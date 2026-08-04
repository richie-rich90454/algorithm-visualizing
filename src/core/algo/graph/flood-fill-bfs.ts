/**
 * flood-fill-bfs.ts – Flood Fill (BFS)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The queue-based sibling of flood-fill DFS. From the start cell, it enqueues
 * matching neighbors and recolors them as they are dequeued. Because the
 * queue is FIFO, the region fills outward level by level from the start,
 * producing a distinctive "ripple" visualization that contrasts nicely with
 * the depth-first spiral of the recursive version.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rows × cols)
 *   Space: O(rows × cols) for the queue
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid is a matrix of cell entities.
 *   - The cell being dequeued and recolored is YELLOW (comparing).
 *   - Completed cells are GREEN (sorted).
 *   - Out-of-region cells stay GREY (unvisited).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Same end result as DFS flood fill; different order, same region.
 *   - No recursion means no stack-depth concerns on huge grids.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** The four orthogonal directions: up, down, left, right. */
const DIRS: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
];

/**
 * Build the grid of cell entities for a frame.
 *
 * @param grid The 2D grid of color indices.
 * @param states Optional `row,col` → state overrides for this frame.
 * @returns An array of `VisualEntity` cells with row/col metadata.
 */
function makeCells(grid: number[][], states: Map<string, EntityState> = new Map()): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < grid.length; row += 1) {
        const gridRow = grid[row];
        if (!gridRow) {
            continue;
        }
        for (let col = 0; col < gridRow.length; col += 1) {
            const value = gridRow[col];
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
 * The Flood Fill (BFS) generator.
 *
 * @param input `{ grid, startRow, startCol, newColor }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            grid?: number[][];
            startRow?: number;
            startCol?: number;
            newColor?: number;
        } | null) ?? {};
    const grid: number[][] = task.grid ?? [
        [1, 1, 2, 2],
        [1, 1, 2, 1],
        [3, 1, 1, 1],
        [3, 3, 3, 4],
    ];
    const startRow = task.startRow ?? 1;
    const startCol = task.startCol ?? 1;
    const newColor = task.newColor ?? 9;

    const rows = grid.length;
    const cols = rows > 0 ? (grid[0]?.length ?? 0) : 0;

    const targetColor = grid[startRow]?.[startCol];
    if (targetColor === undefined) {
        yield {
            stepNumber: 0,
            entities: makeCells(grid),
            edges: [],
            description: "Invalid start cell.",
            layout: "grid",
            meta: {},
        };
        return;
    }

    const visited = new Set<string>();
    let step = 0;
    let filled = 0;

    const initialStates = new Map<string, EntityState>([[`${startRow},${startCol}`, "comparing"]]);
    yield {
        stepNumber: step,
        entities: makeCells(grid, initialStates),
        edges: [],
        description: `Flood fill (BFS) from (${startRow}, ${startCol}) with colour ${targetColor} → ${newColor}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { filled },
    };
    step += 1;

    // Seed the queue with the start cell.
    const queue: Array<[number, number]> = [[startRow, startCol]];
    visited.add(`${startRow},${startCol}`);

    while (queue.length > 0) {
        const cell = queue.shift();
        if (!cell) {
            continue;
        }
        const [row, col] = cell;

        // Recolour and record.
        const key = `${row},${col}`;
        grid[row][col] = newColor;
        filled += 1;

        const states = new Map<string, EntityState>([[key, "sorted"]]);
        yield {
            stepNumber: step,
            entities: makeCells(grid, states),
            edges: [],
            description: `Filled (${row}, ${col}) with ${newColor}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { filled },
        };
        step += 1;

        // Enqueue matching, unvisited neighbors for the next level.
        for (const [dr, dc] of DIRS) {
            const nr = row + dr;
            const nc = col + dc;
            const neighborKey = `${nr},${nc}`;

            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                continue;
            }
            if (visited.has(neighborKey)) {
                continue;
            }
            if (grid[nr]?.[nc] !== targetColor) {
                continue;
            }

            visited.add(neighborKey);
            queue.push([nr, nc]);
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(grid),
        edges: [],
        description: `Flood fill (BFS) complete – recolored ${filled} cell(s).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { filled },
    };
}

/** The Flood Fill (BFS) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "flood-fill-bfs",
    name: "Flood Fill (BFS)",
    category: "graph",
    complexity: { time: "O(rows × cols)", space: "O(rows × cols)" },
    // Same grid as the DFS version so the two orders can be compared.
    defaultInput: {
        grid: [
            [1, 1, 2, 2],
            [1, 1, 2, 1],
            [3, 1, 1, 1],
            [3, 3, 3, 4],
        ],
        startRow: 1,
        startCol: 1,
        newColor: 9,
    },
    visualType: "grid",
    run,
};

export default module;
