/**
 * word-break-count.ts - Word Break (Count)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[i] <- sum over words w ending at i of dp[i-len(w)].
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n\u00b2)
 *   Space: O(n)
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
    const task = (input as { s?: string; dict?: string[] } | null) ?? {};
    const s = typeof task.s === "string" ? task.s : "catsanddog";
    const dict = task.dict ?? ["cat", "cats", "and", "sand", "dog"];
    let step = 0;
    if (s.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[1]]),
            edges: [],
            description: "Empty string \u2013 one (empty) segmentation.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const words = new Set(dict);
    const n = s.length;
    const dp: number[] = new Array<number>(n + 1).fill(0);
    dp[0] = 1;
    yield {
        stepNumber: step,
        entities: makeCells([[...dp]]),
        edges: [],
        description: `Segment "${s}" with [${dict.join(", ")}]. dp[0] = 1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let i = 1; i <= n; i += 1) {
        let total = 0;
        let piece = "";
        for (let j = 0; j < i; j += 1) {
            const sub = s.slice(j, i);
            if (words.has(sub)) {
                total += dp[j] ?? 0;
                piece = sub;
            }
        }
        dp[i] = total;
        const states = new Map<string, EntityState>([[`0,${i}`, total > 0 ? "comparing" : "idle"]]);
        yield {
            stepNumber: step,
            entities: makeCells([[...dp]], states),
            edges: [],
            description: `dp[${i}] = ${total}${piece ? ` (ends with "${piece}")` : ""}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    const answer = dp[n] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells([[...dp]], new Map([[`0,${n}`, "sorted"]])),
        edges: [],
        description: `Traceback: ${answer} segmentation(s) of "${s}".`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Word break counting finds how many ways a string can be segmented into words from a dictionary. The DP cell dp[i] holds the number of segmentations of the prefix ending at i. For each dictionary word that ends at i, its starting prefix contributes dp[start], and summing over matching words gives the count.",
        "invariants": [
            "dp[i] counts segmentations of s[:i].",
            "dp[0] is one for the empty prefix.",
            "Only words that exactly match a suffix ending at i are considered."
        ],
        "correctness": "Every segmentation of the prefix ending at i has a final word w ending at i, and the prefix before w can be segmented in dp[i-len(w)] ways. Summing over all such words counts each segmentation by its unique last word, so dp[n] is the total number of ways.",
        "complexityRationale": "For each end position the algorithm checks dictionary words, costing O(n^2) in the stated bound with a bounded word list. The dp array uses O(n) space.",
        "uses": [
            "Counting sentence segmentations in natural language processing",
            "Tokenization with ambiguous word boundaries",
            "String segmentation counting problems"
        ],
        "references": [
            "LeetCode problem 139, Word Break",
            "Cormen et al., Introduction to Algorithms, Chapter 15"
        ],
        "workedExample": "For s = catsanddog with words cat, cats, and, sand, dog, the string splits as cat sand dog or cats and dog, so dp[10] = 2."
    },
    id: "word-break-count",
    name: "Word Break (Count)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b2)", space: "O(n)" },
    defaultInput: { s: "catsanddog", dict: ["cat", "cats", "and", "sand", "dog"] },
    visualType: "grid",
    run,
    pseudocode: [
        "set up dp[0] <- 1 as the empty-prefix base",
        "dp[i] holds segmentations of prefix s[:i]",
        "dp[i] <- sum over words w ending at i of dp[i-len(w)]",
        "iterate end positions with dictionary words checked",
        "each matching suffix extends counts from its start",
        "accumulate segmentation counts across all word options",
        "answer <- dp[n] as total segmentations of the string",
    ],
};

export default module;
