/**
 * quicksort-hoare.ts – Quick Sort (Hoare partitioning)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quick sort with the Hoare partitioning scheme. Instead of scanning one
 * pointer through the whole range like Lomuto, Hoare's scheme uses two
 * pointers that move toward each other from opposite ends of the range,
 * swapping any pair that is on the wrong side of the pivot. The result is
 * roughly three times fewer swaps than Lomuto on average, which makes it the
 * scheme used by most production quick sort implementations.
 *
 * The pivot is the *middle* element, which protects against the classic
 * worst-case quadratic behaviour on already-sorted input.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) average, O(n²) worst
 *   Space: O(log n) stack depth on average
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The pivot (middle element) is PURPLE (pivot).
 *   - The left and right pointers are YELLOW (comparing).
 *   - A swapped out-of-place pair flashes RED (swapped).
 *   - Final positions are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Not stable.
 *   - In place.
 *   - Hoare's partition returns the boundary index, not the pivot's final
 *     index – the pivot may end up anywhere in the left region.
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
 * The Quick Sort (Hoare) generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [9, 2, 6, 1, 8, 3, 7, 4];

    let step = 0;
    let comparisons = 0;
    let swaps = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – quick sort (Hoare) will partition from both ends.",
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, swaps },
    };
    step += 1;

    /**
     * Hoare partition: rearrange [lo..hi] and return a boundary index `j`
     * such that everything in [lo..j] is ≤ pivot and everything in [j+1..hi]
     * is ≥ pivot. The pivot is the middle element.
     */
    function* partition(lo: number, hi: number): Generator<VisualFrame, number, unknown> {
        const mid = Math.floor((lo + hi) / 2);
        const pivot = arr[mid];
        if (pivot === undefined) {
            return lo;
        }

        let i = lo - 1;
        let j = hi + 1;

        // Loop until the two pointers cross each other.
        for (;;) {
            // Advance i rightward while arr[i] is smaller than the pivot.
            do {
                i += 1;
                const value = arr[i];
                if (value === undefined) {
                    break;
                }
                comparisons += 1;
            } while (arr[i] !== undefined && (arr[i] as number) < pivot);

            // Retreat j leftward while arr[j] is larger than the pivot.
            do {
                j -= 1;
                const value = arr[j];
                if (value === undefined) {
                    break;
                }
                comparisons += 1;
            } while (arr[j] !== undefined && (arr[j] as number) > pivot);

            // Pointers crossed: every element is on its correct side.
            if (i >= j) {
                break;
            }

            // Swap the two out-of-place elements.
            const atI = arr[i];
            const atJ = arr[j];
            if (atI !== undefined && atJ !== undefined) {
                arr[i] = atJ;
                arr[j] = atI;
                swaps += 1;
            }

            const swapStates = new Map<number, EntityState>([
                [i, "swapped"],
                [j, "swapped"],
                [mid, "pivot"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, swapStates),
                edges: [],
                description: `Swapped ${String(arr[i])} and ${String(arr[j])} – both were on the wrong side of pivot ${String(pivot)}.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }

        return j;
    }

    /**
     * Recursive driver: partition [lo..hi], then quick sort both sides.
     */
    function* quickSort(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        if (lo >= hi) {
            return;
        }

        const boundary = yield* partition(lo, hi);
        yield* quickSort(lo, boundary);
        yield* quickSort(boundary + 1, hi);
    }

    yield* quickSort(0, arr.length - 1);

    // Final frame: the entire array is green and fully sorted.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: `Array sorted with ${comparisons} comparisons and ${swaps} swaps.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { comparisons, swaps },
    };
}

/** The Quick Sort (Hoare) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "quick-sort-hoare",
    name: "Quick Sort (Hoare)",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(log n)" },
    // A shuffled array whose middle element (8) becomes the first pivot.
    defaultInput: [9, 2, 6, 1, 8, 3, 7, 4],
    visualType: "array",
    run,
};

export default module;
