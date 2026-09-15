/**
 * stock-with-cooldown.ts - Stock with Cooldown
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: hold <- max(hold, prevCash - price); cash <- max(cash, hold + price).
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
    const prices = task.prices ?? [1, 2, 3, 0, 2];
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
    let hold = -(prices[0] ?? 0);
    let cash = 0;
    let prevCash = 0;
    const show = () => [[hold, cash]];
    yield {
        stepNumber: step,
        entities: makeCells(show()),
        edges: [],
        description: `Cooldown strategy on [${prices.join(", ")}]. hold = ${hold}, cash = 0.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n: prices.length },
    };
    step += 1;
    for (let d = 1; d < prices.length; d += 1) {
        const p = prices[d] ?? 0;
        const newHold = Math.max(hold, prevCash - p);
        const newCash = Math.max(cash, hold + p);
        prevCash = cash;
        hold = newHold;
        cash = newCash;
        const states = new Map<string, EntityState>([["0,1", "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(show(), states),
            edges: [],
            description: `Day ${d} (price ${p}): hold = ${hold}, cash = ${cash}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n: prices.length },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(show(), new Map([["0,1", "sorted"]])),
        edges: [],
        description: `Traceback: max profit with cooldown = ${cash}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer: cash },
    };
}

const module: AlgorithmModule = {
    id: "stock-with-cooldown",
    name: "Stock with Cooldown",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { prices: [1, 2, 3, 0, 2] },
    visualType: "grid",
    run,
    pseudocode: [
        "set up hold <- -inf and cash <- 0 before day one",
        "hold is best owning stock, cash is best flat after cooldown",
        "hold <- max(hold, prevCash - price); cash <- max(cash, hold + price)",
        "scan days keeping previous cash for the cooldown delay",
        "buys use cash from two days back honoring the rest day",
        "sells convert held value into realized cash balance",
        "answer <- cash as max profit honoring the cooldown rule",
    ],
};

export default module;
