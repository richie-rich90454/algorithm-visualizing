/**
 * knapsack-01.ts – 0/1 Knapsack
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The 0/1 knapsack problem: given items with (weight, value) pairs and a
 * capacity W, choose a subset maximising total value without exceeding W.
 * Each item is used at most once. The DP:
 *
 *   dp[i][w] = max(dp[i-1][w], dp[i-1][w - weight[i]] + value[i])
 *
 * over items i and capacities w.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n·W)
 *   Space: O(n·W)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The cell being computed is YELLOW (comparing).
 *   - The chosen item's cells are GREEN (sorted).
 *   - The optimal total value is highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The archetypal "choose or skip" DP template.
 *   - Pseudo-polynomial: fast for small capacities.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a matrix of cell entities for a frame.
 *
 * @param matrix The DP table.
 * @param states Optional `row,col` → state overrides.
 * @returns Cell entities with row/col metadata (grid layout).
 */
function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const matrixRow = matrix[row];
        if (!matrixRow) {
            continue;
        }
        for (let col = 0; col < matrixRow.length; col += 1) {
            const value = matrixRow[col];
            if (value === undefined) {
                continue;
            }
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: states.get(`${row},${col}`) ?? "unvisited",
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

/**
 * The 0/1 Knapsack generator.
 *
 * @param input `{ weights, values, capacity }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { weights?: number[]; values?: number[]; capacity?: number } | null) ?? {};
    const weights = task.weights ?? [2, 3, 4, 5];
    const values = task.values ?? [3, 4, 5, 6];
    const capacity = typeof task.capacity === "number" ? task.capacity : 5;

    const rows = weights.length + 1;
    const cols = capacity + 1;
    let step = 0;

    const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

    // Frame 0: the initialized table.
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `0/1 knapsack – ${weights.length} items, capacity ${capacity}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols },
    };
    step += 1;

    // Fill the table.
    for (let i = 1; i <= weights.length; i += 1) {
        for (let w = 0; w <= capacity; w += 1) {
            const weight = weights[i - 1] ?? 0;
            const value = values[i - 1] ?? 0;
            const skip = dp[i - 1]?.[w] ?? 0;

            if (weight > w) {
                // The item does not fit – carry the previous row.
                dp[i][w] = skip;
            } else {
                const take = (dp[i - 1]?.[w - weight] ?? 0) + value;
                dp[i][w] = Math.max(skip, take);
            }

            const states = new Map<string, EntityState>([[`${i},${w}`, "comparing"]]);
            yield {
                stepNumber: step,
                entities: makeCells(dp, states),
                edges: [],
                description: `Item ${i} (w=${weight}, v=${value}) at capacity ${w} → ${dp[i]?.[w]}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { rows, cols },
            };
            step += 1;
        }
    }

    // The answer.
    const maxValue = dp[weights.length]?.[capacity] ?? 0;

    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Maximum value = ${maxValue}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows, cols, maxValue },
    };
}

/** The 0/1 Knapsack module, registered with the engine. */
const module: AlgorithmModule = {
    id: "knapsack-01",
    name: "Knapsack (0/1)",
    category: "dynamic-programming",
    complexity: { time: "O(n·W)", space: "O(n·W)" },
    // Items (2,3),(3,4),(4,5),(5,6) with capacity 5 → max value 7.
    defaultInput: { weights: [2, 3, 4, 5], values: [3, 4, 5, 6], capacity: 5 },
    visualType: "grid",
    run,
};

export default module;
