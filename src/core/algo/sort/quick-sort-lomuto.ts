/**
 * quicksort-lomuto.ts – Quick Sort (Lomuto partitioning)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quick sort is the other great divide-and-conquer sorting algorithm. It picks
 * a pivot, partitions the array so everything smaller than the pivot sits to
 * its left and everything larger to its right, and then recurses on the two
 * sides. The Lomuto scheme walks a single pointer through the array, swapping
 * small elements into a "smaller region" as it goes. It is simpler to
 * implement and to visualise than the Hoare scheme, at the cost of doing more
 * swaps.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) average, O(n²) worst (e.g. already-sorted input when the
 *          pivot is chosen poorly – here the last element)
 *   Space: O(log n) stack depth on average, O(n) worst
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The pivot is PURPLE (pivot).
 *   - The element currently scanned by the partition pointer is YELLOW (comparing).
 *   - Elements moved into the smaller region flash RED (swapped).
 *   - Elements in their final sorted position are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Not stable.
 *   - In place (partitioning happens inside the array).
 *   - Often the fastest comparison sort in practice despite the quadratic
 *     worst case, which is why real libraries use "introsort" – quick sort
 *     that falls back to heap sort when recursion gets too deep.
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
 * The Quick Sort (Lomuto) generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [8, 3, 6, 1, 7, 2, 5, 4];

    let step = 0;
    let comparisons = 0;
    let swaps = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – quick sort will pick a pivot and partition.",
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, swaps },
    };
    step += 1;

    /**
     * Partition the range [lo..hi] around arr[hi] (the Lomuto pivot).
     *
     * Returns the pivot's final index. The invariant: after the walk, every
     * element in [lo..i] is smaller than the pivot and [i+1..hi] is larger.
     */
    function* partition(lo: number, hi: number): Generator<VisualFrame, number, unknown> {
        const pivot = arr[hi];
        if (pivot === undefined) {
            return hi;
        }

        // i tracks the boundary between the "smaller" and "unseen" regions.
        let i = lo;

        // Highlight the pivot in purple for the whole partition.
        for (let j = lo; j < hi; j += 1) {
            const current = arr[j];
            if (current === undefined) {
                continue;
            }
            comparisons += 1;

            // Mark the scanned element and the pivot.
            const cmpStates = new Map<number, EntityState>([
                [j, "comparing"],
                [hi, "pivot"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, cmpStates),
                edges: [],
                description: `Comparing ${current} with pivot ${String(pivot)}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;

            // Small elements join the smaller region via a swap with index i.
            if (current < pivot) {
                const atI = arr[i];
                if (atI === undefined) {
                    continue;
                }
                arr[j] = atI;
                arr[i] = current;
                swaps += 1;

                const swapStates = new Map<number, EntityState>([
                    [j, "swapped"],
                    [i, "swapped"],
                    [hi, "pivot"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, swapStates),
                    edges: [],
                    description: `${current} is smaller than the pivot – swapping into place.`,
                    codeLineNumber: 3,
                    layout: "array",
                    meta: { comparisons, swaps },
                };
                step += 1;
                i += 1;
            }
        }

        // Drop the pivot between the two regions at its final position.
        const atI = arr[i];
        const pivotVal = arr[hi];
        if (atI !== undefined && pivotVal !== undefined) {
            arr[hi] = atI;
            arr[i] = pivotVal;
            swaps += 1;
        }

        const pivotStates = new Map<number, EntityState>([[i, "sorted"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, pivotStates),
            edges: [],
            description: `Pivot ${String(arr[i])} is now in its final position at index ${i}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;

        return i;
    }

    /**
     * Recursive driver: partition [lo..hi], then quick sort both sides.
     */
    function* quickSort(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        // Base case: ranges of size 0 or 1 are trivially sorted.
        if (lo >= hi) {
            return;
        }

        const pivotIndex = yield* partition(lo, hi);
        yield* quickSort(lo, pivotIndex - 1);
        yield* quickSort(pivotIndex + 1, hi);
    }

    // Kick off the whole sort over the full array.
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

/** The Quick Sort (Lomuto) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "quick-sort-lomuto",
    name: "Quick Sort (Lomuto)",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(log n)" },
    // A shuffled array ending in 4 – the pivot that starts the partition.
    defaultInput: [8, 3, 6, 1, 7, 2, 5, 4],
    visualType: "array",
    run,
};

export default module;
