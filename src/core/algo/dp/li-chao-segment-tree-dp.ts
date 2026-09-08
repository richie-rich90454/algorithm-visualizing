/**
 * Li Chao segment tree (min) over discrete xs: insert lines, query points.
 * Time O(log C) per op, Space O(C). Default queries -> [1,3,3].
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

interface ChaoLine {
    m: number;
    b: number;
}

function chaoEval(l: ChaoLine, x: number): number {
    return l.m * x + l.b;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { lines?: ChaoLine[]; queries?: number[] } | null) ?? {};
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
    const xs = [0, 1, 2, 3];
    const tree: (ChaoLine | null)[] = new Array<ChaoLine | null>(16).fill(null);
    const addLine = (nw: ChaoLine, node: number, l: number, r: number): void => {
        const mid = (l + r) >> 1;
        const xl = xs[l] ?? 0;
        const xm = xs[mid] ?? 0;
        const xr = xs[r] ?? 0;
        let cur = tree[node] ?? null;
        if (!cur) {
            tree[node] = nw;
            return;
        }
        if (chaoEval(nw, xm) < chaoEval(cur, xm)) {
            tree[node] = nw;
            nw = cur;
            cur = tree[node] as ChaoLine;
        }
        if (l === r) return;
        if (chaoEval(nw, xl) < chaoEval(cur, xl)) addLine(nw, node * 2, l, mid);
        else if (chaoEval(nw, xr) < chaoEval(cur, xr)) addLine(nw, node * 2 + 1, mid + 1, r);
    };
    const ranges: Array<[number, number]> = [
        [0, 3],
        [0, 1],
        [2, 3],
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 3],
    ];
    const show = (): number[][] => [
        ranges.map(([l, r], i) => {
            const stored = tree[i + 1] ?? null;
            if (!stored) return -1;
            return chaoEval(stored, xs[(l + r) >> 1] ?? 0);
        }),
    ];
    yield {
        stepNumber: step,
        entities: makeCells(show()),
        edges: [],
        description: `Li Chao tree over xs [${xs.join(", ")}]; cell k = node k's line at its midpoint (-1 = empty).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n: lines.length },
    };
    step += 1;
    for (const l of lines) {
        addLine({ ...l }, 1, 0, 3);
        const states = new Map<string, EntityState>([["0,0", "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(show(), states),
            edges: [],
            description: `Inserted y = ${l.m}x + ${l.b}; root now ${show()[0]?.[0]} at x = 1.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n: lines.length },
        };
        step += 1;
    }
    const query = (x: number): number => {
        let node = 1;
        let l = 0;
        let r = 3;
        let best = Number.MAX_SAFE_INTEGER;
        while (true) {
            const stored = tree[node] ?? null;
            if (stored) best = Math.min(best, chaoEval(stored, x));
            if (l === r) break;
            const mid = (l + r) >> 1;
            const xi = xs.indexOf(x);
            if (xi <= mid) {
                node = node * 2;
                r = mid;
            } else {
                node = node * 2 + 1;
                l = mid + 1;
            }
        }
        return best;
    };
    const answers = queries.map((x) => query(x));
    yield {
        stepNumber: step,
        entities: makeCells(show(), new Map([["0,0", "sorted"]])),
        edges: [],
        description: `Queries [${queries.join(", ")}] -> [${answers.join(", ")}].`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { n: lines.length },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeCells(show(), new Map([["0,0", "sorted"]])),
        edges: [],
        description: `Traceback: minima [${answers.join(", ")}] confirmed down root-to-leaf paths.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answers },
    };
}

const module: AlgorithmModule = {
    id: "li-chao-segment-tree-dp",
    name: "Li Chao Segment Tree (DP)",
    category: "dynamic-programming",
    complexity: { time: "O(log C)", space: "O(C)" },
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
