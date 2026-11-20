/**
 * burst-balloons.ts - Burst Balloons
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[l][r] <- max over k of val[l]*val[k]*val[r] + dp[l][k] + dp[k][r].
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n\u00b3)
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
    const nums = task.nums ?? [3, 1, 5, 8];
    let step = 0;
    if (nums.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty input \u2013 zero coins.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const n = nums.length;
    const val = [1, ...nums, 1];
    const dp: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Burst [${nums.join(", ")}]; padded values [${val.join(", ")}]. dp[l][l] base next.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let len = 1; len <= n; len += 1) {
        let desc = "";
        for (let l = 0; l + len - 1 < n; l += 1) {
            const r = l + len - 1;
            let best = 0;
            let bestK = l;
            for (let k = l; k <= r; k += 1) {
                const left = k > l ? (dp[l]?.[k - 1] ?? 0) : 0;
                const right = k < r ? (dp[k + 1]?.[r] ?? 0) : 0;
                const gain = (val[l] ?? 1) * (val[k + 1] ?? 1) * (val[r + 2] ?? 1);
                const total = gain + left + right;
                if (total > best) {
                    best = total;
                    bestK = k;
                }
            }
            dp[l][r] = best;
            if (l === 0) desc = `dp[0][${r}] = ${best} (last-burst k=${bestK}).`;
        }
        const states = new Map<string, EntityState>([[`0,${len - 1}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `Length ${len} intervals filled. ${desc}`,
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
        description: `Traceback: max coins dp[0][${n - 1}] = ${answer}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Burst Balloons asks for the maximum coins obtained by bursting balloons, where bursting one multiplies its value by its current neighbors. The trick is to think about which balloon is burst last in an interval; adding sentinel ones at both ends fixes the neighbors. Then interval DP chooses the last balloon to maximize the sum of left and right subproblems plus the final reward.",
        "invariants": [
            "dp[l][r] is the maximum coins from bursting balloons strictly between l and r.",
            "Balloons l and r are still unburst when any balloon inside is popped.",
            "Intervals are filled in increasing length so inner solutions are final."
        ],
        "correctness": "The last balloon burst inside an interval has the sentinels or interval boundaries as its neighbors at that moment, giving a fixed reward of val[l]*val[k]*val[r]. The balloons on each side of k are then independent subproblems, so trying every k and taking the maximum captures the optimal last burst. Induction over interval length proves correctness.",
        "complexityRationale": "There are O(n^2) intervals and O(n) choices of last balloon in each, costing O(n^3) time. The DP table uses O(n^2) space.",
        "uses": [
            "Interval DP with a choose-the-last-element trick",
            "Optimal evaluation order in chained multiplicative expressions",
            "Competitive programming examples of reversing intuition"
        ],
        "references": [
            "LeetCode problem 312, Burst Balloons",
            "Cormen et al., Introduction to Algorithms, Chapter 15"
        ],
        "workedExample": "With nums [3,1,5,8] padded by ones, dp over intervals eventually considers bursting 5 last between 1 and 8. The reward 1*5*8 plus the best left and right intervals gives the maximum coin total."
    },
    id: "burst-balloons",
    name: "Burst Balloons",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b3)", space: "O(n\u00b2)" },
    defaultInput: { nums: [3, 1, 5, 8] },
    visualType: "grid",
    run,
    pseudocode: [
        "set up padded values with 1 on both ends, dp[l][r] <- 0",
        "dp[l][r] holds max coins from open interval (l, r)",
        "dp[l][r] <- max over k of val[l]*val[k]*val[r] + dp[l][k] + dp[k][r]",
        "fill intervals by increasing length from 2 upward",
        "try each k as the last balloon burst in the interval",
        "combine side results with the last-burst reward",
        "answer <- dp[0][n-1] with burst order from best-k choices",
    ],
};

export default module;
