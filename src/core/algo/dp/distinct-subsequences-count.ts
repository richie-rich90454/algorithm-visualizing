/**
 * distinct-subsequences-count.ts - Distinct Subsequences (Count)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[i][j] <- dp[i-1][j-1] + dp[i-1][j] on match else dp[i-1][j].
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n\u00b7m)
 *   Space: O(n\u00b7m)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
   - The cell being computed is YELLOW (comparing).
   - Source cells for the transition are BLUE (active).
   - The optimal value and path are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - States build in dependency order so every transition reads final values.
 *   - The recurrence above is the single idea to memorize.
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
            meta: { step },
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
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Distinct Subsequences counts how many ways the target t can be formed as a subsequence of the source s. When characters match, we may either use the match or skip the source character, giving dp[i][j] = dp[i-1][j-1] plus dp[i-1][j]. On a mismatch only skipping is allowed.",
        "invariants": [
            "dp[i][j] counts occurrences of t[:j] as a subsequence of s[:i].",
            "dp[i][0] is one for the empty target.",
            "Rows are filled left to right using only earlier source prefixes."
        ],
        "correctness": "If the last source character equals the last target character, every subsequence using it corresponds to one of t[:j-1] in s[:i-1], and the rest skip it, giving the sum. If they differ, only subsequences in s[:i-1] remain. Induction over i and j yields the exact count.",
        "complexityRationale": "Filling an n by m table with constant work per cell costs O(n*m) time. The table occupies O(n*m) space, reducible to O(m) with a rolling row.",
        "uses": [
            "Counting matching subsequences in strings",
            "Bioinformatics sequence comparison variants",
            "Counting ways to form a pattern from a longer stream"
        ],
        "references": [
            "LeetCode problem 115, Distinct Subsequences",
            "Cormen et al., Introduction to Algorithms, Chapter 15"
        ],
        "workedExample": "For s = babgbag and t = bag, the DP counts all ways to pick b, then a, then g in order. The final cell dp[7][3] is 5, the number of distinct subsequence matches."
    },
    id: "distinct-subsequences-count",
    name: "Distinct Subsequences (Count)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b7m)", space: "O(n\u00b7m)" },
    defaultInput: { s: "babgbag", t: "bag" },
    visualType: "grid",
    run,
    pseudocode: [
        "set up table with dp[i][0] <- 1 for the empty target",
        "dp[i][j] holds matches of t[:j] inside s[:i]",
        "dp[i][j] <- dp[i-1][j-1] + dp[i-1][j] on match else dp[i-1][j]",
        "fill rows over s and columns over t in order",
        "matching chars add the use-it plus skip-it options",
        "mismatches carry down the skip-it value only",
        "answer <- dp[n][m] with match positions from backtrace",
    ],
};

export default module;
