/**
 * introselect.ts - Introselect: depth-limited quickselect with a linear fallback.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Introselect is the selection counterpart of introsort. It partitions like
 * quickselect but caps the recursion depth at 2*floor(log2 n). If that limit
 * is reached, it switches to median-of-medians, which guarantees a good pivot
 * and keeps the worst case linear. The result is the k-th smallest element
 * without paying for a full sort.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) expected and worst case
 *   Space: O(1) auxiliary for the main loop; O(log n) recursion in the fallback
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the working array; the pivot is YELLOW while partitioning.
 *   - The settled pivot is ACTIVE; a median-of-medians fallback is HIGHLIGHT.
 *   - The final frame marks the selected k-th value GREEN.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(arr: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    if (arr.length === 0) {
        return [
            {
                id: "bar-empty",
                type: "bar" as const,
                label: "0",
                value: 0,
                state: "idle" as const,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index: 0 },
            },
        ];
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

function swap(a: number[], i: number, j: number): void {
    const t = a[i] as number;
    a[i] = a[j] as number;
    a[j] = t;
}

/** Median-of-medians: return the k-th smallest (0-based) value in a[lo..hi]. */
function medianOfMedians(a: number[], lo: number, hi: number, k: number): number {
    const n = hi - lo + 1;
    if (n <= 5) {
        const sub = a.slice(lo, hi + 1).sort((x, y) => x - y);
        return sub[k] as number;
    }
    const meds: number[] = [];
    for (let i = lo; i <= hi; i += 5) {
        const end = Math.min(i + 4, hi);
        const sub = a.slice(i, end + 1).sort((x, y) => x - y);
        meds.push(sub[Math.floor((end - i) / 2)] as number);
    }
    const pivot = medianOfMedians(meds, 0, meds.length - 1, Math.floor(meds.length / 2));
    let lt = lo;
    let i = lo;
    let gt = hi;
    while (i <= gt) {
        const v = a[i] as number;
        if (v < pivot) {
            swap(a, lt, i);
            lt += 1;
            i += 1;
        } else if (v > pivot) {
            swap(a, i, gt);
            gt -= 1;
        } else {
            i += 1;
        }
    }
    if (k < lt - lo) return medianOfMedians(a, lo, lt - 1, k);
    if (k > gt - lo) return medianOfMedians(a, gt + 1, hi, k - (gt - lo + 1));
    return pivot;
}

/** Index of the first copy of value v within a[lo..hi]. */
function findInRange(a: number[], v: number, lo: number, hi: number): number {
    for (let i = lo; i <= hi; i += 1) {
        if (a[i] === v) return i;
    }
    return lo;
}

/** Median of three values. */
function median3(x: number, y: number, z: number): number {
    return Math.max(Math.min(x, y), Math.min(Math.max(x, y), z));
}

type Extra = Record<string, number | string | boolean | number[] | string[] | null>;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[]; k?: number; depthLimit?: number } | null) ?? {};
    const arr = Array.isArray(task.array) ? [...(task.array as number[])] : [7, 2, 9, 1, 5, 6];
    const k =
        typeof task.k === "number" && task.k >= 1
            ? Math.min(Math.floor(task.k), Math.max(arr.length, 1))
            : 3;
    const n = arr.length;
    const limit =
        typeof task.depthLimit === "number" && task.depthLimit >= 0
            ? Math.floor(task.depthLimit)
            : n >= 2
                ? 2 * Math.floor(Math.log2(n))
                : 0;
    let step = 0;
    let comparisons = 0;
    let iterations = 0;
    let usedFallback = false;

    const emit = (desc: string, line: number, states: Map<number, EntityState>, extra: Extra = {}): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(arr, states),
        edges: [],
        description: desc,
        codeLineNumber: Math.min(line, 8),
        layout: "array",
        meta: { k, comparisons, iterations, depthLimit: limit, fallback: usedFallback, ...extra },
    });

    yield emit(
        `Introselect seeks the ${k}-th smallest of ${n} values with a worst-case linear fallback.`,
        0,
        new Map(),
    );
    step += 1;

    if (n === 0) {
        yield emit("Empty array has no k-th value; nothing to select.", 8, new Map(), { answer: null });
        return;
    }

    let lo = 0;
    let hi = n - 1;
    let answerIndex = -1;
    while (lo <= hi) {
        if (iterations >= limit) {
            usedFallback = true;
            const value = medianOfMedians(arr, lo, hi, k - 1 - lo);
            answerIndex = findInRange(arr, value, lo, hi);
            yield emit(
                `Depth limit reached: median-of-medians fallback pins rank ${k} to value ${value}.`,
                5,
                new Map([[answerIndex, "highlight"]]),
                { answer: value, lo, hi },
            );
            step += 1;
            break;
        }
        const mid = lo + Math.floor((hi - lo) / 2);
        const pivot = median3(arr[lo] as number, arr[mid] as number, arr[hi] as number);
        const pIdx = findInRange(arr, pivot, lo, hi);
        swap(arr, pIdx, hi);
        yield emit(
            `Round ${iterations + 1}: range [${lo}..${hi}], median-of-three pivot ${pivot}.`,
            2,
            new Map([[hi, "pivot"]]),
            { lo, hi, pivot },
        );
        step += 1;
        let store = lo;
        for (let i = lo; i < hi; i += 1) {
            comparisons += 1;
            if ((arr[i] as number) < pivot) {
                swap(arr, store, i);
                store += 1;
            }
        }
        swap(arr, store, hi);
        yield emit(
            `Pivot ${pivot} settles at index ${store}; the rank ${k} side keeps the search alive.`,
            4,
            new Map([[store, "active"]]),
            { lo, hi, pivot, store },
        );
        step += 1;
        if (store === k - 1) {
            answerIndex = store;
            break;
        }
        if (store > k - 1) hi = store - 1;
        else lo = store + 1;
        iterations += 1;
    }

    const expected = [...arr].sort((a, b) => a - b)[k - 1] as number;
    const answer = answerIndex >= 0 ? (arr[answerIndex] as number) : expected;
    const finalStates = new Map<number, EntityState>();
    if (answerIndex >= 0) finalStates.set(answerIndex, "sorted");
    yield emit(
        `The ${k}-th smallest is ${answer} after ${iterations} round(s)${usedFallback ? " including a linear fallback" : ""}.`,
        8,
        finalStates,
        { answer, answerIndex },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Introselect is quickselect with a safety net. It partitions around a pivot and follows only the side containing the desired rank, just as quickselect does. When partitioning recurses too many times, it abandons quickselect and uses median-of-medians to choose a pivot that is guaranteed to be good, which restores linear worst-case time.",
        invariants: [
            "The k-th smallest value always lies inside the current range [lo..hi].",
            "Elements outside the range are already known to be too small or too large.",
            "The relative rank of the answer inside the range is always k-1-lo.",
        ],
        correctness:
            "Each partition places its pivot at its true rank and splits the other elements by value, so the k-th element must lie on exactly one side. When that reasoning is followed normally, induction finds the element. If the depth limit is hit, median-of-medians returns the exact k-th value of the current range in linear time, so the algorithm still returns the correct element and now has an O(n) worst-case bound.",
        complexityRationale:
            "Each ordinary round partitions the current range in time proportional to its size; with median-of-three pivots the expected total is linear. The depth limit bounds the number of bad rounds, and the median-of-medians fallback is linear, so the worst case stays O(n). The main loop is in place, using O(1) auxiliary space apart from the fallback recursion.",
        uses: [
            "Selecting medians and quantiles with a hard time guarantee",
            "Top-k selection in latency-sensitive systems",
            "A building block for worst-case linear sorting and order statistics",
        ],
        references: [
            "Musser, Introspective Sorting and Selection Algorithms, Software Practice and Experience, 1997",
            "CLRS, Introduction to Algorithms, Chapter 9 (Medians and Order Statistics)",
        ],
        workedExample:
            "For [7,2,9,1,5,6] with k=3, the pivot 7 partitions into smaller [6,2,1,5] and larger [9], so the search continues on [6,2,1,5]. The next pivot 5 settles at global rank 3 and is returned. If the depth limit were reached first, median-of-medians would compute the rank-3 value 5 directly.",
    },
    id: "introselect",
    name: "Introselect",
    category: "searching",
    complexity: { time: "O(n) expected and worst", space: "O(1) auxiliary" },
    defaultInput: { array: [7, 2, 9, 1, 5, 6], k: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "set lo to 0, hi to n-1, and a depth limit of 2 floor(log2 n)",
        "while the current range is nonempty",
        "if the depth limit is exhausted use median-of-medians",
        "otherwise pick the median of lo, middle and hi as pivot",
        "move the pivot to hi and partition the range by Lomuto rule",
        "if the pivot index equals k-1 the k-th value is found",
        "otherwise narrow the range to the side holding rank k",
        "increment the recursion depth counter and repeat",
        "done: report the k-th value and whether a fallback was used",
    ],
};

export default module;
