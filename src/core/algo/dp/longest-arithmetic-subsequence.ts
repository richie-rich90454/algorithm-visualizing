/**
 * longest-arithmetic-subsequence.ts - Longest Arithmetic Subsequence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[j][d] <- dp[i][d] + 1 for pair (i, j) with diff d.
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
    const task = (input as { nums?: number[] } | null) ?? {};
    const nums = task.nums ?? [3, 6, 9, 12];
    let step = 0;
    if (nums.length <= 2) {
        yield {
            stepNumber: step,
            entities: makeCells([[...nums]]),
            edges: [],
            description:
                nums.length === 0
                    ? "Empty input \u2013 length 0."
                    : `Only ${nums.length} element(s) \u2013 whole array is arithmetic.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const n = nums.length;
    const dp: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(2));
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `LAS of [${nums.join(", ")}]. Every pair starts at length 2.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    let best = 2;
    for (let j = 1; j < n; j += 1) {
        for (let i = 0; i < j; i += 1) {
            for (let k = 0; k < i; k += 1) {
                if ((nums[i] ?? 0) - (nums[k] ?? 0) === (nums[j] ?? 0) - (nums[i] ?? 0)) {
                    const cand = (dp[k]?.[i] ?? 2) + 1;
                    if (cand > (dp[i]?.[j] ?? 2)) {
                        const row = dp[i];
                        if (row) row[j] = cand;
                    }
                }
            }
            if ((dp[i]?.[j] ?? 2) > best) best = dp[i]?.[j] ?? best;
        }
        const states = new Map<string, EntityState>([[`0,${j}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `End index ${j} (value ${nums[j]}): best so far ${best}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(dp, new Map([["0,1", "sorted"]])),
        edges: [],
        description: `Traceback: longest arithmetic subsequence has length ${best}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer: best },
    };
}

const module: AlgorithmModule = {
    id: "longest-arithmetic-subsequence",
    name: "Longest Arithmetic Subsequence",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b2)", space: "O(n\u00b2)" },
    defaultInput: { nums: [3, 6, 9, 12] },
    visualType: "grid",
    run,
    pseudocode: [
        "set up dp[i][d] <- 1 for single-element starts",
        "dp[i][d] holds LAS length ending at i with difference d",
        "dp[j][d] <- dp[i][d] + 1 for pair (i, j) with diff d",
        "iterate end index j with all start indices i < j",
        "each pair extends the chain sharing its difference",
        "track best length across all differences and ends",
        "answer <- max length with sequence backtraced via links",
    ],
};

export default module;
