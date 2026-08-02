/**
 * binary-search-upper-bound.ts – Binary Search (Upper Bound)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The upper-bound query asks: "at which index would the target be inserted so
 * that it lands *after* every existing copy?" It is the mirror image of the
 * lower bound. The search probes the middle, and whenever the middle value is
 * *greater* than the target, the interval shrinks leftward; whenever the
 * middle value is less than or *equal* to the target, the interval moves
 * right. The result is the index of the first element strictly greater than
 * the target.
 *
 * This is C++'s `std::upper_bound` and Python's `bisect_right`. Together with
 * the lower bound it defines the full range of equal elements:
 * `[lower_bound, upper_bound)`.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) worst/average
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The middle element is YELLOW (comparing).
 *   - The running interval is PINK (highlight).
 *   - The final index turns GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a sorted array.
 *   - Answer = lower_bound of (target + 1), conceptually.
 *   - The equal range of a value is found by running both bounds.
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
 * The Binary Search (Upper Bound) generator.
 *
 * @param input The search task: `{ array, target }` with a sorted array.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Normalise the input; fall back to a fixed example when malformed.
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
        description: `Finding the upper bound of ${target} – the first index where elements exceed it.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, target },
    };
    step += 1;

    // Half-open interval [low, high); `high` may reach arr.length.
    let low = 0;
    let high = arr.length;

    while (low < high) {
        const mid = low + Math.floor((high - low) / 2);
        const midValue = arr[mid];
        if (midValue === undefined) {
            break;
        }
        comparisons += 1;

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

        if ((midValue as number) > target) {
            // Strictly greater elements are still candidates for the answer –
            // search further left to find the very first of them.
            high = mid;
        } else {
            // Equal or smaller elements cannot be the answer – go right.
            low = mid + 1;
        }
    }

    // `low` is the upper-bound index when the loop exits.
    const answer = low;
    const foundStates = new Map<number, EntityState>([[answer, "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeBars(arr, foundStates),
        edges: [],
        description: `Upper bound: first element greater than ${target} is at index ${answer}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { comparisons, target, answer },
    };
}

/** The Binary Search (Upper Bound) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "binary-search-upper-bound",
    name: "Binary Search (Upper Bound)",
    category: "searching",
    complexity: { time: "O(log n)", space: "O(1)" },
    // Same duplicate-heavy input as the lower bound for a paired lesson.
    defaultInput: { array: [1, 3, 3, 3, 5, 7, 9, 11], target: 3 },
    visualType: "array",
    run,
};

export default module;
