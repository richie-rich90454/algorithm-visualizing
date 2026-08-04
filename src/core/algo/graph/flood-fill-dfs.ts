/**
 * flood-fill-dfs.ts – Flood Fill (DFS)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Flood fill is the algorithm behind the paint bucket tool. Given a grid and a
 * starting cell, it recolors the entire connected region of cells that share
 * the starting cell's color. This version uses depth-first search: from the
 * start, it recursively visits all four (or eight) neighbors that have the
 * same color, recoloring as it goes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rows × cols) – every cell is visited at most once
 *   Space: O(rows × cols) stack depth in the worst case
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The grid is rendered as a matrix of cell entities.
 *   - The cell currently being filled is YELLOW (comparing).
 *   - Already-filled cells are GREEN (sorted) with the new colour.
 *   - Out-of-region cells stay GRAY (unvisited).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - A direct application of DFS on a grid (each cell is a graph vertex).
 *   - Four-neighbour vs eight-neighbour connectivity changes the result.
 *   - The grid layout engine positions cells by (row, col) metadata.
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
 * @param grid The 2D grid of colour indices.
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
 * The Flood Fill (DFS) generator.
 *
 * @param input `{ grid, startRow, startCol, newColor }` – a 2D colour grid,
 *        the start cell, and the replacement colour.
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

    // The colour of the region we are recolouring.
    const targetColor = grid[startRow]?.[startCol];
    if (targetColor === undefined) {
        // Malformed start – still emit one frame for the tests.
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

    // Frame 0: the untouched grid with the start cell highlighted.
    const initialStates = new Map<string, EntityState>([[`${startRow},${startCol}`, "comparing"]]);
    yield {
        stepNumber: step,
        entities: makeCells(grid, initialStates),
        edges: [],
        description: `Flood fill from (${startRow}, ${startCol}) with colour ${targetColor} → ${newColor}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { filled },
    };
    step += 1;

    /**
     * DFS over matching neighbors. Recolors `cell` and recurses into each
     * orthogonal neighbor that has the region color and is in bounds.
     */
    function* fill(row: number, col: number): Generator<VisualFrame, void, unknown> {
        // Guard against out-of-bounds and already-visited cells.
        if (row < 0 || row >= rows || col < 0 || col >= cols) {
            return;
        }
        const key = `${row},${col}`;
        if (visited.has(key)) {
            return;
        }

        const color = grid[row]?.[col];
        if (color !== targetColor) {
            return; // Different color – outside the region.
        }

        // Recolour and record.
        visited.add(key);
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

        // Recurse into all four neighbors.
        for (const [dr, dc] of DIRS) {
            yield* fill(row + dr, col + dc);
        }
    }

    yield* fill(startRow, startCol);

    // Final frame: the region is recoloured.
    yield {
        stepNumber: step,
        entities: makeCells(grid),
        edges: [],
        description: `Flood fill complete – recolored ${filled} cell(s).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { filled },
    };
}

/** The Flood Fill (DFS) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "flood-fill-dfs",
    name: "Flood Fill (DFS)",
    category: "graph",
    complexity: { time: "O(rows × cols)", space: "O(rows × cols)" },
    // An L-shaped region of 1s around (1,1) makes the recursion visible.
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
