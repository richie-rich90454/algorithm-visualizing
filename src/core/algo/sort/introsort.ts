/**
 * introsort.ts – Introsort (introspective sort)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Introsort is quick sort with a safety net. Plain quick sort degrades to
 * O(n²) on adversarial input (e.g. already-sorted data with a bad pivot
 * rule). Introsort tracks the recursion depth and, once the depth exceeds a
 * threshold (proportional to log n), switches the current sub-problem to heap
 * sort, which is guaranteed O(m log m). This combines quick sort's excellent
 * average speed with heap sort's worst-case guarantee. Small sub-arrays are
 * finished off with insertion sort, following the practice of real libraries
 * like the GNU C++ STL.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) worst, average, and best – the guaranteed bound comes
 *          from the heap-sort fallback
 *   Space: O(log n) stack depth
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The pivot is PURPLE (pivot).
 *   - Elements being partitioned are YELLOW (comparing).
 *   - A switch to heap sort is announced prominently.
 *   - The sorted result turns GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Not stable.
 *   - The default sort used by many standard libraries precisely because it
 *     bounds the worst case while keeping quick sort's average speed.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Sub-arrays smaller than this are sorted with insertion sort. */
const THRESHOLD = 8;

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
 * The Introsort generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [9, 2, 6, 1, 8, 3, 7, 4];

    let step = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – introsort will quick sort with a heap-sort safety net.",
        codeLineNumber: 0,
        layout: "array",
        meta: {},
    };
    step += 1;

    const n = arr.length;

    /**
     * Heap sort over the range [lo..hi) – the guaranteed-O(m log m) fallback.
     */
    function* heapSortRange(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        // Show that we are switching strategies.
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: "Recursion too deep – switching this sub-array to heap sort.",
            codeLineNumber: 3,
            layout: "array",
            meta: { fallback: "heap-sort" },
        };
        step += 1;

        const size = hi - lo;

        // Build a max-heap over the range.
        for (let i = Math.floor(size / 2) - 1; i >= 0; i -= 1) {
            yield* siftDown(lo, i, size);
        }

        // Extract the max repeatedly.
        for (let end = size - 1; end > 0; end -= 1) {
            const rootVal = arr[lo];
            const endVal = arr[lo + end];
            if (rootVal !== undefined && endVal !== undefined) {
                arr[lo] = endVal;
                arr[lo + end] = rootVal;
            }
            yield* siftDown(lo, 0, end);
        }
    }

    /** Sift down within the heap range starting at `lo`, at node `root`. */
    function* siftDown(
        lo: number,
        root: number,
        size: number,
    ): Generator<VisualFrame, void, unknown> {
        for (;;) {
            const left = 2 * root + 1;
            const right = 2 * root + 2;
            let largest = root;

            if (left < size) {
                const a = arr[lo + largest];
                const b = arr[lo + left];
                if (a !== undefined && b !== undefined && b > a) {
                    largest = left;
                }
            }
            if (right < size) {
                const a = arr[lo + largest];
                const b = arr[lo + right];
                if (a !== undefined && b !== undefined && b > a) {
                    largest = right;
                }
            }

            if (largest === root) {
                break;
            }

            const rootVal = arr[lo + root];
            const childVal = arr[lo + largest];
            if (rootVal !== undefined && childVal !== undefined) {
                arr[lo + root] = childVal;
                arr[lo + largest] = rootVal;
            }
            root = largest;
        }
    }

    /**
     * Lomuto partition of [lo..hi) around the last element.
     */
    function* partition(lo: number, hi: number): Generator<VisualFrame, number, unknown> {
        const pivot = arr[hi - 1];
        if (pivot === undefined) {
            return lo;
        }
        let i = lo;

        for (let j = lo; j < hi - 1; j += 1) {
            const current = arr[j];
            if (current === undefined) {
                continue;
            }
            if (current < pivot) {
                const atI = arr[i];
                if (atI !== undefined) {
                    arr[j] = atI;
                    arr[i] = current;
                }
                i += 1;
            }
        }

        const atI = arr[i];
        if (atI !== undefined) {
            arr[hi - 1] = atI;
            arr[i] = pivot;
        }

        const pivotStates = new Map<number, EntityState>([[i, "sorted"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, pivotStates),
            edges: [],
            description: `Partitioned around pivot ${String(arr[i])} – it is now in place.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { pivotIndex: i },
        };
        step += 1;

        return i;
    }

    /**
     * Insertion sort over [lo..hi) – the small-array finisher.
     */
    function* insertionSort(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        for (let i = lo + 1; i < hi; i += 1) {
            const key = arr[i];
            if (key === undefined) {
                continue;
            }
            let j = i - 1;
            while (j >= lo) {
                const left = arr[j];
                if (left === undefined || left <= key) {
                    break;
                }
                arr[j + 1] = left;
                j -= 1;
            }
            arr[j + 1] = key;
        }
    }

    /**
     * The introspective driver: quick sort, but guard the recursion depth.
     */
    function* introsort(
        lo: number,
        hi: number,
        depthLimit: number,
    ): Generator<VisualFrame, void, unknown> {
        const size = hi - lo;

        // Small sub-arrays sort fastest with insertion sort.
        if (size < THRESHOLD) {
            yield* insertionSort(lo, hi);
            return;
        }

        // Depth exceeded → heap sort guarantees O(m log m).
        if (depthLimit === 0) {
            yield* heapSortRange(lo, hi);
            return;
        }

        // Otherwise continue with quick sort partitioning.
        const pivotIndex = yield* partition(lo, hi);
        yield* introsort(lo, pivotIndex, depthLimit - 1);
        yield* introsort(pivotIndex + 1, hi, depthLimit - 1);
    }

    // 2·log₂(n) is the classic depth bound for introsort.
    const depthLimit = 2 * Math.floor(Math.log2(Math.max(1, n)));

    yield* introsort(0, n, depthLimit);

    // Final frame: the entire array is green and fully sorted.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description:
            "Array sorted – quick sort with heap-sort fallback and insertion-sort finisher.",
        codeLineNumber: 4,
        layout: "array",
        meta: { sorted: true, values: [...arr] },
    };
}

/** The Introsort module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Introsort is quicksort with a depth guard. It partitions like quicksort but counts recursion depth; if a branch gets too deep it switches that branch to heapsort, which is guaranteed O(m log m). Small partitions finish with insertion sort, matching real library implementations.",
        "invariants": [
            "Every element stays in the current partition until that partition is finalized.",
            "If the depth limit is hit, the remaining subarray is finished by a worst-case-safe method."
        ],
        "correctness": "Quicksort partitioning keeps left elements smaller than the pivot and right elements larger; induction sorts each side. The heapsort fallback also sorts correctly, so whichever path a subarray takes produces a sorted result.",
        "complexityRationale": "The depth cap is about 2*log n, so quicksort cannot spend more than O(n log n) on partitioning; heapsort fallback is O(n log n) and insertion sort is linear on tiny ranges. Extra space is O(log n) stack.",
        "uses": [
            "The default sort in many language standard libraries",
            "Sorting untrusted data where worst-case behavior matters",
            "Teaching adaptive hybrid algorithm design"
        ],
        "references": [
            "Musser, Introspective Sorting and Selection Algorithms, Software Practice and Experience, 1997",
            "Sedgewick and Wayne, Algorithms, Section 2.5"
        ],
        "workedExample": "For [9, 2, 6, 1, 8, 3, 7, 4], partitions quickly split around pivots. If a later partition degenerates past the depth limit, that slice switches to heapsort; slices of a few elements are finished with insertion sort, yielding [1, 2, 3, 4, 6, 7, 8, 9]."
    },
    id: "introsort",
    name: "Introsort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(log n)" },
    // A shuffled array small enough that insertion-sort finishing is visible.
    defaultInput: [9, 2, 6, 1, 8, 3, 7, 4],
    visualType: "array",
    run,
    pseudocode: [
        "start with depth limit ← 2 * floor(log2(n))",
        "if range is small: finish with insertion sort",
        "partition range around pivot, pivot lands in place",
        "if depth limit hit zero: heap sort this range",
        "done: array is fully sorted",
    ],
};

export default module;
