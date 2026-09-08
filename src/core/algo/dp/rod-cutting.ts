/**
 * Rod Cutting: dp[L] = max(price[c] + dp[L-c]).
 * Time O(n^2), Space O(n). Default: revenue 10 via 2 + 2.
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { prices?: number[]; n?: number } | null) ?? {};
    const prices = task.prices ?? [1, 5, 8, 9];
    const n = typeof task.n === "number" ? task.n : 4;
    let step = 0;
    if (prices.length === 0 || n <= 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty input \u2013 nothing to cut.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const dp: number[] = new Array<number>(n + 1).fill(0);
    const cut: number[] = new Array<number>(n + 1).fill(0);
    const show = () => [[...dp]];
    yield {
        stepNumber: step,
        entities: makeCells(show()),
        edges: [],
        description: `Rod ${n}, prices [${prices.join(", ")}]. dp[0] = 0.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let L = 1; L <= n; L += 1) {
        let best = -1;
        let bestC = 1;
        const lim = Math.min(L, prices.length);
        for (let c = 1; c <= lim; c += 1) {
            const cand = (prices[c - 1] ?? 0) + (dp[L - c] ?? 0);
            if (cand > best) {
                best = cand;
                bestC = c;
            }
        }
        dp[L] = best;
        cut[L] = bestC;
        const states = new Map<string, EntityState>([[`0,${L}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(show(), states),
            edges: [],
            description: `dp[${L}] = price[${bestC}] + dp[${L - bestC}] = ${best}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    const parts: number[] = [];
    let rem = n;
    while (rem > 0) {
        const c = cut[rem] ?? rem;
        parts.push(c);
        rem -= c;
    }
    yield {
        stepNumber: step,
        entities: makeCells(show(), new Map([[`0,${n}`, "sorted"]])),
        edges: [],
        description: `Traceback: max revenue ${dp[n]} via cuts [${parts.join(" + ")}].`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer: dp[n] },
    };
}

const module: AlgorithmModule = {
    id: "rod-cutting",
    name: "Rod Cutting",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b2)", space: "O(n)" },
    defaultInput: { prices: [1, 5, 8, 9], n: 4 },
    visualType: "grid",
    run,
};

export default module;
