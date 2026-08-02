/**
 * bucket-sort.ts – Bucket Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bucket sort distributes values into a fixed number of ordered buckets by
 * range, sorts each bucket individually (here with insertion sort), and then
 * concatenates the buckets in order. When values are distributed uniformly,
 * each bucket holds roughly the same number of elements, so the per-bucket
 * sorts are cheap and the whole process approaches linear time.
 *
 * This version works on floating-point values in [0, 1) using the classic
 * textbook formulation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) average (uniform distribution), O(n²) worst (all values in
 *          one bucket)
 *   Space: O(n) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The bucket currently being filled is PINK (highlight).
 *   - Values being dropped into a bucket are YELLOW (comparing).
 *   - The final concatenated array turns GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Stable if the per-bucket sort is stable (insertion sort is).
 *   - Shines when input is uniformly distributed across the value range.
 *   - Not a comparison sort; avoids the O(n log n) lower bound on average.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Number of buckets to distribute the values into. */
const BUCKET_COUNT = 5;

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
 * The Bucket Sort generator.
 *
 * @param input The array of numbers (in [0, 1)) to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input)
        ? [...(input as number[])]
        : [0.42, 0.32, 0.67, 0.1, 0.55, 0.83, 0.24, 0.71];

    let step = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array of floats in [0, 1) – bucket sort will distribute them.",
        codeLineNumber: 0,
        layout: "array",
        meta: { buckets: BUCKET_COUNT },
    };
    step += 1;

    if (arr.length === 0) {
        return;
    }

    // ------------------------------------------------------------------
    // Phase 1: distribute every value into its range bucket.
    // Bucket i holds values in [i/n, (i+1)/n).
    // ------------------------------------------------------------------
    const buckets: number[][] = Array.from({ length: BUCKET_COUNT }, () => []);

    for (let i = 0; i < arr.length; i += 1) {
        const value = arr[i];
        if (value === undefined) {
            continue;
        }

        // Clamp the bucket index to avoid overflow at exactly 1.0.
        const bucketIndex = Math.min(BUCKET_COUNT - 1, Math.floor(value * BUCKET_COUNT));
        (buckets[bucketIndex] ?? []).push(value);

        const fillStates = new Map<number, EntityState>([
            [i, "comparing"],
            [bucketIndex, "highlight"],
        ]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, fillStates),
            edges: [],
            description: `${value} dropped into bucket ${bucketIndex} (range [${bucketIndex}/${BUCKET_COUNT}, ${bucketIndex + 1}/${BUCKET_COUNT})).`,
            codeLineNumber: 1,
            layout: "array",
            meta: { buckets: BUCKET_COUNT },
        };
        step += 1;
    }

    // ------------------------------------------------------------------
    // Phase 2: sort each bucket individually with insertion sort, then
    // concatenate the buckets back into the array in bucket order.
    // ------------------------------------------------------------------
    const sorted: number[] = [];

    for (let b = 0; b < BUCKET_COUNT; b += 1) {
        const bucket = buckets[b] ?? [];

        // Insertion sort inside the bucket (small buckets → nearly free).
        for (let i = 1; i < bucket.length; i += 1) {
            const key = bucket[i];
            if (key === undefined) {
                continue;
            }
            let j = i - 1;
            while (j >= 0) {
                const left = bucket[j];
                if (left === undefined || left <= key) {
                    break;
                }
                bucket[j + 1] = left;
                j -= 1;
            }
            bucket[j + 1] = key;
        }

        // Append the sorted bucket to the running output.
        for (const value of bucket) {
            sorted.push(value);
        }

        yield {
            stepNumber: step,
            entities: makeBars(bucket.length ? bucket : arr),
            edges: [],
            description: `Bucket ${b} sorted – appended ${bucket.length} element(s).`,
            codeLineNumber: 3,
            layout: "array",
            meta: { bucket: b },
        };
        step += 1;
    }

    // Copy the concatenated result back into the working array.
    for (let i = 0; i < arr.length; i += 1) {
        arr[i] = sorted[i] ?? 0;
    }

    // Final frame: the entire array is green and fully sorted.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: `Array sorted by distributing into ${BUCKET_COUNT} buckets.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { buckets: BUCKET_COUNT },
    };
}

/** The Bucket Sort module, registered with the engine. */
const module: AlgorithmModule = {
    id: "bucket-sort",
    name: "Bucket Sort",
    category: "sorting",
    complexity: { time: "O(n) average", space: "O(n)" },
    // Uniformly-ish spread floats make every bucket visibly busy.
    defaultInput: [0.42, 0.32, 0.67, 0.1, 0.55, 0.83, 0.24, 0.71],
    visualType: "array",
    run,
};

export default module;
