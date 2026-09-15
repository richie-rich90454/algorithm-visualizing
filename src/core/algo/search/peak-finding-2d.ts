/**
 * peak-finding-2d.ts – 2D Peak Finding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A 2D peak is a cell at least as large as its four orthogonal neighbors
 * (up, down, left, right). This visualization teaches greedy hill climbing:
 * start at the top-left corner, look at all four neighbors, and step to the
 * largest one whenever it beats the current cell. Because every move goes
 * strictly uphill, the walk cannot cycle and must end at a peak. Real
 * divide-and-conquer 2D peak finding is faster, but hill climbing shows the
 * landscape intuition that optimization builds on.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(nm) worst – the climb can visit many cells on a large grid
 *   Space: O(1) auxiliary – only the current row, column, and best neighbor
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The cell stepped to is YELLOW (comparing).
 *   - The confirmed peak turns GREEN (sorted).
 *   - Cells carry metadata.row and metadata.col for the grid layout.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Works on any grid – no sortedness promise is needed.
 *   - Always succeeds: every finite grid holds at least one 2D peak.
 *   - American spelling throughout: neighbor, climbing, optimized.
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
    const task = (input as { matrix?: number[][] } | null) ?? {};
    const matrix = Array.isArray(task.matrix)
        ? (task.matrix as number[][]).map((row) => [...row])
        : [
              [1, 2, 3],
              [4, 5, 6],
              [7, 8, 9],
          ];
    let step = 0;
    let comparisons = 0;
    const rows = matrix.length;
    const cols = rows > 0 ? ((matrix[0] as number[]).length ?? 0) : 0;

    yield {
        stepNumber: step,
        entities: makeCells(matrix),
        edges: [],
        description: `Hill climbing on a ${rows} by ${cols} grid starting at top-left cell 1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { comparisons, rows, cols },
    };
    step += 1;
    if (rows === 0 || cols === 0) {
        yield {
            stepNumber: step,
            entities: makeCells(matrix),
            edges: [],
            description: "Empty grid holds no cells, so no peak exists here.",
            codeLineNumber: 4,
            layout: "grid",
            meta: { comparisons },
        };
        return;
    }
    let r = 0;
    let c = 0;
    while (step < 12) {
        const cur = matrix[r]?.[c] as number;
        let best = cur;
        let br = r;
        let bc = c;
        for (const [dr, dc] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
        ] as Array<[number, number]>) {
            const nr = r + dr;
            const nc = c + dc;
            const v = nr >= 0 && nr < rows ? (matrix[nr]?.[nc] as number | undefined) : undefined;
            comparisons += 1;
            if (v !== undefined && v > best) {
                best = v;
                br = nr;
                bc = nc;
            }
        }
        if (br === r && bc === c) {
            yield {
                stepNumber: step,
                entities: makeCells(matrix, new Map([[`${r},${c}`, "sorted"]])),
                edges: [],
                description: `Peak ${cur} at row ${r} column ${c} beats all four neighbors after ${comparisons} checks.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { comparisons, peak: [r, c], value: cur },
            };
            return;
        }
        r = br;
        c = bc;
        yield {
            stepNumber: step,
            entities: makeCells(matrix, new Map([[`${r},${c}`, "comparing"]])),
            edges: [],
            description: `Climbing uphill to ${best} at row ${r} column ${c} for the next round.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { comparisons, row: r, col: c },
        };
        step += 1;
    }
}

const module: AlgorithmModule = {
    id: "peak-finding-2d",
    name: "Peak Finding 2D",
    category: "searching",
    complexity: { time: "O(nm)", space: "O(1)" },
    defaultInput: {
        matrix: [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start at cell (0, 0) on the rows by cols grid",
        "examine the four orthogonal neighbors of the current cell",
        "find the largest neighbor and count the comparisons",
        "if no neighbor beats current: it is a 2D peak",
        "done: return peak coordinates and its value",
    ],
};

export default module;
