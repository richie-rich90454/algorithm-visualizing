/**
 * Regex Matching ('.' and '*'): dp[i][j] with star = zero-or-more of p[j-2].
 * Time O(n*m), Space O(n*m). Default "aab"/"c*a*b" -> match.
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
    const s = typeof task.s === "string" ? task.s : "aab";
    const p = typeof task.p === "string" ? task.p : "c*a*b";
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
    for (let j = 2; j <= m; j += 1) if (p[j - 1] === "*") dp[0][j] = dp[0]?.[j - 2] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Match "${s}" vs "${p}". Empty-string row seeded over 'x*' pairs.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, m },
    };
    step += 1;
    for (let i = 1; i <= n; i += 1) {
        for (let j = 1; j <= m; j += 1) {
            const pc = p[j - 1];
            if (pc === "*") {
                const zero = dp[i]?.[j - 2] ?? 0;
                const prev = p[j - 2];
                const more = prev === "." || prev === s[i - 1] ? (dp[i - 1]?.[j] ?? 0) : 0;
                dp[i][j] = zero === 1 || more === 1 ? 1 : 0;
            } else if (pc === "." || pc === s[i - 1]) dp[i][j] = dp[i - 1]?.[j - 1] ?? 0;
            else dp[i][j] = 0;
        }
        const states = new Map<string, EntityState>([[`${i},${m}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `Row ${i} ("${s[i - 1]}") done; dp[${i}][${m}] = ${dp[i]?.[m] === 1}.`,
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
    id: "regex-matching-dp",
    name: "Regex Matching (DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b7m)", space: "O(n\u00b7m)" },
    defaultInput: { s: "aab", p: "c*a*b" },
    visualType: "grid",
    run,
};

export default module;
