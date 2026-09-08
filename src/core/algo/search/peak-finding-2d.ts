/**
 * peak-finding-2d.ts – 2D Peak Finding
 *
 * Greedy hill climbing on a grid: from the current cell step to the
 * largest neighbor until no neighbor is larger. Cells carry
 * metadata.row/col and the peak goes green.
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
        description: `Hill climbing on a ${rows}×${cols} grid from the top-left.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { comparisons },
    };
    step += 1;
    if (rows === 0 || cols === 0) {
        yield {
            stepNumber: step,
            entities: makeCells(matrix),
            edges: [],
            description: "Empty grid – no peak exists.",
            codeLineNumber: 1,
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
                description: `Peak ${cur} at (${r},${c}) – no neighbor is larger.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { comparisons, peak: [r, c] },
            };
            return;
        }
        r = br;
        c = bc;
        yield {
            stepNumber: step,
            entities: makeCells(matrix, new Map([[`${r},${c}`, "comparing"]])),
            edges: [],
            description: `Climbing to ${best} at (${r},${c}).`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { comparisons },
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
};

export default module;
