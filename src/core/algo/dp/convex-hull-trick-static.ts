/**
 * Static Convex Hull Trick (min): lines added by decreasing slope,
 * queries in increasing x; pointer walk on the lower hull.
 * Time O((n+q) log n), Space O(n). Default queries -> [1,3,3].
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

interface ChtLine {
    m: number;
    b: number;
}

function chtEval(l: ChtLine, x: number): number {
    return l.m * x + l.b;
}

function chtCross(a: ChtLine, b: ChtLine): number {
    return (b.b - a.b) / (a.m - b.m);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { lines?: ChtLine[]; queries?: number[] } | null) ?? {};
    const lines = task.lines ?? [
        { m: 2, b: 1 },
        { m: 1, b: 2 },
        { m: -1, b: 5 },
    ];
    const queries = task.queries ?? [0, 1, 2];
    let step = 0;
    if (lines.length === 0 || queries.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "No lines or no queries \u2013 nothing to answer.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const sorted = [...lines].sort((p, q) => q.m - p.m);
    const dedup: ChtLine[] = [];
    for (const l of sorted) {
        const last = dedup[dedup.length - 1];
        if (last && last.m === l.m) {
            if (l.b < last.b) dedup[dedup.length - 1] = l;
        } else dedup.push(l);
    }
    const hull: ChtLine[] = [];
    const table: number[][] = Array.from({ length: lines.length }, () =>
        new Array<number>(queries.length).fill(-1),
    );
    yield {
        stepNumber: step,
        entities: makeCells(table),
        edges: [],
        description: `Min over ${lines.length} lines at x in [${queries.join(", ")}]. Slopes enter decreasing.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n: lines.length },
    };
    step += 1;
    for (const l of dedup) {
        while (hull.length >= 2) {
            const a = hull[hull.length - 2];
            const b = hull[hull.length - 1];
            if (a && b && chtCross(a, b) >= chtCross(b, l)) hull.pop();
            else break;
        }
        hull.push(l);
        const row = hull.length - 1;
        for (let q = 0; q < queries.length; q += 1) table[row][q] = chtEval(l, queries[q] ?? 0);
        const states = new Map<string, EntityState>([[`${row},0`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(table, states),
            edges: [],
            description: `Line y = ${l.m}x + ${l.b} joins hull position ${row}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n: lines.length },
        };
        step += 1;
    }
    const xs = [...queries].sort((a, b) => a - b);
    let ptr = 0;
    const answers: number[] = [];
    for (const x of xs) {
        while (
            ptr + 1 < hull.length &&
            chtEval(hull[ptr + 1] as ChtLine, x) <= chtEval(hull[ptr] as ChtLine, x)
        )
            ptr += 1;
        answers.push(chtEval(hull[ptr] as ChtLine, x));
    }
    const marks = new Map<string, EntityState>();
    for (let q = 0; q < queries.length; q += 1) {
        let bestR = 0;
        let bestV = table[0]?.[q] ?? 0;
        for (let r = 1; r < hull.length; r += 1) {
            const v = table[r]?.[q] ?? 0;
            if (v < bestV) {
                bestV = v;
                bestR = r;
            }
        }
        marks.set(`${bestR},${q}`, "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeCells(table, marks),
        edges: [],
        description: `Pointer sweep answers [${answers.join(", ")}] at x = [${xs.join(", ")}].`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { n: lines.length },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeCells(table, marks),
        edges: [],
        description: `Traceback: minima [${answers.join(", ")}] read off the lower hull.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answers },
    };
}

const module: AlgorithmModule = {
    id: "convex-hull-trick-static",
    name: "Convex Hull Trick (Static)",
    category: "dynamic-programming",
    complexity: { time: "O((n+q) log n)", space: "O(n)" },
    defaultInput: {
        lines: [
            { m: 2, b: 1 },
            { m: 1, b: 2 },
            { m: -1, b: 5 },
        ],
        queries: [0, 1, 2],
    },
    visualType: "grid",
    run,
};

export default module;
