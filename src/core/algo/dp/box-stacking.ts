/**
 * Box Stacking: rotations sorted by base area, then LIS on (w,d) for height.
 * Time O(n^2), Space O(n). Default [[4,6,7],[1,2,3]] -> 15.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const r = matrix[row];
        if (!r) continue;
        for (let col = 0; col < r.length; col += 1) {
            const value = r[col];
            if (value === undefined) continue;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: states.get(`${row},${col}`) ?? "idle",
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

interface Rotation {
    w: number;
    d: number;
    h: number;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { boxes?: number[][] } | null) ?? {};
    const boxes = task.boxes ?? [
        [4, 6, 7],
        [1, 2, 3],
    ];
    let step = 0;
    if (boxes.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "No boxes \u2013 height 0.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const rots: Rotation[] = [];
    for (const b of boxes) {
        const dims = [...(b ?? [])].sort((x, y) => x - y);
        if (dims.length < 3) continue;
        const [x, y, z] = dims as [number, number, number];
        rots.push({ w: y, d: z, h: x }, { w: x, d: z, h: y }, { w: x, d: y, h: z });
    }
    rots.sort((a, b) => b.w * b.d - a.w * a.d);
    const m = rots.length;
    const best: number[] = rots.map((r) => r.h);
    yield {
        stepNumber: step,
        entities: makeCells([[...best]]),
        edges: [],
        description: `${m} rotations by base area; best[i] starts at own height.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { m },
    };
    step += 1;
    for (let i = 1; i < m; i += 1) {
        const ri = rots[i] as Rotation;
        for (let j = 0; j < i; j += 1) {
            const rj = rots[j] as Rotation;
            if (rj.w > ri.w && rj.d > ri.d && (best[j] ?? 0) + ri.h > (best[i] ?? 0))
                best[i] = (best[j] ?? 0) + ri.h;
        }
        const states = new Map<string, EntityState>([[`0,${i}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells([[...best]], states),
            edges: [],
            description: `Rotation ${i} (${ri.w}x${ri.d}x${ri.h}): best = ${best[i]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { m },
        };
        step += 1;
    }
    let answer = 0;
    for (const v of best) if (v > answer) answer = v;
    yield {
        stepNumber: step,
        entities: makeCells([[...best]], new Map([["0,0", "sorted"]])),
        edges: [],
        description: `Traceback: max stack height = ${answer}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {
    id: "box-stacking",
    name: "Box Stacking",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b2)", space: "O(n)" },
    defaultInput: {
        boxes: [
            [4, 6, 7],
            [1, 2, 3],
        ],
    },
    visualType: "grid",
    run,
};

export default module;
