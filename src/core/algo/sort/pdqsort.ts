/**
 * pdqsort.ts - Pattern-Defeating Quicksort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Pattern-defeating quicksort is a quicksort that adapts to the shape of the
 * data. It detects already ascending or descending ranges and finishes them in
 * linear time, uses a ninther pivot on large ranges, partitions in three ways
 * so that many duplicate keys collapse at once, falls back to heapsort when
 * partitions stay unbalanced, and finally switches to insertion sort for tiny
 * ranges. It is the basis of several modern standard-library sort routines.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) average, O(n) on sorted or reversed data
 *   Space: O(log n) recursion stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the array; a pivot is GOLD and a moved element is ORANGE.
 *   - A detected pattern lights the range GREEN; a heapsort fallback is RED.
 *   - The final frame marks everything GREEN.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(a: number[], states: Map<number, EntityState>): VisualEntity[] {
    return a.map((value, index) => ({
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

function insertionSort(a: number[], lo: number, hi: number): void {
    for (let i = lo + 1; i < hi; i += 1) {
        const v = a[i] as number;
        let j = i - 1;
        while (j >= lo && (a[j] as number) > v) {
            a[j + 1] = a[j] as number;
            j -= 1;
        }
        a[j + 1] = v;
    }
}

function heapSort(a: number[], lo: number, hi: number): void {
    const n = hi - lo;
    const sift = (root: number, end: number): void => {
        while (2 * root + 1 < end) {
            let c = 2 * root + 1;
            if (c + 1 < end && (a[lo + c + 1] as number) > (a[lo + c] as number)) c += 1;
            if ((a[lo + root] as number) >= (a[lo + c] as number)) break;
            const t = a[lo + root] as number;
            a[lo + root] = a[lo + c] as number;
            a[lo + c] = t;
            root = c;
        }
    };
    for (let i = Math.floor(n / 2) - 1; i >= 0; i -= 1) sift(i, n);
    for (let e = n - 1; e > 0; e -= 1) {
        const t = a[lo] as number;
        a[lo] = a[lo + e] as number;
        a[lo + e] = t;
        sift(0, e);
    }
}

function medianOfThree(a: number[], i: number, j: number, k: number): number {
    const x = a[i] as number;
    const y = a[j] as number;
    const z = a[k] as number;
    if (x <= y) return y <= z ? j : x <= z ? k : i;
    return x <= z ? i : y <= z ? k : j;
}

/** Tukey's ninther: the median of three medians, for large ranges. */
function ninther(a: number[], lo: number, hi: number): number {
    const step = Math.max(1, Math.floor((hi - lo) / 8));
    const m1 = medianOfThree(a, lo, lo + step, lo + 2 * step);
    const mid = lo + Math.floor((hi - lo) / 2);
    const m2 = medianOfThree(a, mid - step, mid, mid + step);
    const m3 = medianOfThree(a, hi - 1 - 2 * step, hi - 1 - step, hi - 1);
    return medianOfThree(a, m1, m2, m3);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const a: number[] = Array.isArray(input) ? [...(input as number[])] : [6, 1, 8, 2, 9, 3, 7, 4, 5, 0];
    let step = 0;

    const emit = (
        description: string,
        codeLineNumber: number,
        states: Map<number, EntityState> = new Map(),
        meta: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => {
        const s = step;
        step += 1;
        return {
            stepNumber: s,
            entities: makeBars(a, states),
            edges: [],
            description,
            codeLineNumber,
            layout: "array",
            meta: { n: a.length, ...meta },
        };
    };

    function* pdq(lo: number, hi: number, budget: { v: number }): Generator<VisualFrame, void, unknown> {
        while (hi - lo > 16) {
            if (budget.v <= 0) {
                heapSort(a, lo, hi);
                yield emit(`Bad-partition budget exhausted: heapsort range [${lo}, ${hi}).`, 7, new Map(), { lo, hi, fallback: true });
                return;
            }
            let asc = true;
            let desc = true;
            for (let s = lo + 1; s < hi; s += 1) {
                if ((a[s] as number) < (a[s - 1] as number)) asc = false;
                if ((a[s] as number) > (a[s - 1] as number)) desc = false;
                if (!asc && !desc) break;
            }
            const green = new Map<number, EntityState>();
            for (let i = lo; i < hi; i += 1) green.set(i, "sorted");
            if (asc) {
                yield emit(`Range [${lo}, ${hi}) is already ascending; no work needed.`, 1, green, { lo, hi, pattern: "ascending" });
                return;
            }
            if (desc) {
                for (let i = lo, j = hi - 1; i < j; i += 1, j -= 1) {
                    const t = a[i] as number;
                    a[i] = a[j] as number;
                    a[j] = t;
                }
                yield emit(`Range [${lo}, ${hi}) was descending; reversed it in one pass.`, 2, green, { lo, hi, pattern: "descending" });
                return;
            }
            const pIdx = hi - lo > 50 ? ninther(a, lo, hi) : medianOfThree(a, lo, lo + Math.floor((hi - lo) / 2), hi - 1);
            const pivot = a[pIdx] as number;
            let lt = lo;
            let i = lo;
            let gt = hi;
            while (i < gt) {
                const v = a[i] as number;
                if (v < pivot) {
                    const t = a[lt] as number;
                    a[lt] = v;
                    a[i] = t;
                    lt += 1;
                    i += 1;
                } else if (v > pivot) {
                    gt -= 1;
                    const t = a[i] as number;
                    a[i] = a[gt] as number;
                    a[gt] = t;
                } else {
                    i += 1;
                }
            }
            const partStates = new Map<number, EntityState>();
            for (let k = lo; k < lt; k += 1) partStates.set(k, "swapped");
            for (let k = lt; k < gt; k += 1) partStates.set(k, "pivot");
            yield emit(`Three-way partition around ${pivot}: less [${lo}, ${lt}), equal [${lt}, ${gt}), greater [${gt}, ${hi}).`, 4, partStates, { lo, hi, lt, gt, pivotValue: pivot });
            const leftSize = lt - lo;
            const rightSize = hi - gt;
            if (leftSize < (hi - lo) / 8 || rightSize < (hi - lo) / 8) budget.v -= 1;
            if (leftSize < rightSize) {
                yield* pdq(lo, lt, budget);
                lo = gt;
            } else {
                yield* pdq(gt, hi, budget);
                hi = lt;
            }
        }
        insertionSort(a, lo, hi);
        const small = new Map<number, EntityState>();
        for (let i = lo; i < hi; i += 1) small.set(i, "sorted");
        yield emit(`Insertion-sorted the small range [${lo}, ${hi}).`, 8, small, { lo, hi, insertion: true });
    }

    yield emit("Pattern-defeating quicksort begins.", 0);
    const budget = { v: 2 * Math.floor(Math.log2(Math.max(2, a.length))) };
    yield* pdq(0, a.length, budget);
    const all = new Map<number, EntityState>(a.map((_, idx) => [idx, "sorted" as EntityState]));
    yield emit(`Sorted: [${a.join(", ")}].`, 9, all, { sorted: true });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Pattern-defeating quicksort keeps the speed of quicksort while neutralizing its bad cases. If a range is already ordered, it is left alone; if it is reversed, one pass fixes it. Large ranges use a ninther pivot, equal keys are grouped in one three-way partition, and a budget of bad partitions triggers a heapsort fallback so the recursion cannot degenerate.",
        invariants: [
            "After a three-way partition, the less, equal, and greater regions are in that order and each region is internally a permutation of prior values.",
            "The bad-partition budget only decreases, and reaching zero switches the remaining work to heapsort.",
            "A range reported as ascending or descending is already in its final relative order after the possible reversal.",
        ],
        correctness:
            "Each partition permutes values so that every less-region value is smaller than every equal-region value, which is smaller than every greater-region value. Recursing on the smaller side and looping on the larger preserves this ordering at every boundary. The heapsort fallback sorts its range outright, insertion sort finishes small ranges, and the ascending and descending checks are correct because their full scans certify the range's order.",
        complexityRationale:
            "Partition scans and the pattern check are linear per level, and balanced three-way partitions give O(n log n) total. Sorted or reversed input is recognized in one O(n) pass. An unbalanced partition consumes budget, and after O(log n) of them heapsort bounds the remaining cost at O(n log n). Recursion uses O(log n) stack space.",
        uses: [
            "General-purpose sorting in modern C++ and Rust standard libraries",
            "Sorting real-world data that is often partially ordered",
            "Handling inputs with many equal keys without quadratic slowdown",
        ],
        references: [
            "Orson Peters, Pattern Defeating Quicksort, 2015",
            "Boost.Sort, pdqsort implementation notes and benchmarks",
        ],
        workedExample:
            "On [6, 1, 8, 2, 9, 3, 7, 4, 5, 0] the pivot near the middle is 3, producing a less group, an equal group, and a greater group. Each group is processed the same way; small groups are insertion sorted, and the result is [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].",
    },
    id: "pdqsort",
    name: "Pattern-Defeating Quicksort",
    category: "sorting",
    complexity: { time: "O(n log n) average", space: "O(log n)" },
    defaultInput: [6, 1, 8, 2, 9, 3, 7, 4, 5, 0],
    visualType: "array",
    run,
    pseudocode: [
        "pdqsort(A, lo, hi): if hi - lo <= 16 go to insertion sort",
        "if the range is already ascending: return",
        "if the range is descending: reverse it and return",
        "choose a pivot by median-of-three (ninther for large ranges)",
        "partition into less, equal, and greater with a three-way scan",
        "record whether the partition was unbalanced",
        "recurse on the smaller side and loop on the larger side",
        "if the bad-partition budget runs out: heapsort the range",
        "insertion sort any small remaining range",
        "done: the whole array is sorted",
    ],
};

export default module;
