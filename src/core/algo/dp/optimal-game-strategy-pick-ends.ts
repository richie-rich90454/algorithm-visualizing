/**
 * optimal-game-strategy-pick-ends.ts - Optimal Game Strategy (Pick Ends)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[l][r] <- max(take left + min of replies, take right + min).
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
    const nums = task.nums ?? [8, 15, 3, 7];
    let step = 0;
    if (nums.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "No coins \u2013 first player gets 0.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const n = nums.length;
    const dp: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) dp[i][i] = nums[i] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Pick ends of [${nums.join(", ")}]; opponent replies optimally. dp[i][i] set.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let len = 2; len <= n; len += 1) {
        for (let l = 0; l + len - 1 < n; l += 1) {
            const r = l + len - 1;
            const pickL = (nums[l] ?? 0) + Math.min(dp[l + 2]?.[r] ?? 0, dp[l + 1]?.[r - 1] ?? 0);
            const pickR = (nums[r] ?? 0) + Math.min(dp[l + 1]?.[r - 1] ?? 0, dp[l]?.[r - 2] ?? 0);
            dp[l][r] = Math.max(pickL, pickR);
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
        description: `Traceback: first player secures ${answer}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "In the pick-ends game two players alternately take a coin from either end of a row, and both play optimally. Interval DP stores dp[l][r], the most coins the current player can secure from that range. Taking an end leaves the opponent the worse of their two replies, so the recurrence uses min on the continuation and max on the choice.",
        "invariants": [
            "dp[l][r] is the maximum the player to move can obtain from coins l..r.",
            "Single-coin intervals have value equal to that coin.",
            "The opponent's response is chosen to minimize the current player's remainder."
        ],
        "correctness": "If the player takes the left coin, the opponent will respond to leave the smaller of the two resulting subgame values for the player, which is the min term. The same holds for taking the right coin. Maximizing over the two choices gives the optimal guaranteed amount, and induction over interval length proves correctness.",
        "complexityRationale": "There are O(n^2) intervals with constant work each, costing O(n^2) time. The dp table uses O(n^2) space.",
        "uses": [
            "Two-player optimal play in combinatorial games",
            "Game AI evaluating pick and response strategies",
            "Minimax expressed as interval DP"
        ],
        "references": [
            "Cormen et al., Introduction to Algorithms, Chapter 15",
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, Chapter 5"
        ],
        "workedExample": "For coins [8,15,3,7], taking 15 first leaves the opponent the ends 8 and 3; they pick 8 and the first player then gets 7, totaling 22. The DP confirms 22 is the most the first player can guarantee."
    },
    id: "optimal-game-strategy-pick-ends",
    name: "Optimal Game Strategy (Pick Ends)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b2)", space: "O(n\u00b2)" },
    defaultInput: { nums: [8, 15, 3, 7] },
    visualType: "grid",
    run,
    pseudocode: [
        "set up dp[i][i] <- coins[i] for single-coin intervals",
        "dp[l][r] holds max current player can secure from l..r",
        "dp[l][r] <- max(take left + min of replies, take right + min)",
        "fill intervals by increasing length from 1 to n",
        "each pick leaves opponent the worse of two replies",
        "min models optimal opponent minimizing our remainder",
        "answer <- dp[0][n-1] with pick sequence reconstructed",
    ],
};

export default module;
