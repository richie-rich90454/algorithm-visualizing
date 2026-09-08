/**
 * Distinct Subsequences: dp[i][j] = dp[i-1][j] + (match ? dp[i-1][j-1] : 0).
 * Time O(n*m), Space O(n*m). Default "babgbag"/"bag" -> 5.
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
    const task = (input as { s?: string; t?: string } | null) ?? {};
    const s = typeof task.s === "string" ? task.s : "babgbag";
    const t = typeof task.t === "string" ? task.t : "bag";
    let step = 0;
    if (s.length === 0 || t.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[1]]),
            edges: [],
            description: "Empty string \u2013 nothing to match.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const n = s.length;
    const m = t.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    for (let i = 0; i <= n; i += 1) dp[i][0] = 1;
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Count "${t}" as a subsequence of "${s}". dp[i][0] = 1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, m },
    };
    step += 1;
    for (let j = 1; j <= m; j += 1) {
        for (let i = 1; i <= n; i += 1) {
            dp[i][j] = dp[i - 1]?.[j] ?? 0;
            if (s[i - 1] === t[j - 1]) dp[i][j] += dp[i - 1]?.[j - 1] ?? 0;
        }
        const states = new Map<string, EntityState>([[`${n},${j}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `Column ${j} ("${t[j - 1]}") done; dp[${n}][${j}] = ${dp[n]?.[j]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n, m },
        };
        step += 1;
    }
    const answer = dp[n]?.[m] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp, new Map([[`${n},${m}`, "sorted"]])),
        edges: [],
        description: `Traceback: ${answer} distinct subsequences equal "${t}".`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {
    id: "distinct-subsequences-count",
    name: "Distinct Subsequences (Count)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b7m)", space: "O(n\u00b7m)" },
    defaultInput: { s: "babgbag", t: "bag" },
    visualType: "grid",
    run,
};

export default module;
