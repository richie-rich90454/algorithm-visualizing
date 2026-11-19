/**
 * moore-neighbor-contour-tracing.ts - Moore-Neighbor Contour Tracing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Moore-neighbor tracing walks the outer boundary of a connected foreground
 * region on a raster grid. Starting at the top-leftmost foreground cell with a
 * background cell immediately to its west, it repeatedly scans the eight
 * neighbors in counterclockwise order beginning just after the direction it
 * came from. The first foreground neighbor becomes the next boundary cell.
 * The walk stops when it re-enters the starting cell, having circled the
 * region once.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p) for a contour of p boundary pixels (eight tests per step)
 *   Space: O(p) to store the contour
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells are drawn at their row and column.
 *   - Foreground cells are ACTIVE; traced boundary cells become PATH.
 *   - The current cell is HIGHLIGHT and the closing cell is SORTED.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Cell = { r: number; c: number };

/** Counterclockwise neighbors starting at north. */
const DIRS: Cell[] = [
    { r: -1, c: 0 }, { r: -1, c: -1 }, { r: 0, c: -1 }, { r: 1, c: -1 },
    { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 0, c: 1 }, { r: -1, c: 1 },
];

function cells(grid: number[][]): VisualEntity[] {
    return grid.flatMap((row, r) => row.map((value, c) => ({
        id: `cell-${r}-${c}`,
        type: "cell" as const,
        label: value === 1 ? "1" : "0",
        value,
        state: (value === 1 ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: r, col: c },
    })));
}

function same(a: Cell, b: Cell): boolean {
    return a.r === b.r && a.c === b.c;
}

/** Trace one outer contour and emit a frame for each boundary cell. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { grid?: number[][] } | null) ?? {};
    const grid: number[][] = task.grid ?? [
        [0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
    ];
    const rows = grid.length;
    const cols = rows > 0 ? (grid[0]?.length ?? 0) : 0;
    const foreground = (cell: Cell): boolean =>
        cell.r >= 0 && cell.r < rows && cell.c >= 0 && cell.c < cols &&
        (grid[cell.r]?.[cell.c] ?? 0) === 1;

    let start: Cell | null = null;
    for (let r = 0; r < rows && !start; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            if (grid[r]?.[c] === 1) {
                start = { r, c };
                break;
            }
        }
    }

    let step = 0;
    if (!start) {
        yield {
            stepNumber: step,
            entities: cells(grid),
            edges: [],
            description: "The grid contains no foreground cells, so there is no contour to trace.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows, cols, contourLength: 0, valid: false },
        };
        return;
    }

    const first = start;
    yield {
        stepNumber: step,
        entities: cells(grid),
        edges: [],
        description: `Trace the outer boundary of the foreground region starting at (${first.r}, ${first.c}).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, contourLength: 0, valid: true, start: [first.r, first.c] },
    };
    step += 1;

    const contour: Cell[] = [first];
    let current: Cell = first;
    let backIndex = 2;
    const visited = new Set<string>([`${first.r},${first.c}`]);

    for (let guard = 0; guard < rows * cols + 4; guard += 1) {
        let next: Cell | null = null;
        let nextIndex = -1;
        for (let k = 1; k <= 8; k += 1) {
            const index = (backIndex + k) % 8;
            const dir = DIRS[index]!;
            const candidate: Cell = { r: current.r + dir.r, c: current.c + dir.c };
            if (foreground(candidate)) {
                next = candidate;
                nextIndex = index;
                break;
            }
        }
        if (!next) break;
        backIndex = (nextIndex + 4) % 8;
        current = next;
        contour.push(current);
        visited.add(`${current.r},${current.c}`);

        const states = new Map<string, EntityState>();
        for (const cell of contour) {
            states.set(`${cell.r},${cell.c}`, "path");
        }
        states.set(`${current.r},${current.c}`, same(current, first) ? "sorted" : "highlight");
        const entities = cells(grid).map((entity) => ({
            ...entity,
            state: states.get(`${(entity.metadata["row"] as number)},${(entity.metadata["col"] as number)}`)
                ?? entity.state,
        }));
        yield {
            stepNumber: step,
            entities,
            edges: [],
            description: `Step ${contour.length - 1}: move to boundary cell (${current.r}, ${current.c}).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows,
                cols,
                contourLength: contour.length - 1,
                current: [current.r, current.c],
                closed: same(current, first),
                valid: true,
            },
        };
        step += 1;
        if (same(current, first)) break;
    }

    const finalStates = new Map<string, EntityState>();
    for (const cell of contour) {
        finalStates.set(`${cell.r},${cell.c}`, "path");
    }
    finalStates.set(`${first.r},${first.c}`, "sorted");
    yield {
        stepNumber: step,
        entities: cells(grid).map((entity) => ({
            ...entity,
            state: finalStates.get(`${(entity.metadata["row"] as number)},${(entity.metadata["col"] as number)}`)
                ?? entity.state,
        })),
        edges: [],
        description: `Contour trace complete with ${contour.length - 1} boundary cell steps around the region.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows,
            cols,
            contourLength: contour.length - 1,
            distinctCells: visited.size,
            closed: same(contour[contour.length - 1]!, first),
            valid: true,
        },
    };
}

/** The Moore-neighbor contour tracing module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "To walk around a blob on a pixel grid, stand on the first foreground cell you find and keep your free hand on the wall. At each cell you look at the eight neighbors in counterclockwise order, starting just past the cell you came from, and step onto the first foreground cell you meet. Recording those steps traces the outer boundary exactly once.",
        invariants: [
            "Every cell added to the contour is a foreground cell.",
            "Consecutive contour cells are neighbors in the eight-connected sense.",
            "The walk revisits the starting cell before any other cell repeats.",
        ],
        correctness:
            "Scanning neighbors in consistent angular order starting from the incoming direction keeps the walk on the outermost layer of the region. For each boundary cell the first foreground neighbor in that order is the next cell along the boundary, so the sequence follows the perimeter without cutting across the interior. Because the region boundary is a closed cycle, the walk returns to the start and the distinct cells it recorded are exactly the boundary cells.",
        complexityRationale:
            "Each of the p contour steps examines at most eight neighbors, a constant, so the running time is O(p). Storing the contour cells and a visit set takes O(p) space.",
        uses: [
            "Extracting object outlines from binary images",
            "Computing perimeter lengths in raster geographic information systems",
            "Seeding polygon tracing in computer vision pipelines",
        ],
        references: [
            "Moore, Automatic Digitizing, 1977",
            "Jacob, Stopping Criteria for Contour Tracing, 1996",
        ],
        workedExample:
            "On a 5 by 5 grid whose center is a filled 3 by 3 block, the top-left foreground cell is at row 1, column 1. The walk proceeds down the left edge, across the bottom, up the right edge and back along the top, visiting eight distinct boundary cells before closing on the start.",
    },
    id: "moore-neighbor-contour-tracing",
    name: "Moore-Neighbor Contour Tracing",
    category: "geometry",
    complexity: { time: "O(p)", space: "O(p)" },
    defaultInput: {
        grid: [
            [0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 0, 0],
            [0, 1, 1, 1, 0, 0],
            [0, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "find the top-leftmost foreground cell and call it the start",
        "if there is no foreground cell, report an empty contour",
        "set the backtrack direction to the west of the start",
        "scan the eight neighbors counterclockwise from the next direction",
        "step onto the first foreground neighbor found",
        "set the backtrack to the direction opposite that step",
        "repeat until the start cell is entered again",
        "done: report the traced boundary cells",
    ],
};

export default module;
