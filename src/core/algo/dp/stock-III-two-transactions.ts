/**
 * stock-III-two-transactions.ts - Stock III (Two Transactions)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: sell2 <- max(sell2, buy2 + price) per day closing trade.
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)
 *   Space: O(1)
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
    const task = (input as { prices?: number[] } | null) ?? {};
    const prices = task.prices ?? [3, 3, 5, 0, 0, 3, 1, 4];
    let step = 0;
    if (prices.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "No prices \u2013 zero profit.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    let buy1 = -(prices[0] ?? 0);
    let sell1 = 0;
    let buy2 = -(prices[0] ?? 0);
    let sell2 = 0;
    const show = () => [[buy1, sell1, buy2, sell2]];
    yield {
        stepNumber: step,
        entities: makeCells(show()),
        edges: [],
        description: `At most 2 trades on [${prices.join(", ")}]. buy1 = ${buy1}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n: prices.length },
    };
    step += 1;
    for (let d = 1; d < prices.length; d += 1) {
        const p = prices[d] ?? 0;
        buy1 = Math.max(buy1, -p);
        sell1 = Math.max(sell1, buy1 + p);
        buy2 = Math.max(buy2, sell1 - p);
        sell2 = Math.max(sell2, buy2 + p);
        const states = new Map<string, EntityState>([["0,3", "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(show(), states),
            edges: [],
            description: `Day ${d} (price ${p}): sell2 = ${sell2}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n: prices.length },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(show(), new Map([["0,3", "sorted"]])),
        edges: [],
        description: `Traceback: max profit with \u22642 trades = ${sell2}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer: sell2 },
    };
}

const module: AlgorithmModule = {
    id: "stock-III-two-transactions",
    name: "Stock III (Two Transactions)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { prices: [3, 3, 5, 0, 0, 3, 1, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "set up buy1 <- -inf, sell1 <- 0, buy2 <- -inf, sell2 <- 0",
        "states hold best balance with 0, 1, or 2 trades done",
        "sell2 <- max(sell2, buy2 + price) per day closing trade",
        "scan prices updating buy1, sell1, buy2, sell2 in order",
        "each buy subtracts price, each sell adds price back",
        "later states build only on earlier completed trades",
        "answer <- sell2 as max profit with at most 2 trades",
    ],};

export default module;
