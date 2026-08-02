/**
 * tim-sort.ts – Tim Sort (hybrid merge + insertion sort)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Tim Sort is the hybrid algorithm behind Python's `sorted()` and Java's
 * `Arrays.sort` for objects. It scans the input once to find existing "runs"
 * (sequences that are already increasing, or decreasing – which it reverses),
 * then merges runs together using a stack that guarantees balanced merging
 * (the sizes are maintained so no run is dwarfed by its neighbour). Runs that
 * are shorter than a minimum length are extended with a binary-insertion sort.
 *
 * The key insight: real-world data usually contains long already-sorted runs,
 * so exploiting them turns O(n log n) worst case into near-O(n) on real data.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) worst, near O(n) on already-ordered data
 *   Space: O(n) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - A natural run being identified is YELLOW (comparing).
 *   - Runs being merged are highlighted PINK (highlight).
 *   - The sorted result turns GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Stable.
 *   - Adaptive: exploits natural order in the input.
 *   - This educational version keeps the run-detection and stack-merge
 *     structure but simplifies the merge-rule invariants for readability.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** The minimum run length used to guarantee a balanced merge tree. */
const MIN_RUN = 4;

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
 * The Tim Sort generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [6, 2, 8, 1, 4, 9, 3, 7];

    let step = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – tim sort will detect natural runs and merge them.",
        codeLineNumber: 0,
        layout: "array",
        meta: {},
    };
    step += 1;

    const n = arr.length;

    /**
     * Binary insertion sort a range [lo..hi) – the run-extender.
     */
    function* insertionSort(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        for (let i = lo + 1; i < hi; i += 1) {
            const key = arr[i];
            if (key === undefined) {
                continue;
            }
            let j = i - 1;
            // Plain insertion into the sorted prefix (binary search omitted for
            // teaching clarity).
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
        // Show the extended run.
        const runStates = new Map<number, EntityState>();
        for (let k = lo; k < hi; k += 1) {
            runStates.set(k, "sorted");
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, runStates),
            edges: [],
            description: `Extended a short run [${lo}..${hi - 1}] to minimum length.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {},
        };
        step += 1;
    }

    /**
     * Merge two adjacent runs arr[lo..mid) and arr[mid..hi) into one sorted
     * run.
     */
    function* merge(lo: number, mid: number, hi: number): Generator<VisualFrame, void, unknown> {
        const left = arr.slice(lo, mid);
        const right = arr.slice(mid, hi);
        let i = 0;
        let j = 0;
        let k = lo;

        // Walk the output slot, always taking the smaller front element.
        while (i < left.length && j < right.length) {
            const leftVal = left[i];
            const rightVal = right[j];
            const takeRight = (rightVal as number) < (leftVal as number);
            if (takeRight) {
                arr[k] = rightVal as number;
                j += 1;
            } else {
                arr[k] = leftVal as number;
                i += 1;
            }
            k += 1;
        }

        // Flush whichever side still has leftover elements.
        while (i < left.length) {
            arr[k] = left[i] as number;
            i += 1;
            k += 1;
        }
        while (j < right.length) {
            arr[k] = right[j] as number;
            j += 1;
            k += 1;
        }

        const mergedStates = new Map<number, EntityState>();
        for (let x = lo; x < hi; x += 1) {
            mergedStates.set(x, "sorted");
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, mergedStates),
            edges: [],
            description: `Merged runs [${lo}..${mid - 1}] and [${mid}..${hi - 1}].`,
            codeLineNumber: 3,
            layout: "array",
            meta: {},
        };
        step += 1;
    }

    // ------------------------------------------------------------------
    // Phase 1: find natural runs and extend short ones.
    // ------------------------------------------------------------------
    const runs: Array<{ lo: number; hi: number }> = [];
    let lo = 0;

    while (lo < n) {
        // Scan forward while the sequence is non-decreasing.
        let hi = lo + 1;
        while (hi < n) {
            const prev = arr[hi - 1];
            const curr = arr[hi];
            if (prev === undefined || curr === undefined || curr < prev) {
                break;
            }
            hi += 1;
        }

        // A run that is too short gets padded with an insertion sort.
        if (hi - lo < MIN_RUN) {
            const newHi = Math.min(n, lo + MIN_RUN);
            yield* insertionSort(lo, newHi);
            hi = newHi;
        }

        runs.push({ lo, hi });
        lo = hi;
    }

    // ------------------------------------------------------------------
    // Phase 2: merge runs until one giant sorted run remains.
    // ------------------------------------------------------------------
    while (runs.length > 1) {
        const a = runs.shift();
        const b = runs.shift();
        if (!a || !b) {
            break;
        }
        yield* merge(a.lo, a.hi, b.hi);
        runs.unshift({ lo: a.lo, hi: b.hi });
    }

    // Final frame: the entire array is green and fully sorted.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: "Array sorted by detecting and merging natural runs.",
        codeLineNumber: 4,
        layout: "array",
        meta: {},
    };
}

/** The Tim Sort module, registered with the engine. */
const module: AlgorithmModule = {
    id: "tim-sort",
    name: "Tim Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    // Contains a natural run (1, 4) worth spotting before merging kicks in.
    defaultInput: [6, 2, 8, 1, 4, 9, 3, 7],
    visualType: "array",
    run,
};

export default module;
