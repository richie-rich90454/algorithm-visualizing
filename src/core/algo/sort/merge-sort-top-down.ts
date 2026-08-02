/**
 * merge-sort-top-down.ts – Merge Sort (Top-Down, recursive)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Merge sort is the archetypal divide-and-conquer sorting algorithm. It
 * recursively splits the array into halves until each piece is a single
 * element (trivially sorted), then merges the pieces back together so that
 * each merge produces a larger sorted run. The recursion naturally organises
 * the work: split on the way down, merge on the way up.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) worst, average, and best – merges cost O(n) at each of
 *          the O(log n) levels of the recursion tree
 *   Space: O(n) auxiliary – the merge step needs a temporary buffer
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The subarray currently being split/merged is YELLOW (comparing).
 *   - Elements being compared across the merge boundary are PINK (highlight).
 *   - The final sorted array is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Stable: the merge copies the left half first on ties.
 *   - Guaranteed O(n log n) regardless of input order.
 *   - The recursive top-down form is the classic teaching version; the
 *     bottom-up variant (see merge-sort-bottom-up) avoids recursion entirely.
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
 * The Merge Sort generator.
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
        description: "Initial array – split into halves recursively.",
        codeLineNumber: 0,
        layout: "array",
        meta: { merges },
    };
    step += 1;

    // Temporary buffer shared by every merge to avoid repeated allocations.
    const temp: number[] = new Array(arr.length);

    /**
     * Merge the two sorted runs arr[lo..mid] and arr[mid+1..hi] back together,
     * writing the combined sorted run back into arr. Also yields the frame
     * that shows the comparison moment.
     */
    function* merge(lo: number, mid: number, hi: number): Generator<VisualFrame, void, unknown> {
        // Copy the slice into the temporary buffer so writes never clobber
        // a value that has not been read yet.
        for (let k = lo; k <= hi; k += 1) {
            temp[k] = arr[k];
        }

        let i = lo; // pointer into the left run
        let j = mid + 1; // pointer into the right run

        // Walk the output position from lo to hi, always taking the smaller
        // front element of the two runs (left on ties → stability).
        for (let k = lo; k <= hi; k += 1) {
            const leftVal = temp[i];
            const rightVal = temp[j];

            // Pick from the right run when the left run is exhausted, or when
            // the right run's front is strictly smaller than the left's.
            const takeRight = i > mid || (j <= hi && (rightVal as number) < (leftVal as number));

            // Highlight the two elements being compared across the boundary.
            const cmpStates = new Map<number, EntityState>([
                [i, "comparing"],
                [j, "comparing"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, cmpStates),
                edges: [],
                description: `Merging – comparing ${String(leftVal)} and ${String(rightVal)}.`,
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
        // The merged slice is now sorted; mark it green to celebrate.
        const mergedStates = new Map<number, EntityState>();
        for (let k = lo; k <= hi; k += 1) {
            mergedStates.set(k, "sorted");
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, mergedStates),
            edges: [],
            description: `Merged slice [${lo}..${hi}] into sorted order.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { merges },
        };
        step += 1;
    }

    /**
     * Recursive driver: split [lo..hi] until base case, then merge the halves.
     */
    function* sortRange(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        // Base case: a single element (or empty range) is already sorted.
        if (hi <= lo) {
            return;
        }

        const mid = Math.floor((lo + hi) / 2);

        // Highlight the range being split so the recursion is visible.
        const splitStates = new Map<number, EntityState>();
        for (let k = lo; k <= hi; k += 1) {
            splitStates.set(k, "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, splitStates),
            edges: [],
            description: `Splitting range [${lo}..${hi}] at index ${mid}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { merges },
        };
        step += 1;

        // Conquer each half recursively.
        yield* sortRange(lo, mid);
        yield* sortRange(mid + 1, hi);

        // Combine the two sorted halves.
        yield* merge(lo, mid, hi);
    }

    // Kick off the whole recursive sort over the full array.
    yield* sortRange(0, arr.length - 1);

    // Final frame: the entire array is green and fully sorted.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: `Array sorted with ${merges} merge operations.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { merges },
    };
}

/** The Merge Sort (Top-Down) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "merge-sort-top-down",
    name: "Merge Sort (Top-Down)",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    // A power-of-two length makes the binary split structure crystal clear.
    defaultInput: [6, 3, 8, 1, 7, 2, 5, 4],
    visualType: "array",
    run,
};

export default module;
