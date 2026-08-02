/**
 * merge-sort-bottom-up.ts – Merge Sort (Bottom-Up, iterative)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bottom-up merge sort produces exactly the same result as the recursive
 * version, but skips the split phase entirely. Instead of recursing down to
 * single elements, it starts with runs of length 1 and repeatedly doubles the
 * run length, merging adjacent pairs of runs at each "width". Because the
 * width starts at 1 and doubles each round, every element is part of exactly
 * one merge per round, giving the same O(n log n) behaviour without recursion.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) worst, average, and best
 *   Space: O(n) auxiliary – the merge step needs a temporary buffer
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The two runs being merged are highlighted (comparing).
 *   - After a merge completes, that whole slice is painted GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - No recursion means no risk of stack overflow on huge inputs.
 *   - The doubling-width loop structure is a great illustration of the
 *     logarithmic factor hiding inside O(n log n).
 *   - Stable, just like the top-down variant.
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
 * The Bottom-Up Merge Sort generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [6, 3, 8, 1, 7, 2, 5, 4];

    let step = 0;
    let merges = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – each element is a sorted run of length 1.",
        codeLineNumber: 0,
        layout: "array",
        meta: { merges },
    };
    step += 1;

    const n = arr.length;
    const temp: number[] = new Array(n);

    /**
     * Merge two adjacent sorted runs into one. Runs are [lo..mid] and
     * [mid+1..hi]. Reads come from `temp`, writes go back into `arr`.
     */
    function* merge(lo: number, mid: number, hi: number): Generator<VisualFrame, void, unknown> {
        // Snapshot the slice so in-place writes never lose unread values.
        for (let k = lo; k <= hi; k += 1) {
            temp[k] = arr[k];
        }

        let i = lo;
        let j = mid + 1;

        for (let k = lo; k <= hi; k += 1) {
            const leftVal = temp[i];
            const rightVal = temp[j];
            const takeRight = i > mid || (j <= hi && (rightVal as number) < (leftVal as number));

            // Show the two fronts being compared.
            const cmpStates = new Map<number, EntityState>([
                [i, "comparing"],
                [j, "comparing"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, cmpStates),
                edges: [],
                description: `Merging runs [${lo}..${mid}] and [${mid + 1}..${hi}].`,
                codeLineNumber: 2,
                layout: "array",
                meta: { merges },
            };
            step += 1;

            if (takeRight) {
                arr[k] = rightVal as number;
                j += 1;
            } else {
                arr[k] = leftVal as number;
                i += 1;
            }
        }

        merges += 1;
        const mergedStates = new Map<number, EntityState>();
        for (let k = lo; k <= hi; k += 1) {
            mergedStates.set(k, "sorted");
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, mergedStates),
            edges: [],
            description: `Run [${lo}..${hi}] merged and sorted.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { merges },
        };
        step += 1;
    }

    // Outer loop: the run width doubles each round (1, 2, 4, 8, …).
    for (let width = 1; width < n; width *= 2) {
        // Inner loop: walk the array in width-sized steps, merging each pair.
        for (let lo = 0; lo < n; lo += width * 2) {
            const mid = Math.min(lo + width - 1, n - 1);
            const hi = Math.min(lo + width * 2 - 1, n - 1);

            // Only merge when there is actually a right run to merge with.
            if (mid < hi) {
                yield* merge(lo, mid, hi);
            }
        }
    }

    // Final frame: the entire array is green and fully sorted.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: `Array sorted with ${merges} merge operations, iteratively.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { merges },
    };
}

/** The Merge Sort (Bottom-Up) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "merge-sort-bottom-up",
    name: "Merge Sort (Bottom-Up)",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    // Same power-of-two input as the top-down version for easy comparison.
    defaultInput: [6, 3, 8, 1, 7, 2, 5, 4],
    visualType: "array",
    run,
};

export default module;
