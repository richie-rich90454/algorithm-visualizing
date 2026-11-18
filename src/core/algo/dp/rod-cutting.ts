/**
 * rod-cutting.ts - Rod Cutting
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[L] <- max over first cut c of price[c] + dp[L-c].
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
            meta: { step },
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
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer: dp[n] },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Rod cutting finds how to cut a rod of length n into pieces maximizing total price given a price table by length. The DP defines dp[L] as the best revenue from a rod of length L. Trying every first cut c combines price[c] with dp[L-c], which is already known because shorter lengths are computed first.",
        "invariants": [
            "dp[L] is the maximum revenue obtainable from a rod of length L.",
            "dp[0] is zero for an empty rod.",
            "Every candidate first cut leaves a shorter rod whose optimum is final."
        ],
        "correctness": "Any optimal cutting pattern begins with some first piece of length c, and the remainder of length L-c must itself be cut optimally. Maximizing price[c] plus dp[L-c] over all feasible c therefore captures the optimum. Induction on L proves correctness, and recording the best c reconstructs the cuts.",
        "complexityRationale": "For each length up to n the algorithm tries up to n first cuts, costing O(n^2) time. Storing the revenue array and cut choices uses O(n) space.",
        "uses": [
            "Cutting stock and material optimization",
            "A canonical optimal substructure example",
            "Foundation for more complex partition problems"
        ],
        "references": [
            "Cormen et al., Introduction to Algorithms, Section 15.1",
            "Kleinberg and Tardos, Algorithm Design, Chapter 6"
        ],
        "workedExample": "With prices [1,5,8,9] and n = 4, dp builds to dp[4] = 10 by cutting into two pieces of length 2, each worth 5, beating the uncut price of 9."
    },
    id: "rod-cutting",
    name: "Rod Cutting",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b2)", space: "O(n)" },
    defaultInput: { prices: [1, 5, 8, 9], n: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "set up dp[0] <- 0 with no revenue for empty rod",
        "dp[L] holds max revenue for rod length L",
        "dp[L] <- max over first cut c of price[c] + dp[L-c]",
        "iterate lengths from 1 to n building on shorter rods",
        "try every feasible first-cut length per total",
        "combine cut price with optimal remainder revenue",
        "answer <- dp[n] with cut lengths reconstructed",
    ],
};

export default module;
