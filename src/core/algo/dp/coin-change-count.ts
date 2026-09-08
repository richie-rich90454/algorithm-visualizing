/**
 * Coin Change (count ways): dp[a] += dp[a - coin] per coin.
 * Time O(n*amount), Space O(amount). Default: 4 ways.
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
            meta: {},
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
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {
    id: "coin-change-count",
    name: "Coin Change (Count Ways)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b7amount)", space: "O(amount)" },
    defaultInput: { coins: [1, 2, 5], amount: 5 },
    visualType: "grid",
    run,
};

export default module;
