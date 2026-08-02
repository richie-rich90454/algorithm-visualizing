/**
 * kadane.ts – Kadane's Algorithm (maximum subarray sum)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Kadane's algorithm finds the maximum sum of any contiguous subarray in O(n).
 * It walks the array once, maintaining `best` = the best subarray sum ending
 * at the current position. When adding the next element, it keeps either the
 * element alone (restarting the subarray) or extends the previous best.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The current element is YELLOW (comparing).
 *   - The running best subarray is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The "restart or extend" decision is the entire idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cells for the array.
 *
 * @param values The array values.
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
 * The Kadane generator.
 *
 * @param input `{ array }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[] } | null) ?? {};
    const array = task.array ?? [-2, 1, -3, 4, -1, 2, 1, -5, 4];

    let step = 0;
    let bestEndingHere = -Infinity;
    let bestOverall = -Infinity;
    let bestStart = 0;
    let currentStart = 0;

    // Frame 0: the array.
    yield {
        stepNumber: step,
        entities: makeCells(array),
        edges: [],
        description: `Kadane's algorithm – maximum subarray sum of [${array.join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { bestOverall: -Infinity },
    };
    step += 1;

    for (let i = 0; i < array.length; i += 1) {
        const value = array[i] ?? 0;

        // Restart or extend?
        if (bestEndingHere + value > value) {
            bestEndingHere += value;
        } else {
            bestEndingHere = value;
            currentStart = i;
        }

        if (bestEndingHere > bestOverall) {
            bestOverall = bestEndingHere;
            bestStart = currentStart;
        }

        // Highlight the current element and the best subarray so far.
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        for (let k = bestStart; k <= i; k += 1) {
            states.set(k, "sorted");
        }

        yield {
            stepNumber: step,
            entities: makeCells(array, states),
            edges: [],
            description: `At index ${i} (${value}): best ending here = ${bestEndingHere}, best overall = ${bestOverall}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { bestEndingHere, bestOverall },
        };
        step += 1;
    }

    const finalStates = new Map<number, EntityState>();
    for (let k = bestStart; k < array.length; k += 1) {
        finalStates.set(k, "sorted");
    }

    yield {
        stepNumber: step,
        entities: makeCells(array, finalStates),
        edges: [],
        description: `Maximum subarray sum = ${bestOverall}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { bestOverall },
    };
}

/** The Kadane module, registered with the engine. */
const module: AlgorithmModule = {
    id: "kadane",
    name: "Kadane's Algorithm",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { array: [-2, 1, -3, 4, -1, 2, 1, -5, 4] },
    visualType: "grid",
    run,
};

export default module;
