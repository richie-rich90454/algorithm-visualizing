/**
 * knapsack-complete.ts – Unbounded Knapsack
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The unbounded (complete) knapsack allows using each item type any number of
 * times. The DP becomes one-dimensional over capacity:
 *
 *   dp[w] = max(dp[w], dp[w - weight[i]] + value[i]) for each item i.
 *
 * Iterating w forward lets an item be reused, which is exactly the difference
 * from the 0/1 case (where w is iterated backward to prevent reuse).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n·W)
 *   Space: O(W)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The capacity cell being updated is YELLOW (comparing).
 *   - Updated cells are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The forward-vs-backward iteration direction is the entire lesson.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cell entities for the DP array.
 *
 * @param values The DP values per capacity.
 * @param states Optional index → state overrides.
 * @returns Cell entities in a single row.
 */
function makeCells(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Unbounded Knapsack generator.
 *
 * @param input `{ weights, values, capacity }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { weights?: number[]; values?: number[]; capacity?: number } | null) ?? {};
    const weights = task.weights ?? [2, 3, 4];
    const values = task.values ?? [3, 4, 5];
    const capacity = typeof task.capacity === "number" ? task.capacity : 8;

    let step = 0;

    // dp[w] = max value obtainable with total weight ≤ w.
    const dp = new Array<number>(Math.max(1, capacity + 1)).fill(0);

    // Frame 0: the initialized DP array.
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Unbounded knapsack – ${weights.length} item types, capacity ${capacity}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { capacity },
    };
    step += 1;

    // For each item type, update all capacities.
    for (let i = 0; i < weights.length; i += 1) {
        const weight = weights[i] ?? 0;
        const value = values[i] ?? 0;

        // Forward iteration allows unlimited reuse of this item.
        for (let w = weight; w <= capacity; w += 1) {
            const take = dp[w - weight] ?? 0;
            dp[w] = Math.max(dp[w] ?? 0, take + value);

            const states = new Map<number, EntityState>([[w, "comparing"]]);
            yield {
                stepNumber: step,
                entities: makeCells(dp, states),
                edges: [],
                description: `Item ${i} (w=${weight}, v=${value}): dp[${w}] = ${dp[w]}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { capacity },
            };
            step += 1;
        }

        yield {
            stepNumber: step,
            entities: makeCells(dp),
            edges: [],
            description: `Finished considering item ${i}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { capacity },
        };
        step += 1;
    }

    const finalStates = new Map<number, EntityState>();
    finalStates.set(capacity, "sorted");

    yield {
        stepNumber: step,
        entities: makeCells(dp, finalStates),
        edges: [],
        description: `Maximum value = ${dp[capacity] ?? 0}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { capacity, maxValue: dp[capacity] ?? 0 },
    };
}

/** The Unbounded Knapsack module, registered with the engine. */
const module: AlgorithmModule = {
    id: "knapsack-complete",
    name: "Knapsack (Unbounded)",
    category: "dynamic-programming",
    complexity: { time: "O(n·W)", space: "O(W)" },
    // Items (2,3),(3,4),(4,5) with capacity 8 → max value 12 (four 2-weight).
    defaultInput: { weights: [2, 3, 4], values: [3, 4, 5], capacity: 8 },
    visualType: "grid",
    run,
};

export default module;
