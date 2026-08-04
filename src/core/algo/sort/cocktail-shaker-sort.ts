/**
 * cocktail-shaker-sort.ts – Cocktail Shaker Sort (bidirectional bubble sort)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cocktail shaker sort is bubble sort that alternates direction. A forward
 * pass bubbles the largest remaining element to the right; a backward pass
 * bubbles the smallest remaining element to the left. Because each pair of
 * passes fixes one element at each end, the sorted region grows from both
 * sides of the array, which shaves roughly half the passes off plain bubble
 * sort on many inputs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n²) worst/average, O(n) best (already sorted)
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The pair being compared is YELLOW (comparing).
 *   - A swapped pair flashes RED (swapped).
 *   - The settled ends are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Stable.
 *   - In place.
 *   - The shaker pattern is a gentle introduction to the "two pointers moving
 *     inward" idea reused by far more advanced algorithms.
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
 * The Cocktail Shaker Sort generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [5, 1, 8, 3, 7, 2, 6, 4];

    let step = 0;
    let comparisons = 0;
    let swaps = 0;

    const n = arr.length;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – the shaker will sweep left and right alternately.",
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, swaps },
    };
    step += 1;

    // The unsorted region shrinks from both ends.
    let left = 0;
    let right = n - 1;

    // Keep shak;ing while the unsorted region is non-empty.
    while (left < right) {
        let swappedAny = false;

        // --- Forward sweep: bubble the max rightward, right → left. ---
        for (let i = left; i < right; i += 1) {
            const a = arr[i];
            const b = arr[i + 1];
            if (a === undefined || b === undefined) {
                continue;
            }
            comparisons += 1;

            const cmpStates = new Map<number, EntityState>([
                [i, "comparing"],
                [i + 1, "comparing"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, cmpStates),
                edges: [],
                description: `Forward: comparing ${a} and ${b}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;

            if (a > b) {
                arr[i] = b;
                arr[i + 1] = a;
                swaps += 1;
                swappedAny = true;

                const swapStates = new Map<number, EntityState>([
                    [i, "swapped"],
                    [i + 1, "swapped"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, swapStates),
                    edges: [],
                    description: `Forward: swapped ${a} and ${b}.`,
                    codeLineNumber: 3,
                    layout: "array",
                    meta: { comparisons, swaps },
                };
                step += 1;
            }
        }
        // The largest element is now fixed at `right`.
        const rightStates = new Map<number, EntityState>([[right, "sorted"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, rightStates),
            edges: [],
            description: `${String(arr[right])} settled at the right end.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
        right -= 1;

        // --- Backward sweep: bubble the min leftward, right → left. ---
        for (let i = right; i >= left; i -= 1) {
            const a = arr[i];
            const b = arr[i + 1];
            if (a === undefined || b === undefined) {
                continue;
            }
            comparisons += 1;

            const cmpStates = new Map<number, EntityState>([
                [i, "comparing"],
                [i + 1, "comparing"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, cmpStates),
                edges: [],
                description: `Backward: comparing ${a} and ${b}.`,
                codeLineNumber: 5,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;

            if (a > b) {
                arr[i] = b;
                arr[i + 1] = a;
                swaps += 1;
                swappedAny = true;

                const swapStates = new Map<number, EntityState>([
                    [i, "swapped"],
                    [i + 1, "swapped"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, swapStates),
                    edges: [],
                    description: `Backward: swapped ${b} and ${a}.`,
                    codeLineNumber: 6,
                    layout: "array",
                    meta: { comparisons, swaps },
                };
                step += 1;
            }
        }
        // The smallest element is now fixed at `left`.
        const leftStates = new Map<number, EntityState>([[left, "sorted"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, leftStates),
            edges: [],
            description: `${String(arr[left])} settled at the left end.`,
            codeLineNumber: 7,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
        left += 1;

        // Early exit: a full round with no swaps means the array is sorted.
        if (!swappedAny) {
            break;
        }
    }

    // Final frame: the entire array is green and fully sorted.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: `Array sorted in ${comparisons} comparisons and ${swaps} swaps.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { comparisons, swaps },
    };
}

/** The Cocktail Shaker Sort module, registered with the engine. */
const module: AlgorithmModule = {
    id: "cocktail-shaker-sort",
    name: "Cocktail Shaker Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    // Unsorted input with a clear small element (1) that drifts leftward.
    defaultInput: [5, 1, 8, 3, 7, 2, 6, 4],
    visualType: "array",
    run,
};

export default module;
