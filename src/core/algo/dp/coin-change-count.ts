/**
 * coin-change-count.ts - Coin Change (Count Ways)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[a] <- dp[a] + dp[a - coin] for each coin in order.
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n\u00b7amount)
 *   Space: O(amount)
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
    const task = (input as { coins?: number[]; amount?: number } | null) ?? {};
    const coins = task.coins ?? [1, 2, 5];
    const amount = typeof task.amount === "number" ? task.amount : 5;
    let step = 0;
    if (coins.length === 0 || amount < 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty input \u2013 nothing to count.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const dp: number[] = new Array<number>(amount + 1).fill(0);
    dp[0] = 1;
    const show = () => [[...dp]];
    yield {
        stepNumber: step,
        entities: makeCells(show()),
        edges: [],
        description: `Ways to make 0..${amount} with [${coins.join(", ")}]. dp[0] = 1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { amount },
    };
    step += 1;
    for (const coin of coins) {
        for (let a = coin; a <= amount; a += 1) dp[a] += dp[a - coin] ?? 0;
        const states = new Map<string, EntityState>([[`0,${amount}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(show(), states),
            edges: [],
            description: `After coin ${coin}: dp[${amount}] = ${dp[amount]} via dp[a] += dp[a - ${coin}].`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { amount },
        };
        step += 1;
    }
    const answer = dp[amount] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(show(), new Map([[`0,${amount}`, "sorted"]])),
        edges: [],
        description: `Traceback: ${answer} ways to make ${amount}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Coin change counting asks how many combinations of given denominations sum to an amount, where order does not matter. The DP keeps dp[a] as the number of ways using coins processed so far. Iterating coins on the outside and amounts upward makes each coin extend existing counts without creating permutations of the same combination.",
        "invariants": [
            "dp[a] counts combinations of the coin types seen so far that total a.",
            "dp[0] equals one, the empty combination.",
            "Processing one coin at a time prevents counting the same multiset in different orders."
        ],
        "correctness": "When a new coin is added, every way to make a-coin using previous coins extends to a new way to make a, so adding dp[a-coin] updates the count. Because coins are processed in a fixed outer order, each multiset is formed exactly once. Therefore dp[amount] is the number of distinct combinations.",
        "complexityRationale": "There are n coins and amount inner iterations, giving O(n*amount) time. A single array of length amount plus one is needed, so space is O(amount).",
        "uses": [
            "Counting payment combinations in point-of-sale systems",
            "Combinatorial enumeration with bounded item types",
            "Counting solutions to integer sum equations"
        ],
        "references": [
            "Cormen et al., Introduction to Algorithms, Chapter 15",
            "Kleinberg and Tardos, Algorithm Design, Chapter 6"
        ],
        "workedExample": "With coins [1,2,5] and amount 5, dp[0]=1. After coin 1 all amounts have one way; adding 2 raises dp[5] to 3 (five ones, three ones plus a two, two plus two plus one); adding 5 makes dp[5]=4 including the single five."
    },
    id: "coin-change-count",
    name: "Coin Change (Count Ways)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b7amount)", space: "O(amount)" },
    defaultInput: { coins: [1, 2, 5], amount: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "set up dp[0..amount] with dp[0] <- 1 and rest 0",
        "dp[a] holds ways to make amount a with coins seen so far",
        "dp[a] <- dp[a] + dp[a - coin] for each coin in order",
        "iterate coins outer, amounts inner to avoid reorder duplicates",
        "each coin extends all reachable larger amounts",
        "accumulate combination counts without permuting coin order",
        "answer <- dp[amount] as total combinations using all coins",
    ],
};

export default module;
