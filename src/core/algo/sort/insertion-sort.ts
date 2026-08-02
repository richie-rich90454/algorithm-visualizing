/**
 * insertion-sort.ts – Insertion Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Insertion sort builds the sorted output incrementally, one element at a
 * time. It grows a sorted prefix and, on each pass, takes the next unsorted
 * element and "inserts" it into the correct place by shifting larger elements
 * one position to the right. It is the algorithm most people use instinctively
 * when sorting playing cards in their hand.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n²) worst/average, O(n) best (already sorted – shifts become no-ops)
 *   Space: O(1) auxiliary – in place, stable
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The element being inserted is YELLOW (comparing).
 *   - The sorted prefix is GREEN (sorted).
 *   - Each element shifted right to make room flashes RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Stable: equal elements keep their relative order.
 *   - Adaptive: nearly-sorted input is processed in nearly-linear time.
 *   - Its locality makes it excellent for small arrays and as the finishing
 *     pass inside divide-and-conquer sorts like Tim Sort.
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
 * The Insertion Sort generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [5, 2, 9, 1, 6, 4];

    let step = 0;
    let comparisons = 0;
    let shifts = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – every element is untouched.",
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, shifts },
    };
    step += 1;

    const n = arr.length;

    // The first element is trivially a sorted prefix of length one, so the
    // outer loop starts from index 1: insert every remaining element.
    for (let i = 1; i < n; i += 1) {
        // Save the element we are about to insert – shifting will overwrite it.
        const key = arr[i];
        if (key === undefined) {
            continue;
        }

        // Move leftwards while we find a larger element to shift right.
        let j = i - 1;

        // Mark the key element as the one currently being inserted.
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[i, "comparing"]])),
            edges: [],
            description: `Inserting ${key} into the sorted prefix.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, shifts },
        };
        step += 1;

        // Shift loop: while the key is smaller than its left neighbour, that
        // neighbour moves one position right to make room.
        while (j >= 0) {
            const left = arr[j];
            if (left === undefined) {
                break;
            }
            comparisons += 1;

            const cmpStates = new Map<number, EntityState>([
                [j, "comparing"],
                [i, "highlight"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, cmpStates),
                edges: [],
                description: `Comparing key ${key} with ${left}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, shifts },
            };
            step += 1;

            if (left <= key) {
                // Found the correct spot; the element left of j is smaller.
                break;
            }

            // Shift left[j] right into the vacated slot and continue left.
            arr[j + 1] = left;
            shifts += 1;

            const shiftStates = new Map<number, EntityState>([
                [j + 1, "swapped"],
                [j, "highlight"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, shiftStates),
                edges: [],
                description: `Shifting ${left} right to make room for ${key}.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { comparisons, shifts },
            };
            step += 1;

            j -= 1;
        }

        // Drop the key into its final resting place.
        arr[j + 1] = key;

        // Re-highlight the sorted prefix so the growth is visible.
        const settleStates = new Map<number, EntityState>();
        for (let k = 0; k <= i; k += 1) {
            settleStates.set(k, "sorted");
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, settleStates),
            edges: [],
            description: `${key} inserted – the first ${i + 1} elements are now sorted.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, shifts },
        };
        step += 1;
    }

    // Final frame: the entire array is green and fully sorted.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: `Array sorted in ${comparisons} comparisons and ${shifts} shifts.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { comparisons, shifts },
    };
}

/** The Insertion Sort module, registered with the engine. */
const module: AlgorithmModule = {
    id: "insertion-sort",
    name: "Insertion Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    // A shuffled array with a clear out-of-order element (1 at index 3).
    defaultInput: [5, 2, 9, 1, 6, 4],
    visualType: "array",
    run,
};

export default module;
