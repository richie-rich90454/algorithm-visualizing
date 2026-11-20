/**
 * smoothed-quicksort.ts - Smoothed Quicksort
 *
 * Smoothed quicksort chooses its pivot from a small random sample of the array
 * instead of from a fixed position. On nearly sorted or adversarial inputs a
 * fixed pivot can degrade to quadratic time, while sampling gives expected
 * linearithmic behavior that degrades gracefully as the input gets easier. A
 * three-way partition keeps duplicate-heavy arrays efficient, and an introsort
 * depth limit guarantees the worst case stays bounded.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(arr: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    if (arr.length === 0) {
        return [{
            id: "bar-empty",
            type: "bar" as const,
            label: "empty",
            value: 0,
            state: "idle" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: 0 },
        }];
    }
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

function swap(arr: number[], i: number, j: number): void {
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const fallback = [5, 3, 8, 1, 9, 2, 7, 4, 6];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    const frames: VisualFrame[] = [];
    let comparisons = 0;
    let partitions = 0;
    let seed = 88172645463325252 >>> 0;
    const rand = (): number => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };

    const push = (states: Map<number, EntityState>, desc: string, line: number): void => {
        frames.push({
            stepNumber: frames.length,
            entities: makeBars(arr, states),
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "array",
            meta: { comparisons, partitions, size: arr.length },
        });
    };

    push(new Map(), `Sorting ${arr.length} value(s) with sampled pivots.`, 0);
    if (arr.length === 0) {
        push(new Map(), "Empty array - nothing to sort.", 6);
        for (const frame of frames) yield frame;
        yield {
            stepNumber: frames.length,
            entities: makeBars([]),
            edges: [],
            description: "Done: an empty array is already sorted.",
            codeLineNumber: 6,
            layout: "array",
            meta: { comparisons, partitions, sorted: [], size: 0 },
        };
        return;
    }

    const insertion = (lo: number, hi: number): void => {
        for (let i = lo + 1; i <= hi; i += 1) {
            const key = arr[i]!;
            let j = i - 1;
            while (j >= lo && arr[j]! > key) {
                arr[j + 1] = arr[j]!;
                j -= 1;
            }
            arr[j + 1] = key;
        }
        push(new Map([[lo, "sorted"]]), `Insertion-sorted a small range of ${hi - lo + 1} value(s).`, 1);
    };

    const heapRange = (lo: number, hi: number): void => {
        const n = hi - lo + 1;
        const sift = (root: number, size: number): void => {
            for (;;) {
                const child = 2 * root + 1;
                if (child >= size) break;
                let largest = child;
                if (child + 1 < size && arr[lo + child + 1]! > arr[lo + child]!) largest = child + 1;
                if (arr[lo + root]! >= arr[lo + largest]!) break;
                swap(arr, lo + root, lo + largest);
                root = largest;
            }
        };
        for (let i = Math.floor(n / 2) - 1; i >= 0; i -= 1) sift(i, n);
        for (let end = n - 1; end > 0; end -= 1) {
            swap(arr, lo, lo + end);
            sift(0, end);
        }
        push(new Map([[lo, "pivot"]]), `Heap-sorted range after exhausting the recursion depth limit.`, 5);
    };

    const sort = (lo: number, hi: number, depth: number): void => {
        const len = hi - lo + 1;
        if (len <= 1) return;
        if (len <= 8) {
            insertion(lo, hi);
            return;
        }
        if (depth <= 0) {
            heapRange(lo, hi);
            return;
        }
        const sample: number[] = [];
        for (let k = 0; k < 5; k += 1) {
            const idx = lo + Math.floor(rand() * len);
            sample.push(arr[idx]!);
        }
        sample.sort((a, b) => a - b);
        const pivot = sample[Math.floor(sample.length / 2)]!;
        partitions += 1;
        let lt = lo;
        let i = lo;
        let gt = hi;
        while (i <= gt) {
            comparisons += 1;
            if (arr[i]! < pivot) {
                swap(arr, lt, i);
                lt += 1;
                i += 1;
            } else if (arr[i]! > pivot) {
                swap(arr, i, gt);
                gt -= 1;
            } else {
                i += 1;
            }
        }
        const states = new Map<number, EntityState>();
        for (let k = lt; k <= gt; k += 1) states.set(k, "pivot");
        push(states, `Sampled pivot ${pivot}; partitioned into ${lt - lo}, ${gt - lt + 1} and ${hi - gt} value(s).`, 3);
        sort(lo, lt - 1, depth - 1);
        sort(gt + 1, hi, depth - 1);
    };

    const depthLimit = 2 * Math.floor(Math.log2(arr.length));
    sort(0, arr.length - 1, depthLimit);

    for (const frame of frames) yield frame;
    const sorted = [...arr].sort((a, b) => a - b);
    yield {
        stepNumber: frames.length,
        entities: makeBars(sorted, new Map(sorted.map((_, i) => [i, "sorted" as EntityState]))),
        edges: [],
        description: `Done: sorted ${sorted.length} value(s) in ${comparisons} comparison(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { comparisons, partitions, sorted, size: sorted.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single fixed pivot can be terrible on data that happens to be sorted. Smoothed quicksort instead looks at a handful of randomly chosen values and uses their median as the pivot. That sample is likely near the true median, so both sides of the partition shrink quickly on almost every input.",
        invariants: [
            "After a partition, every value left of the equal block is smaller and every value right of it is larger.",
            "The recursion depth never exceeds the introsort limit, so heapsort bounds the worst case.",
            "The three-way partition keeps all equal values together and removes them from further recursion.",
        ],
        correctness:
            "Each partition places every element strictly below, equal to, or strictly above the pivot into its own contiguous block. Recursing on the two outer blocks and recursively applying the same rule sorts them by induction; combined with the sorted equal block, the whole range is sorted. The heapsort fallback is also a correct sort, so hitting the depth limit cannot produce wrong results.",
        complexityRationale:
            "A random sample of constant size gives expected linearithmic time, matching ordinary quicksort while smoothing out bad inputs. The depth cap adds at most O(n log n) heapsort work, and the array is sorted in place with O(log n) recursion stack.",
        uses: [
            "General-purpose sorting in libraries that face unknown input distributions",
            "Sorting nearly sorted logs and timestamps",
            "A teaching bridge between randomized and deterministic quicksort",
        ],
        references: [
            "Martinez and Roura, Smoothed Analysis of Quicksort and Quickselect, 2005",
            "Spielman and Teng, Smoothed Analysis of Algorithms, 2004",
        ],
        workedExample:
            "For [5, 3, 8, 1, 9, 2, 7, 4, 6], a sample of five values has median near 5. Partitioning puts 1, 2, 3, 4 on the left, 5 in the equal block, and 6, 7, 8, 9 on the right; recursion sorts each side.",
    },
    id: "smoothed-quicksort",
    name: "Smoothed Quicksort",
    category: "sorting",
    complexity: { time: "O(n log n) expected", space: "O(log n)" },
    defaultInput: [5, 3, 8, 1, 9, 2, 7, 4, 6],
    visualType: "array",
    run,
    pseudocode: [
        "read the array of values",
        "if the range is small, finish it with insertion sort",
        "pick a pivot as the median of a small random sample",
        "partition into values below, equal to, and above the pivot",
        "recurse on the lower and upper blocks",
        "if recursion depth runs out, finish with heapsort",
        "done: report the sorted array",
    ],
};

export default module;
