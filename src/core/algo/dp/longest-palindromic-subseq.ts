/**
 * Longest Palindromic Subsequence: dp[l][r] = 2 + dp[l+1][r-1] on match,
 * else max(dp[l+1][r], dp[l][r-1]). Default "bbbab" -> 4.
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
    const task = (input as { s?: string } | null) ?? {};
    const s = typeof task.s === "string" ? task.s : "bbbab";
    let step = 0;
    if (s.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty string \u2013 length 0.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const n = s.length;
    const dp: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) dp[i][i] = 1;
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `LPS of "${s}". dp[i][i] = 1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let len = 2; len <= n; len += 1) {
        for (let l = 0; l + len - 1 < n; l += 1) {
            const r = l + len - 1;
            if (s[l] === s[r]) dp[l][r] = len === 2 ? 2 : (dp[l + 1]?.[r - 1] ?? 0) + 2;
            else dp[l][r] = Math.max(dp[l + 1]?.[r] ?? 0, dp[l]?.[r - 1] ?? 0);
        }
        const states = new Map<string, EntityState>([[`0,${len - 1}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `Length-${len} spans done; dp[0][${len - 1}] = ${dp[0]?.[len - 1]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    const answer = dp[0]?.[n - 1] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp, new Map([[`0,${n - 1}`, "sorted"]])),
        edges: [],
        description: `Traceback: LPS length of "${s}" = ${answer}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {
    id: "longest-palindromic-subseq",
    name: "Longest Palindromic Subsequence",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b2)", space: "O(n\u00b2)" },
    defaultInput: { s: "bbbab" },
    visualType: "grid",
    run,
};

export default module;
