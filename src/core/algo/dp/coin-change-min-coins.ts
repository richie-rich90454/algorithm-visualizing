/**
 * coin-change-min-coins.ts - Coin Change (Min Coins)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[a] <- 1 + min over coins c <= a of dp[a - c].
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
    if (coins.length === 0 || amount <= 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty input \u2013 nothing to compute.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const INF = amount + 1;
    const dp: number[] = new Array<number>(amount + 1).fill(INF);
    dp[0] = 0;
    const show = () => [dp.map((v) => (v > amount ? -1 : v))];
    yield {
        stepNumber: step,
        entities: makeCells(show()),
        edges: [],
        description: `Min coins for 0..${amount} with [${coins.join(", ")}]. dp[0] = 0.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { amount },
    };
    step += 1;
    for (let a = 1; a <= amount; a += 1) {
        let best = INF;
        let used = 0;
        for (const c of coins) {
            if (c <= a && (dp[a - c] ?? INF) + 1 < best) {
                best = (dp[a - c] ?? INF) + 1;
                used = c;
            }
        }
        dp[a] = best;
        const states = new Map<string, EntityState>([[`0,${a}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(show(), states),
            edges: [],
            description: `dp[${a}] = dp[${a - used}] + 1 = ${best} using coin ${used}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { amount },
        };
        step += 1;
    }
    const answer = dp[amount] ?? INF;
    yield {
        stepNumber: step,
        entities: makeCells(show(), new Map([[`0,${amount}`, "sorted"]])),
        edges: [],
        description: `Traceback: min coins for ${amount} = ${answer > amount ? "unreachable" : answer}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {
    id: "coin-change-min-coins",
    name: "Coin Change (Min Coins)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b7amount)", space: "O(amount)" },
    defaultInput: { coins: [1, 2, 5], amount: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "set up dp[0] <- 0 and dp[a] <- infinity for a > 0",
        "dp[a] holds fewest coins making amount a",
        "dp[a] <- 1 + min over coins c <= a of dp[a - c]",
        "iterate amounts from 1 to amount in increasing order",
        "try every coin denomination fitting the current amount",
        "keep the minimum coin count plus its chosen coin",
        "answer <- dp[amount] with coins reconstructed via parent picks",
    ],
};

export default module;
