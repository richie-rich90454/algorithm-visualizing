/**
 * Wildcard Matching: '?' matches one char, '*' matches any sequence.
 * Time O(n*m), Space O(n*m). Default "aa"/"a*" -> match.
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
    const task = (input as { s?: string; p?: string } | null) ?? {};
    const s = typeof task.s === "string" ? task.s : "aa";
    const p = typeof task.p === "string" ? task.p : "a*";
    let step = 0;
    const n = s.length;
    const m = p.length;
    if (m === 0) {
        const match = n === 0;
        yield {
            stepNumber: step,
            entities: makeCells([[match ? 1 : 0]]),
            edges: [],
            description: match ? "Both empty \u2013 match." : "Empty pattern \u2013 no match.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    dp[0][0] = 1;
    for (let j = 1; j <= m; j += 1) if (p[j - 1] === "*") dp[0][j] = dp[0]?.[j - 1] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Match "${s}" vs "${p}". First row seeded through leading '*'s.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, m },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Base column: empty pattern matches only the empty prefix.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { n, m },
    };
    step += 1;
    for (let j = 1; j <= m; j += 1) {
        for (let i = 1; i <= n; i += 1) {
            const pc = p[j - 1];
            if (pc === "*")
                dp[i][j] = (dp[i]?.[j - 1] ?? 0) === 1 || (dp[i - 1]?.[j] ?? 0) === 1 ? 1 : 0;
            else if (pc === "?" || pc === s[i - 1]) dp[i][j] = dp[i - 1]?.[j - 1] ?? 0;
            else dp[i][j] = 0;
        }
        const states = new Map<string, EntityState>([[`${n},${j}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `Pattern "${p[j - 1]}" at col ${j} done; dp[${n}][${j}] = ${dp[n]?.[j] === 1}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n, m },
        };
        step += 1;
    }
    const match = (dp[n]?.[m] ?? 0) === 1;
    yield {
        stepNumber: step,
        entities: makeCells(dp, new Map([[`${n},${m}`, "sorted"]])),
        edges: [],
        description: match ? `"${s}" matches "${p}".` : `"${s}" does not match "${p}".`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { match },
    };
}

const module: AlgorithmModule = {
    id: "wildcard-matching",
    name: "Wildcard Matching",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b7m)", space: "O(n\u00b7m)" },
    defaultInput: { s: "aa", p: "a*" },
    visualType: "grid",
    run,
};

export default module;
