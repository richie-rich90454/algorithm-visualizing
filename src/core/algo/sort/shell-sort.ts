/**
 * shell-sort.ts – Shell Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Shell sort is an in-place, generalized insertion sort. Instead of comparing
 * only adjacent elements, it compares elements that are a fixed *gap* apart,
 * sorting the array into gap-sized interleaved subsequences. The gap shrinks
 * over a sequence of passes down to 1, at which point the final pass is a
 * plain insertion sort. Because the earlier wide-gap passes have already moved
 * elements most of the way home, the final insertion sort does very little
 * shifting – that is where the speedup over plain insertion sort comes from.
 *
 * This implementation uses the classic gap sequence n/2, n/4, …, 1.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n²) worst for the n/2-gap sequence; other gap sequences achieve
 *          O(n log² n) or better
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The gap currently in use is announced each pass.
 *   - Elements being compared across the gap are YELLOW (comparing).
 *   - Shifted elements flash RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Not stable.
 *   - In place and adaptive: nearly-sorted input sorts fast.
 *   - The first sorting algorithm to break the O(n²) barrier for medium
 *     datasets (historically).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build the array of bar entities for a frame.
 *
 * @param arr The current array values, in display order.
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
 * The Shell Sort generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [23, 3, 41, 7, 11, 13, 17, 29];

    let step = 0;
    let comparisons = 0;
    let shifts = 0;

    const n = arr.length;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – shell sort will insert across ever-shrinking gaps.",
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, shifts },
    };
    step += 1;

    // Gap sequence: start at n/2 and halve until we reach 1.
    for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `Starting a pass with gap ${gap}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, shifts, gap },
        };
        step += 1;

        // For each gap-sorted subsequence, run an insertion-sort-like pass.
        for (let i = gap; i < n; i += 1) {
            const key = arr[i];
            if (key === undefined) {
                continue;
            }

            // Shift elements that are both key-gap apart and larger than key.
            let j = i;
            while (j - gap >= 0) {
                const left = arr[j - gap];
                if (left === undefined) {
                    break;
                }
                comparisons += 1;

                const cmpStates = new Map<number, EntityState>([
                    [j - gap, "comparing"],
                    [i, "highlight"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, cmpStates),
                    edges: [],
                    description: `Gap ${gap}: comparing ${key} with ${left}.`,
                    codeLineNumber: 3,
                    layout: "array",
                    meta: { comparisons, shifts, gap },
                };
                step += 1;

                if (left <= key) {
                    break;
                }

                // Shift the larger element gap positions to the right.
                arr[j] = left;
                shifts += 1;

                const shiftStates = new Map<number, EntityState>([
                    [j, "swapped"],
                    [j - gap, "highlight"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, shiftStates),
                    edges: [],
                    description: `Gap ${gap}: shifting ${left} right by ${gap}.`,
                    codeLineNumber: 4,
                    layout: "array",
                    meta: { comparisons, shifts, gap },
                };
                step += 1;

                j -= gap;
            }

            // Insert the key into its home position for this subsequence.
            arr[j] = key;
        }
    }

    // Final frame: the entire array is green and fully sorted.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: `Array sorted with ${comparisons} comparisons and ${shifts} shifts.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { comparisons, shifts },
    };
}

/** The Shell Sort module, registered with the engine. */
const module: AlgorithmModule = {
    id: "shell-sort",
    name: "Shell Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    // Scattered primes make the wide-gap passes easy to follow.
    defaultInput: [23, 3, 41, 7, 11, 13, 17, 29],
    visualType: "array",
    run,
};

export default module;
