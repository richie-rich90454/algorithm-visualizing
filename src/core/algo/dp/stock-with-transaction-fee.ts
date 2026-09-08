/**
 * Stock with Fee: cash/hold; buy pays fee: hold = max(hold, cash - p - fee).
 * Time O(n), Space O(1). Default [1,3,2,8,4,9] fee 2 -> 8.
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
            meta: {},
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
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer: cash },
    };
}

const module: AlgorithmModule = {
    id: "stock-with-transaction-fee",
    name: "Stock with Transaction Fee",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { prices: [1, 3, 2, 8, 4, 9], fee: 2 },
    visualType: "grid",
    run,
};

export default module;
