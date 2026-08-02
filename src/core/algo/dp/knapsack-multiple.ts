/**
 * knapsack-multiple.ts – Bounded Knapsack (each item has a limited count)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The bounded knapsack gives each item type a limited number of copies. The
 * 0/1 DP can be applied by expanding every copy into a separate item, but the
 * bounded variant is more efficient using the count directly:
 *
 *   dp[w] = max over c = 0..count of (dp[w - c·weight] + c·value)
 *
 * This is the middle ground between the 0/1 and unbounded cases.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n·W·count)
 *   Space: O(W)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The capacity cell being updated is YELLOW (comparing).
 *   - The copy count being considered is narrated.
 *   - Final values are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The bounded count makes it the most general of the three knapsack DPs.
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
 * The Bounded Knapsack generator.
 *
 * @param input `{ weights, values, counts, capacity }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            weights?: number[];
            values?: number[];
            counts?: number[];
            capacity?: number;
        } | null) ?? {};
    const weights = task.weights ?? [2, 3, 4];
    const values = task.values ?? [3, 4, 5];
    const counts = task.counts ?? [2, 2, 2];
    const capacity = typeof task.capacity === "number" ? task.capacity : 8;

    let step = 0;

    const dp = new Array<number>(capacity + 1).fill(0);

    // Frame 0: the initialised DP array.
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Bounded knapsack – ${weights.length} item types with limited copies, capacity ${capacity}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { capacity },
    };
    step += 1;

    // For each item type, consider taking 0..count copies.
    for (let i = 0; i < weights.length; i += 1) {
        const weight = weights[i] ?? 0;
        const value = values[i] ?? 0;
        const count = counts[i] ?? 0;

        // Backward iteration keeps each copy distinct (0/1 style per copy).
        for (let w = capacity; w >= 0; w -= 1) {
            for (let c = 1; c <= count; c += 1) {
                if (w - c * weight < 0) {
                    break;
                }
                const take = (dp[w - c * weight] ?? 0) + c * value;
                dp[w] = Math.max(dp[w] ?? 0, take);
            }

            const states = new Map<number, EntityState>([[w, "comparing"]]);
            yield {
                stepNumber: step,
                entities: makeCells(dp, states),
                edges: [],
                description: `Item ${i} (w=${weight}, v=${value}, ×${count}): dp[${w}] = ${dp[w]}.`,
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
        description: `Maximum value = ${dp[capacity]}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { capacity, maxValue: dp[capacity] },
    };
}

/** The Bounded Knapsack module, registered with the engine. */
const module: AlgorithmModule = {
    id: "knapsack-multiple",
    name: "Knapsack (Bounded)",
    category: "dynamic-programming",
    complexity: { time: "O(n·W·count)", space: "O(W)" },
    // Three item types, two copies each, capacity 8.
    defaultInput: { weights: [2, 3, 4], values: [3, 4, 5], counts: [2, 2, 2], capacity: 8 },
    visualType: "grid",
    run,
};

export default module;
