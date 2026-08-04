/**
 * binary-search-lower-bound.ts – Binary Search (Lower Bound)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The lower-bound query asks: "at which index does the target *first* appear,
 * or where would it be inserted to keep the array sorted?" Unlike ordinary
 * binary search, it does not stop at the first match. Instead, on every match
 * it continues searching the left half, so it always lands on the *leftmost*
 * occurrence (or the insertion point if the target is absent).
 *
 * This is the exact behavior of C++'s `std::lower_bound` and Python's
 * `bisect_left`, and it is the building block for many ordered-set operations.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) worst/average
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The middle element is YELLOW (comparing).
 *   - The candidate answer (current lower bound) is PINK (highlight).
 *   - The final index turns GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a sorted array.
 *   - Returns the insertion index even when the target is absent, which is
 *     exactly what makes it useful for interval queries.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build the array of bar entities for a frame.
 *
 * @param arr The array values, in display order.
 * @param states Optional index → state overrides for this frame.
 * @returns An array of `VisualEntity` bars with placeholder positions.
 */
function makeBars(arr: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return arr.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/**
 * The Binary Search (Lower Bound) generator.
 *
 * @param input The search task: `{ array, target }` with a sorted array.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Normalize the input; fall back to a fixed example when malformed.
    const task = (input as { array?: number[]; target?: number } | null) ?? {};
    const arr = Array.isArray(task.array)
        ? [...(task.array as number[])]
        : [1, 3, 3, 3, 5, 7, 9, 11];
    const target = typeof task.target === "number" ? task.target : 3;

    let step = 0;
    let comparisons = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Finding the lower bound of ${target} – the leftmost index ≥ target.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, target },
    };
    step += 1;

    // `answer` keeps the leftmost index found so far; it is the insertion point.
    let low = 0;
    let high = arr.length;

    // The interval is [low, high), half-open, so high can equal arr.length.
    while (low < high) {
        const mid = low + Math.floor((high - low) / 2);
        const midValue = arr[mid];
        if (midValue === undefined) {
            break;
        }
        comparisons += 1;

        // Highlight the current probe and the running interval.
        const states = new Map<number, EntityState>();
        for (let i = low; i < high; i += 1) {
            states.set(i, "highlight");
        }
        states.set(mid, "comparing");

        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Probe ${midValue} at index ${mid} – interval [${low}..${high}).`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target, low, high, mid },
        };
        step += 1;

        if ((midValue as number) >= target) {
            // This index could be the answer – but something to the left might
            // also work, so shrink the interval leftward.
            high = mid;
        } else {
            // Everything at or left of mid is too small – discard it.
            low = mid + 1;
        }
    }

    // When the loop ends, `low` is the lower-bound index.
    const answer = low;
    const foundStates = new Map<number, EntityState>([[answer, "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeBars(arr, foundStates),
        edges: [],
        description:
            arr[answer] === target
                ? `Lower bound: first occurrence of ${target} is at index ${answer}.`
                : `${target} is absent – it would be inserted at index ${answer}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { comparisons, target, answer },
    };
}

/** The Binary Search (Lower Bound) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "binary-search-lower-bound",
    name: "Binary Search (Lower Bound)",
    category: "searching",
    complexity: { time: "O(log n)", space: "O(1)" },
    // Duplicated 3s show off the "find the leftmost" behavior clearly.
    defaultInput: { array: [1, 3, 3, 3, 5, 7, 9, 11], target: 3 },
    visualType: "array",
    run,
};

export default module;
