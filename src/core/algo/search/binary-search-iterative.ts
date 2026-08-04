/**
 * binary-search-iterative.ts – Binary Search (Iterative)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Binary search finds a target in a *sorted* array by repeatedly halving the
 * search interval. It compares the middle element to the target: if equal, it
 * returns; if the middle is smaller than the target, the target must live in
 * the right half; if larger, in the left half. Each step discards half of the
 * remaining candidates, so a search over n elements needs only about log₂n
 * comparisons.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) worst/average, O(1) best
 *   Space: O(1) auxiliary – the iterative version keeps just two pointers
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The middle element is YELLOW (comparing).
 *   - The active search interval is tinted PINK (highlight) – it visibly
 *     halves with every step.
 *   - A hit turns GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a sorted array – the input here is always sorted.
 *   - The classic "divide and conquer" template for interval searches.
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
 * The iterative Binary Search generator.
 *
 * @param input The search task: `{ array, target }` with a sorted array.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Normalize the input; fall back to a fixed example when malformed.
    const task = (input as { array?: number[]; target?: number } | null) ?? {};
    const arr = Array.isArray(task.array)
        ? [...(task.array as number[])]
        : [1, 3, 5, 7, 9, 11, 13, 15];
    const target = typeof task.target === "number" ? task.target : 7;

    let step = 0;
    let comparisons = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Searching for ${target} in a sorted array.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, target },
    };
    step += 1;

    // The active search interval [low, high], inclusive.
    let low = 0;
    let high = arr.length - 1;

    // Keep searching while the interval is non-empty.
    while (low <= high) {
        // The middle index, computed without overflow risk.
        const mid = low + Math.floor((high - low) / 2);
        const midValue = arr[mid];
        if (midValue === undefined) {
            break;
        }
        comparisons += 1;

        // Tint the current search interval pink, the middle element yellow.
        const states = new Map<number, EntityState>();
        for (let i = low; i <= high; i += 1) {
            states.set(i, "highlight");
        }
        states.set(mid, "comparing");

        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Interval [${low}..${high}] – middle is ${midValue} at index ${mid}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target, low, high, mid },
        };
        step += 1;

        if (midValue === target) {
            // Found it – paint the winner green.
            const foundStates = new Map<number, EntityState>([[mid, "sorted"]]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, foundStates),
                edges: [],
                description: `Found ${target} at index ${mid} after ${comparisons} comparisons.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { comparisons, target, foundIndex: mid },
            };
            return;
        }

        if (midValue < target) {
            // The target is larger – discard the left half entirely.
            low = mid + 1;
        } else {
            // The target is smaller – discard the right half entirely.
            high = mid - 1;
        }
    }

    // The interval emptied without finding the target.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `${target} is not in the array after ${comparisons} comparisons.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { comparisons, target },
    };
}

/** The Binary Search (Iterative) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "binary-search-iterative",
    name: "Binary Search (Iterative)",
    category: "searching",
    complexity: { time: "O(log n)", space: "O(1)" },
    // A sorted array with the target (7) sitting right in the middle.
    defaultInput: { array: [1, 3, 5, 7, 9, 11, 13, 15], target: 7 },
    visualType: "array",
    run,
};

export default module;
