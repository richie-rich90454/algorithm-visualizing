/**
 * heap-sort.ts – Heap Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Heap sort turns the array into a binary max-heap (a complete tree stored in
 * the array where every parent is larger than its children), then repeatedly
 * swaps the largest element (the root, at index 0) with the last unsorted
 * position and sifts the new root back down. Each extraction deposits one
 * maximum at the end, so the sorted suffix grows from the right.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) worst, average, and best – heapify is O(n), and each of
 *          the n extractions costs O(log n)
 *   Space: O(1) auxiliary – the heap lives inside the array itself
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The element being sifted down is YELLOW (comparing).
 *   - The parent/child pair being compared is PINK (highlight).
 *   - The element just placed in its final spot is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Not stable.
 *   - In place with guaranteed O(n log n) – the only such comparison sort in
 *     this form (merge sort needs O(n) space).
 *   - Array indices: children of i are 2i+1 and 2i+2; parent of i is ⌊(i-1)/2⌋.
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
 * The Heap Sort generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [6, 4, 8, 1, 9, 3, 7, 2];

    let step = 0;
    let comparisons = 0;
    let swaps = 0;

    const n = arr.length;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – heap sort will first build a max-heap.",
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, swaps },
    };
    step += 1;

    /**
     * Sift the element at `root` down within the heap [0..size-1] until the
     * heap property (parent ≥ children) is restored.
     */
    function* siftDown(root: number, size: number): Generator<VisualFrame, void, unknown> {
        for (;;) {
            const left = 2 * root + 1;
            const right = 2 * root + 2;
            let largest = root;

            // Compare with the left child, if it exists inside the heap.
            if (left < size) {
                const rootVal = arr[largest];
                const leftVal = arr[left];
                if (rootVal !== undefined && leftVal !== undefined && leftVal > rootVal) {
                    largest = left;
                }
                comparisons += 1;
            }

            // Compare with the right child, if it exists inside the heap.
            if (right < size) {
                const largestVal = arr[largest];
                const rightVal = arr[right];
                if (largestVal !== undefined && rightVal !== undefined && rightVal > largestVal) {
                    largest = right;
                }
                comparisons += 1;
            }

            // If the root already dominates both children, we are done.
            if (largest === root) {
                break;
            }

            // Otherwise swap root with its larger child and continue down.
            const rootVal = arr[root];
            const childVal = arr[largest];
            if (rootVal !== undefined && childVal !== undefined) {
                arr[root] = childVal;
                arr[largest] = rootVal;
                swaps += 1;
            }

            const swapStates = new Map<number, EntityState>([
                [root, "swapped"],
                [largest, "swapped"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, swapStates),
                edges: [],
                description: `Sifting ${String(arr[largest])} down – parent must exceed its children.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;

            root = largest;
        }
    }

    // ------------------------------------------------------------------
    // Phase 1: build the max-heap.
    // Every parent from the middle downward sifts its subtree into heap order.
    // ------------------------------------------------------------------
    for (let i = Math.floor(n / 2) - 1; i >= 0; i -= 1) {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `Heapifying subtree rooted at index ${i}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
        yield* siftDown(i, n);
    }

    // ------------------------------------------------------------------
    // Phase 2: repeatedly extract the maximum.
    // The root is the largest; swap it to the end and shrink the heap.
    // ------------------------------------------------------------------
    for (let end = n - 1; end > 0; end -= 1) {
        const rootVal = arr[0];
        const endVal = arr[end];
        if (rootVal !== undefined && endVal !== undefined) {
            arr[0] = endVal;
            arr[end] = rootVal;
            swaps += 1;
        }

        const extractStates = new Map<number, EntityState>([[end, "sorted"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, extractStates),
            edges: [],
            description: `Largest element ${String(arr[end])} moved to its final position at index ${end}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;

        // Restore heap order on the reduced heap [0..end-1].
        yield* siftDown(0, end);
    }

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

/** The Heap Sort module, registered with the engine. */
const module: AlgorithmModule = {
    id: "heap-sort",
    name: "Heap Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(1)" },
    // A shuffled array whose heap structure is easy to follow at this size.
    defaultInput: [6, 4, 8, 1, 9, 3, 7, 2],
    visualType: "array",
    run,
};

export default module;
