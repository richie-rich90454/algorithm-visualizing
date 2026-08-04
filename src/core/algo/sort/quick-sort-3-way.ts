/**
 * quicksort-3way.ts – Quick Sort (3-Way partitioning / Dijkstra's Dutch flag)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Standard quick sort partitions into "smaller than pivot" and "larger than
 * pivot". When the input contains many equal elements, that middle region is
 * still partitioned recursively, wasting work. The 3-way variant partitions
 * into three regions: smaller, equal to the pivot, and larger. All equal
 * elements land in the middle region together and are skipped by the
 * recursion, turning a pathological all-equal input from O(n²) into O(n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) average, O(n) for inputs with few distinct values,
 *          O(n²) worst
 *   Space: O(log n) stack depth on average
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The pivot is PURPLE (pivot).
 *   - Elements being scanned are YELLOW (comparing).
 *   - The three-way partition grows: smaller elements to the left, equal in
 *     the middle, larger to the right.
 *   - Final positions are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Not stable.
 *   - Handles arrays with many duplicates far better than 2-way quick sort.
 *   - Equal elements end up adjacent and are never re-compared.
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
 * The 3-Way Quick Sort generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [5, 3, 5, 1, 5, 2, 5, 4];

    let step = 0;
    let comparisons = 0;
    let swaps = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – note the many equal elements (5s).",
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, swaps },
    };
    step += 1;

    /**
     * 3-way partition of [lo..hi] around the pivot value arr[hi].
     *
     * After the walk:
     *   - [lo..lt-1]   contains elements smaller than the pivot
     *   - [lt..gt]     contains elements equal to the pivot
     *   - [gt+1..hi]   contains elements larger than the pivot
     *
     * Returns the [lt, gt] bounds of the equal region.
     */
    function* partition(lo: number, hi: number): Generator<VisualFrame, [number, number], unknown> {
        const pivot = arr[hi];
        if (pivot === undefined) {
            return [lo, hi];
        }

        let lt = lo; // right edge of the "smaller" region
        let i = lo; // scanning pointer
        let gt = hi; // left edge of the "larger" region

        // Walk i through the unprocessed region [i..gt].
        while (i <= gt) {
            const current = arr[i];
            if (current === undefined) {
                break;
            }
            comparisons += 1;

            const cmpStates = new Map<number, EntityState>([
                [i, "comparing"],
                [hi, "pivot"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, cmpStates),
                edges: [],
                description: `Partitioning – is ${current} smaller, equal, or larger than pivot ${String(pivot)}?`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;

            if (current < pivot) {
                // Swap current into the smaller region, grow it, advance i.
                const atLt = arr[lt];
                if (atLt !== undefined) {
                    arr[i] = atLt;
                    arr[lt] = current;
                    swaps += 1;
                }
                lt += 1;
                i += 1;
            } else if (current > pivot) {
                // Swap current into the larger region, shrink it; i stays so
                // the element just swapped in gets examined next.
                const atGt = arr[gt];
                if (atGt !== undefined) {
                    arr[i] = atGt;
                    arr[gt] = current;
                    swaps += 1;
                }
                gt -= 1;
            } else {
                // Equal to the pivot: leave it in place, just advance.
                i += 1;
            }

            // Show the current three-region structure after each action.
            const regionStates = new Map<number, EntityState>([
                [i, "comparing"],
                [hi, "pivot"],
            ]);
            for (let k = lo; k < lt; k += 1) {
                regionStates.set(k, "sorted");
            }
            for (let k = gt + 1; k <= hi; k += 1) {
                regionStates.set(k, "sorted");
            }
            yield {
                stepNumber: step,
                entities: makeBars(arr, regionStates),
                edges: [],
                description: `Regions: smaller [${lo}..${lt - 1}], equal [${lt}..${gt}], larger [${gt + 1}..${hi}].`,
                codeLineNumber: 3,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }

        return [lt, gt];
    }

    /**
     * Recursive driver: partition, then recurse only on the non-equal sides.
     */
    function* quickSort(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        if (lo >= hi) {
            return;
        }

        const [lt, gt] = yield* partition(lo, hi);
        yield* quickSort(lo, lt - 1);
        yield* quickSort(gt + 1, hi);
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

/** The 3-Way Quick Sort module, registered with the engine. */
const module: AlgorithmModule = {
    id: "quick-sort-3-way",
    name: "Quick Sort (3-Way)",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(log n)" },
    // Deliberately duplicate-heavy input shows off the 3-way advantage.
    defaultInput: [5, 3, 5, 1, 5, 2, 5, 4],
    visualType: "array",
    run,
};

export default module;
