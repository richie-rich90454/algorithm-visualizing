/**
 * radix-sort-msd.ts – Radix Sort (MSD, most-significant digit first)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Where LSD radix sort processes digits from the least significant upward,
 * MSD radix sort starts at the most significant digit and *recursively*
 * sub-sorts each digit group. After the first pass the array is ordered by the
 * leading digit; each group of elements sharing a leading digit is then sorted
 * independently by the next digit, and so on. This makes MSD radix sort
 * naturally recursive and similar in spirit to quick sort's partition-then-
 * recurse shape.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d × n) average (each element participates in at most d digit
 *          passes, with d = number of digits)
 *   Space: O(n) auxiliary (bucket arrays during the recursive passes)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The digit group being processed is YELLOW (comparing).
 *   - Elements bucketed by their current digit are PINK (highlight).
 *   - Groups that finish become GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Not stable in this implementation (bucket order within a group is not
 *     guaranteed to preserve input order).
 *   - MSD is the variant used for sorting strings with common prefixes
 *     (think dictionary order) because short strings finish early.
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
 * Extract a single decimal digit from a number.
 *
 * @param value The number to inspect.
 * @param place The digit position: 0 = units, 1 = tens, 2 = hundreds, …
 * @returns The digit (0–9) at that position.
 */
function digitAt(value: number, place: number): number {
    return Math.floor(Math.abs(value) / 10 ** place) % 10;
}

/**
 * The Radix Sort (MSD) generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [170, 45, 75, 90, 802, 24, 2, 66];

    let step = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – radix sort (MSD) will sort from the most significant digit.",
        codeLineNumber: 0,
        layout: "array",
        meta: {},
    };
    step += 1;

    if (arr.length === 0) {
        return;
    }

    const maxValue = Math.max(...arr.map(Math.abs));
    const maxDigits = String(maxValue).length;

    /**
     * Recursively sort a sub-array by a given digit place, most significant
     * first. The `range` keeps track of which slice of the array we own.
     */
    function* msdSort(
        lo: number,
        hi: number,
        place: number,
    ): Generator<VisualFrame, void, unknown> {
        // Base cases: slices of size ≤ 1 are sorted; no digits left → done.
        if (hi <= lo || place < 0) {
            return;
        }

        // Bucket the slice by the digit at `place`.
        const buckets: number[][] = Array.from({ length: 10 }, () => []);

        for (let i = lo; i <= hi; i += 1) {
            const value = arr[i];
            if (value === undefined) {
                continue;
            }
            (buckets[digitAt(value, place)] ?? []).push(value);
        }

        // Reassemble the slice in bucket order.
        let writeIndex = lo;
        for (let d = 0; d < 10; d += 1) {
            const bucket = buckets[d];
            if (!bucket) {
                continue;
            }
            for (const value of bucket) {
                arr[writeIndex] = value;
                writeIndex += 1;
            }
        }

        // Show the slice after the digit pass.
        const passStates = new Map<number, EntityState>();
        for (let i = lo; i <= hi; i += 1) {
            passStates.set(i, "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, passStates),
            edges: [],
            description: `Sorted slice [${lo}..${hi}] by the ${String(10 ** place)}s digit.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { digitPlace: place },
        };
        step += 1;

        // Recurse into each non-empty bucket for the next (less significant)
        // digit. The bucket boundaries are tracked with a running offset.
        let bucketStart = lo;
        for (let d = 0; d < 10; d += 1) {
            const bucket = buckets[d];
            if (!bucket || bucket.length === 0) {
                continue;
            }
            const bucketEnd = bucketStart + bucket.length - 1;
            yield* msdSort(bucketStart, bucketEnd, place - 1);
            bucketStart = bucketEnd + 1;
        }
    }

    // Start the recursion at the most significant digit over the whole array.
    yield* msdSort(0, arr.length - 1, maxDigits - 1);

    // Final frame: the entire array is green and fully sorted.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: "Array sorted with recursive most-significant-digit radix sort.",
        codeLineNumber: 4,
        layout: "array",
        meta: { digitPasses: maxDigits },
    };
}

/** The Radix Sort (MSD) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "radix-sort-msd",
    name: "Radix Sort (MSD)",
    category: "sorting",
    complexity: { time: "O(d × n)", space: "O(n)" },
    // Same classic input as the LSD variant so the two can be compared.
    defaultInput: [170, 45, 75, 90, 802, 24, 2, 66],
    visualType: "array",
    run,
};

export default module;
