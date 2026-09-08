/**
 * Coin Change (min coins): dp[a] = min(dp[a-c] + 1).
 * Time O(n*amount), Space O(amount). Default answer: 1.
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
            meta: {},
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
        codeLineNumber: 4,
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
};

export default module;
