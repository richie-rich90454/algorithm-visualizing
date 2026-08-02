/**
 * selection-sort.ts – Selection Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Selection sort divides the array into a sorted prefix and an unsorted
 * suffix. On each pass it scans the entire unsorted suffix, finds the minimum
 * element, and swaps it with the first element of that suffix, growing the
 * sorted prefix by one. Unlike bubble sort it makes at most one swap per pass,
 * which keeps the total number of writes low even though comparisons remain
 * quadratic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n²) worst, average, and best – it always scans the full suffix
 *   Space: O(1) auxiliary – in place, not stable (a far swap can invert order)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The element currently being examined in the scan is YELLOW (comparing).
 *   - The running minimum of the current pass is PINK (highlight).
 *   - The winner that gets swapped into place flashes RED (swapped).
 *   - The sorted prefix is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - In place and simple, but the number of comparisons is fixed regardless
 *     of the input's initial order, so no input is ever "lucky".
 *   - Each pass performs at most one swap, so total swaps ≤ n.
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
 * The Selection Sort generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [7, 2, 9, 1, 5, 8];

    let step = 0;
    let comparisons = 0;
    let swaps = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – every element is untouched.",
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, swaps },
    };
    step += 1;

    const n = arr.length;

    // Outer loop: each pass fixes one more element into the sorted prefix.
    for (let i = 0; i < n - 1; i += 1) {
        // Assume the first element of the unsorted suffix is the minimum.
        let minIndex = i;
        let minValue = arr[i];

        // Inner loop: scan the rest of the suffix for something smaller.
        for (let j = i + 1; j < n; j += 1) {
            const candidate = arr[j];
            if (candidate === undefined) {
                continue;
            }

            // The candidate being examined lights up yellow.
            const scanStates = new Map<number, EntityState>([
                [minIndex, "highlight"],
                [j, "comparing"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, scanStates),
                edges: [],
                description: `Scanning – is ${candidate} smaller than the current minimum ${String(minValue)}?`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons: ++comparisons, swaps },
            };
            step += 1;

            // A smaller value becomes the new running minimum.
            if (candidate < (minValue as number)) {
                minIndex = j;
                minValue = candidate;
            }
        }

        // The minimum belongs at position i; swap it there if needed.
        const winner = arr[minIndex];
        const atI = arr[i];
        if (winner === undefined || atI === undefined) {
            continue;
        }

        if (minIndex !== i) {
            // Perform the swap: the winner moves to the front of the suffix.
            arr[minIndex] = atI;
            arr[i] = winner;

            const swapStates = new Map<number, EntityState>([
                [i, "swapped"],
                [minIndex, "swapped"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, swapStates),
                edges: [],
                description: `Swapped ${winner} (at ${minIndex}) with ${atI} (at ${i}).`,
                codeLineNumber: 3,
                layout: "array",
                meta: { comparisons, swaps: ++swaps },
            };
            step += 1;
        }

        // Position i is now final and joins the sorted prefix.
        const settleStates = new Map<number, EntityState>([[i, "sorted"]]);
        for (let k = 0; k < i; k += 1) {
            settleStates.set(k, "sorted");
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, settleStates),
            edges: [],
            description: `${String(arr[i])} is now in its final sorted position.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }

    // Final frame: everything is green; the last element sorts itself.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: `Array sorted in ${comparisons} comparisons and ${swaps} swaps.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { comparisons, swaps },
    };
}

/** The Selection Sort module, registered with the engine. */
const module: AlgorithmModule = {
    id: "selection-sort",
    name: "Selection Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    // Unsorted input with a clear minimum (1) that must travel from the right.
    defaultInput: [7, 2, 9, 1, 5, 8],
    visualType: "array",
    run,
};

export default module;
