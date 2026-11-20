/**
 * interleaving-string.ts - Interleaving String
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[i][j] <- (dp[i-1][j] and s1 match) or (dp[i][j-1] and s2 match).
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
    const task = (input as { s1?: string; s2?: string; s3?: string } | null) ?? {};
    const s1 = typeof task.s1 === "string" ? task.s1 : "aabcc";
    const s2 = typeof task.s2 === "string" ? task.s2 : "dbbca";
    const s3 = typeof task.s3 === "string" ? task.s3 : "aadbbcbcac";
    let step = 0;
    if (s1.length + s2.length !== s3.length) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: `Lengths ${s1.length} + ${s2.length} \u2260 ${s3.length} \u2013 cannot interleave.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    if (s1.length === 0 || s2.length === 0) {
        const match = s1 + s2 === s3;
        yield {
            stepNumber: step,
            entities: makeCells([[match ? 1 : 0]]),
            edges: [],
            description: match
                ? "Trivial interleave \u2013 match."
                : "Trivial interleave \u2013 no match.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const n = s1.length;
    const m = s2.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    dp[0][0] = 1;
    for (let i = 1; i <= n; i += 1)
        dp[i][0] = dp[i - 1]?.[0] === 1 && s1[i - 1] === s3[i - 1] ? 1 : 0;
    for (let j = 1; j <= m; j += 1)
        dp[0][j] = dp[0]?.[j - 1] === 1 && s2[j - 1] === s3[j - 1] ? 1 : 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Is "${s3}" an interleave of "${s1}" + "${s2}"? First row/col seeded.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, m },
    };
    step += 1;
    for (let i = 1; i <= n; i += 1) {
        for (let j = 1; j <= m; j += 1) {
            const k = i + j - 1;
            const fromS1 = dp[i - 1]?.[j] === 1 && s1[i - 1] === s3[k] ? 1 : 0;
            const fromS2 = dp[i]?.[j - 1] === 1 && s2[j - 1] === s3[k] ? 1 : 0;
            dp[i][j] = fromS1 === 1 || fromS2 === 1 ? 1 : 0;
        }
        const states = new Map<string, EntityState>([[`${i},${m}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `Row ${i} done; dp[${i}][${m}] = ${dp[i]?.[m] === 1}.`,
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
        description: match ? `"${s3}" is an interleaving.` : `"${s3}" is not an interleaving.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { match },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Interleaving String decides whether a third string s3 can be formed by merging s1 and s2 while preserving each one's character order. The DP cell dp[i][j] asks whether the first i characters of s1 and first j of s2 can form the first i+j of s3. A cell is true if its top or left predecessor is true and the newly consumed character matches.",
        "invariants": [
            "dp[i][j] records a valid interleaving of the two prefixes.",
            "The first row and column handle using only one source string.",
            "Each step consumes exactly one character from one of the two strings."
        ],
        "correctness": "The last character of a valid interleaving came from either s1 or s2, so checking the corresponding predecessor and character match covers all possibilities. The edge cases seed prefixes made from a single string. Induction over i and j therefore makes dp[n][m] true exactly when an interleaving exists.",
        "complexityRationale": "Filling an n by m table with constant work per cell takes O(n*m) time. The table uses O(n*m) space, reducible to O(m) with one row.",
        "uses": [
            "Checking merge feasibility in sequence alignment",
            "Validating shuffle or interleaving of two data streams",
            "A two-string DP pattern used in many string problems"
        ],
        "references": [
            "LeetCode problem 97, Interleaving String",
            "Cormen et al., Introduction to Algorithms, Chapter 15"
        ],
        "workedExample": "For s1 = aabcc, s2 = dbbca, and s3 = aadbbcbcac, the DP follows a path of matches consuming from each string in turn and reaches dp[5][5] true, so s3 is a valid interleaving."
    },
    id: "interleaving-string",
    name: "Interleaving String",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b7m)", space: "O(n\u00b7m)" },
    defaultInput: { s1: "aabcc", s2: "dbbca", s3: "aadbbcbcac" },
    visualType: "grid",
    run,
    pseudocode: [
        "set up dp with first row and column seeded from prefixes",
        "dp[i][j] holds whether s1[:i] and s2[:j] form s3[:i+j]",
        "dp[i][j] <- (dp[i-1][j] and s1 match) or (dp[i][j-1] and s2 match)",
        "fill rows over s1 and columns over s2 in order",
        "each cell checks the top and left predecessor characters",
        "seed edges handle single-string prefix interleavings",
        "answer <- dp[n][m] with interleave path backtraced",
    ],
};

export default module;
