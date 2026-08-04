/**
 * bubble-sort.ts – Bubble Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bubble sort repeatedly walks the array, comparing each adjacent pair and
 * swapping them when the left element is larger than the right. After each
 * full pass, the largest remaining element has "bubbled up" to its final
 * position at the end of the unsorted region, so the pass length shrinks by
 * one each time. When a pass completes with no swaps, the array is sorted and
 * the algorithm stops early.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n²) worst/average, O(n) best (already sorted, with the early-exit)
 *   Space: O(1) auxiliary – in place, stable
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars represent the array values.
 *   - The pair currently being compared is painted YELLOW (comparing).
 *   - A pair that just swapped flashes RED (swapped).
 *   - The suffix that has settled into place is painted GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Stable: equal elements keep their original relative order.
 *   - In place: only swaps neighboring elements, no extra array storage.
 *   - Best used for teaching; quadratic cost makes it impractical on large
 *     inputs, which is exactly why it is the perfect first algorithm to study.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build the array of bar entities for a frame.
 *
 * Each bar carries its value as both `label` (what the renderer prints) and
 * `value` (what the layout uses to scale its height). The optional `states`
 * map lets the caller override individual bars' colors per frame, defaulting
 * to `idle` for every bar.
 *
 * @param arr The current array values, in display order.
 * @param states Optional index → state overrides for this frame.
 * @returns An array of `VisualEntity` bars with fresh placeholder positions.
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
 * The Bubble Sort generator.
 *
 * The generator is the contract with the step engine: each `yield` produces
 * one `VisualFrame`, and the engine drains the generator eagerly so every
 * frame exists before the first step is even played.
 *
 * The algorithm deliberately mutates a *deep copy* of the input array so the
 * module's `defaultInput` is never corrupted by repeated runs.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [4, 2, 7, 1, 9, 3];

    let step = 0;
    let comparisons = 0;
    let swaps = 0;

    // Frame 0: the untouched initial state, every bar idle.
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

    // Outer loop: each pass bubbles the current largest value to the end of
    // the unsorted region. After i passes, the last i elements are final.
    for (let i = 0; i < n - 1; i += 1) {
        // Tracks whether this pass performed any swap. If it did not, the
        // array is fully sorted and we can stop early.
        let swappedAny = false;

        // Inner loop: walk the unsorted region comparing adjacent pairs.
        for (let j = 0; j < n - 1 - i; j += 1) {
            const left = arr[j];
            const right = arr[j + 1];
            if (left === undefined || right === undefined) {
                continue;
            }

            // Mark the pair under inspection as "comparing".
            const states = new Map<number, EntityState>([
                [j, "comparing"],
                [j + 1, "comparing"],
            ]);

            // Yield the comparison frame – the pair flashes yellow.
            yield {
                stepNumber: step,
                entities: makeBars(arr, states),
                edges: [],
                description: `Comparing ${left} and ${right}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons: ++comparisons, swaps },
            };
            step += 1;

            // Out-of-order neighbors get swapped; left is strictly greater.
            if (left > right) {
                // Swapping mutates the working copy of the array.
                arr[j] = right;
                arr[j + 1] = left;
                swappedAny = true;

                // After the swap, mark the moved elements as "swapped".
                const swapStates = new Map<number, EntityState>([
                    [j, "swapped"],
                    [j + 1, "swapped"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, swapStates),
                    edges: [],
                    description: `${left} and ${right} were out of order – swapping.`,
                    codeLineNumber: 3,
                    layout: "array",
                    meta: { comparisons, swaps: ++swaps },
                };
                step += 1;
            }
        }

        // The element that bubbled to position n-1-i is now in its final spot.
        const passStates = new Map<number, EntityState>([[n - 1 - i, "sorted"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, passStates),
            edges: [],
            description: `Pass ${i + 1} complete – ${String(arr[n - 1 - i])} is now in place.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;

        // Early exit: a pass with zero swaps means the whole array is sorted.
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
        codeLineNumber: 5,
        layout: "array",
        meta: { comparisons, swaps },
    };
}

/** The Bubble Sort module, registered with the engine. */
const module: AlgorithmModule = {
    id: "bubble-sort",
    name: "Bubble Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    // A deliberately small, unsorted array so every pass is visibly busy.
    defaultInput: [4, 2, 7, 1, 9, 3],
    visualType: "array",
    run,
};

export default module;
