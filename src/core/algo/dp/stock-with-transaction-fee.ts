/**
 * stock-with-transaction-fee.ts - Stock with Transaction Fee
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: hold <- max(hold, cash - price); cash <- max(cash, hold + price - fee).
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
    const task = (input as { prices?: number[]; fee?: number } | null) ?? {};
    const prices = task.prices ?? [1, 3, 2, 8, 4, 9];
    const fee = typeof task.fee === "number" ? task.fee : 2;
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
    let cash = 0;
    let hold = -(prices[0] ?? 0) - fee;
    const show = () => [[cash, hold]];
    yield {
        stepNumber: step,
        entities: makeCells(show()),
        edges: [],
        description: `Fee ${fee} on [${prices.join(", ")}]. hold = ${hold}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n: prices.length },
    };
    step += 1;
    for (let d = 1; d < prices.length; d += 1) {
        const p = prices[d] ?? 0;
        cash = Math.max(cash, hold + p);
        hold = Math.max(hold, cash - p - fee);
        const states = new Map<string, EntityState>([["0,0", "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(show(), states),
            edges: [],
            description: `Day ${d} (price ${p}): cash = ${cash}, hold = ${hold}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n: prices.length },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(show(), new Map([["0,0", "sorted"]])),
        edges: [],
        description: `Traceback: max profit with fee ${fee} = ${cash}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer: cash },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Stock with transaction fee charges a fixed cost each time a trade is completed. Two states track the best balance while holding a stock and while flat. Buying reduces cash by the price; selling adds the price back but subtracts the fee, so the charge is applied exactly once per round trip.",
        "invariants": [
            "hold is the best balance while owning a stock after the current day.",
            "cash is the best flat balance after selling and paying any fee.",
            "The fee is deducted only on a sell, once per completed transaction."
        ],
        "correctness": "If a sale is optimal on a day, the balance becomes hold plus that day's price minus the fee, so placing the fee on the sell counts each transaction once. Buying from cash spends the price without a fee. Maximizing both states daily yields the optimal profit by induction.",
        "complexityRationale": "A single pass over n prices updating two variables is O(n) time and O(1) space.",
        "uses": [
            "Modeling trading commissions in profit maximization",
            "State-machine DP with per-transition costs",
            "Extending stock problems with fees and constraints"
        ],
        "references": [
            "LeetCode problem 714, Best Time to Buy and Sell Stock with Transaction Fee",
            "Kleinberg and Tardos, Algorithm Design, Chapter 6"
        ],
        "workedExample": "For prices [1,3,2,8,4,9] with fee 2, buying at 1 and selling at 8 nets 5 after the fee, then buying at 4 and selling at 9 nets another 3. The DP reports total profit 8."
    },
    id: "stock-with-transaction-fee",
    name: "Stock with Transaction Fee",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { prices: [1, 3, 2, 8, 4, 9], fee: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "set up hold <- -prices[0] and cash <- 0 as bases",
        "hold is best owning stock, cash is best flat balance",
        "hold <- max(hold, cash - price); cash <- max(cash, hold + price - fee)",
        "scan days updating hold before cash per price",
        "buys spend cash while sells deduct the fixed fee",
        "fee applies once per completed round-trip trade",
        "answer <- cash as max profit after all trading fees",
    ],
};

export default module;
