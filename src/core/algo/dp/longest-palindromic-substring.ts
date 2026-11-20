/**
 * longest-palindromic-substring.ts - Longest Palindromic Substring
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: P[l][r] <- s[l] == s[r] and (short gap or P[l+1][r-1]).
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n\u00b2)
 *   Space: O(n\u00b2)
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
    const task = (input as { s?: string } | null) ?? {};
    const s = typeof task.s === "string" ? task.s : "babad";
    let step = 0;
    if (s.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty string \u2013 no palindrome.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const n = s.length;
    const dp: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) dp[i][i] = 1;
    let start = 0;
    let maxLen = 1;
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Longest palindromic substring of "${s}". Singles are palindromes.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let len = 2; len <= n; len += 1) {
        for (let l = 0; l + len - 1 < n; l += 1) {
            const r = l + len - 1;
            if (s[l] === s[r] && (len === 2 || (dp[l + 1]?.[r - 1] ?? 0) === 1)) {
                const row = dp[l];
                if (row) row[r] = 1;
                if (len > maxLen) {
                    maxLen = len;
                    start = l;
                }
            }
        }
        const states = new Map<string, EntityState>([[`0,${len - 1}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `Length-${len} spans done; best "${s.slice(start, start + maxLen)}" (len ${maxLen}).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    const answer = s.slice(start, start + maxLen);
    yield {
        stepNumber: step,
        entities: makeCells(dp, new Map([[`${start},${start + maxLen - 1}`, "sorted"]])),
        edges: [],
        description: `Traceback: longest palindromic substring "${answer}".`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "The longest palindromic substring finds the longest contiguous span that reads the same both ways. The DP marks P[l][r] true when the ends match and the inner substring is a palindrome, with short spans as automatic bases. Tracking the longest true entry gives the answer directly.",
        "invariants": [
            "P[l][r] is true exactly when s[l..r] is a palindrome.",
            "All single characters and matching adjacent pairs are palindromes.",
            "A span is tested only after its inner span has been computed."
        ],
        "correctness": "A string of length at least three is a palindrome iff its ends match and the substring between them is a palindrome, so the recurrence characterizes palindromes exactly. Filling by increasing length makes inner values available. Tracking the longest confirmed span therefore returns the longest palindromic substring.",
        "complexityRationale": "Filling the O(n^2) table with constant work per entry costs O(n^2) time and O(n^2) space. Center-expansion variants trade the table for O(1) extra space.",
        "uses": [
            "Text processing and pattern search",
            "Finding repeated motifs in biological sequences",
            "String algorithm teaching alongside Manacher's method"
        ],
        "references": [
            "Cormen et al., Introduction to Algorithms, Section 15.4",
            "Manacher, A new linear-time on-line algorithm (1975)"
        ],
        "workedExample": "For s = babad the DP confirms spans bab and aba of length 3. Either can be reported as the longest palindromic substring."
    },
    id: "longest-palindromic-substring",
    name: "Longest Palindromic Substring",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b2)", space: "O(n\u00b2)" },
    defaultInput: { s: "babad" },
    visualType: "grid",
    run,
    pseudocode: [
        "set up singles as palindromes with best start 0 length 1",
        "table P[l][r] holds whether substring l..r is a palindrome",
        "P[l][r] <- s[l] == s[r] and (short gap or P[l+1][r-1])",
        "expand by length, checking inner substring results",
        "matching ends with palindromic core extend the best",
        "update best start and length on each longer confirmed span",
        "answer <- longest span s[start:start+maxLen] located",
    ],
};

export default module;
