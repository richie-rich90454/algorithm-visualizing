/**
 * multi-pivot-quicksort.ts - Multi-Pivot Quick Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Multi-pivot quick sort generalizes ordinary quick sort by choosing k
 * pivots instead of one. The k pivots split the range into k+1 buckets in a
 * single pass; each bucket holds values between two adjacent pivots. Every
 * bucket is then sorted recursively with the same strategy. Using more
 * pivots reduces the recursion depth and is the basis of fast dual-pivot and
 * samplesort-style library sorts.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) expected, O(n^2) worst case
 *   Space: O(n) here for the bucket buffers (O(log n) stack)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The k chosen pivots are PURPLE (pivot).
 *   - Boundaries between buckets are YELLOW (comparing).
 *   - Buckets already fully sorted are GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = !Array.isArray(input) ? ((input as { array?: number[]; k?: number } | null) ?? {}) : {};
    const arr = Array.isArray(input)
        ? [...(input as number[])]
        : Array.isArray(task.array)
          ? [...(task.array as number[])]
          : [9, 3, 7, 1, 8, 2, 6, 5, 4, 0];
    const requestedK = typeof task.k === "number" ? Math.floor(task.k) : 3;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array before multi-pivot quick sort begins.",
        codeLineNumber: 0,
        layout: "array",
        meta: { n: arr.length, pivots: 0 },
    };
    step += 1;

    let pivotsUsed = 0;
    let partitions = 0;

    function* sortRange(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        if (hi - lo < 2) {
            return;
        }
        const unique = [...new Set(arr.slice(lo, hi))].sort((a, b) => a - b);
        const k = Math.min(Math.max(1, requestedK), unique.length - 1);
        if (k < 1) {
            return;
        }
        const pivots: number[] = [];
        for (let i = 1; i <= k; i += 1) {
            const idx = Math.floor((i * (unique.length - 1)) / (k + 1));
            pivots.push(unique[idx] as number);
        }
        pivotsUsed = Math.max(pivotsUsed, k);
        partitions += 1;

        const states = new Map<number, EntityState>();
        for (let i = lo; i < hi; i += 1) {
            if (pivots.includes(arr[i] as number)) {
                states.set(i, "pivot");
            }
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Chosen ${k} pivots [${pivots.join(", ")}] to split a range of ${hi - lo} elements.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { n: arr.length, pivots: k, partitions },
        };
        step += 1;

        const buckets: number[][] = Array.from({ length: k + 1 }, () => []);
        for (let i = lo; i < hi; i += 1) {
            const value = arr[i] as number;
            let b = 0;
            for (const p of pivots) {
                if (value > p) {
                    b += 1;
                }
            }
            buckets[b]?.push(value);
        }

        let cursor = lo;
        const bounds: Array<[number, number]> = [];
        for (const bucket of buckets) {
            const start = cursor;
            for (const value of bucket) {
                arr[cursor] = value;
                cursor += 1;
            }
            bounds.push([start, cursor]);
        }

        const bucketStates = new Map<number, EntityState>();
        let bIndex = 0;
        for (const [start, end] of bounds) {
            for (let i = start; i < end; i += 1) {
                bucketStates.set(i, bIndex % 2 === 0 ? "comparing" : "highlight");
            }
            bIndex += 1;
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, bucketStates),
            edges: [],
            description: `Distributed the range into ${k + 1} buckets between the pivots.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n: arr.length, pivots: k, partitions, bucketSizes: buckets.map((b) => b.length) },
        };
        step += 1;

        for (const [start, end] of bounds) {
            yield* sortRange(start, end);
        }
    }

    yield* sortRange(0, arr.length);

    const finalStates = new Map<number, EntityState>(arr.map((_, i) => [i, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, finalStates),
        edges: [],
        description: `Array sorted with up to ${pivotsUsed} pivots per partition across ${partitions} partition(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n: arr.length, pivots: pivotsUsed, partitions, sorted: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of one pivot splitting an array in two, multi-pivot quick sort picks several pivots and splits the array into many buckets in one pass. Each bucket only contains values inside a known key interval, so sorting a bucket independently is the same problem on a smaller range. More pivots mean shallower recursion.",
        invariants: [
            "The chosen pivots are strictly increasing distinct keys from the range.",
            "Every element of bucket i is no larger than every element of bucket i+1.",
            "Buckets partition the range exactly, so no element is lost or duplicated.",
        ],
        correctness:
            "Pivots divide the key space into disjoint intervals, and the bucket assignment places each value in exactly the interval that contains it, so concatenating the buckets orders the intervals. Recursing sorts inside each interval; by induction the whole range is sorted.",
        complexityRationale:
            "Choosing pivots and distributing a range are both linear in its size, and balanced buckets halve or better the problem size, giving O(n log n) expected time and O(n^2) worst case. This visualization buffers each bucket in an auxiliary array, so it uses O(n) temporary space in addition to the O(log n) recursion stack.",
        uses: [
            "Dual-pivot quick sort in the Java standard library",
            "Parallel samplesort in high-performance computing libraries",
            "Cache-efficient in-memory sorting of large key sets",
        ],
        references: [
            "Musser, Introspective Sorting and Selection Algorithms, 1997",
            "Aumuller and Dietzfelbinger, Multi-Pivot Quicksort: Theory and Experiments, 2014",
        ],
        workedExample:
            "For [9, 3, 7, 1, 8, 2, 6, 5, 4, 0] with pivots 2, 5 and 7, the four buckets are values up to 2, above 2 up to 5, above 5 up to 7, and above 7. Sorting each bucket recursively concatenates them into ascending order.",
    },
    id: "multi-pivot-quicksort",
    name: "Multi-Pivot Quick Sort",
    category: "sorting",
    complexity: { time: "O(n log n) expected", space: "O(n)" },
    defaultInput: { array: [9, 3, 7, 1, 8, 2, 6, 5, 4, 0], k: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "for a range of at least two elements",
        "select k increasing pivots from the range's keys",
        "assign each element to the bucket between adjacent pivots",
        "write the buckets back in pivot order",
        "recursively sort every bucket",
        "base case: a single element is sorted",
        "done: the whole array is sorted",
    ],
};

export default module;
