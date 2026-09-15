/**
 * quickselect.ts – Quickselect
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quickselect finds the k-th smallest element without fully sorting. It picks
 * the last element as pivot, partitions with the Lomuto scheme so smaller
 * values move left, then recurses only into the side holding k. If the pivot
 * lands exactly on k-1 the search ends. On average each round discards a
 * constant fraction of the array, which is why the average cost is linear
 * even though the worst case is quadratic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) average, O(n²) worst (unlucky pivots every round)
 *   Space: O(1) auxiliary – in place partitioning, iterative here
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The pivot is YELLOW (comparing) while its interval partitions.
 *   - The settled pivot index is PINK (highlight).
 *   - The confirmed k-th element turns GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The selection twin of quicksort: same partition, one-sided recursion.
 *   - Finds medians and order statistics without paying for a full sort.
 *   - Randomized pivots give linear expected time in production code.
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
    const task = (input as { array?: number[]; k?: number } | null) ?? {};
    const arr = Array.isArray(task.array) ? [...(task.array as number[])] : [7, 2, 9, 1, 5, 6];
    const k =
        typeof task.k === "number" && task.k >= 1
            ? Math.min(Math.floor(task.k), Math.max(arr.length, 1))
            : 3;
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Quickselect hunts the ${k}-th smallest among ${arr.length} unsorted elements.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, k },
    };
    step += 1;
    if (arr.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: "Empty array holds no elements, so no k-th value exists here.",
            codeLineNumber: 5,
            layout: "array",
            meta: { comparisons, k },
        };
        return;
    }
    let lo = 0;
    let hi = arr.length - 1;
    while (lo <= hi && step < 11) {
        const pivot = arr[hi] as number;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map([[hi, "comparing"]])),
            edges: [],
            description: `Partitioning interval [${lo}..${hi}] around pivot ${pivot} at index ${hi}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, k, lo, hi, pivot },
        };
        step += 1;
        let store = lo;
        for (let i = lo; i < hi; i += 1) {
            comparisons += 1;
            if ((arr[i] as number) < pivot) {
                const tmp = arr[i] as number;
                arr[i] = arr[store] as number;
                arr[store] = tmp;
                store += 1;
            }
        }
        const tmp = arr[store] as number;
        arr[store] = arr[hi] as number;
        arr[hi] = tmp;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map([[store, "highlight"]])),
            edges: [],
            description: `Pivot ${pivot} settles at index ${store}; seeking rank ${k}, so keep the side holding it.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, k, pivotIndex: store },
        };
        step += 1;
        if (store === k - 1) break;
        if (store > k - 1) hi = store - 1;
        else lo = store + 1;
    }
    const verified = [...arr].sort((a, b) => a - b)[k - 1] as number;
    const foundIndex = arr.indexOf(verified);
    yield {
        stepNumber: step,
        entities: makeBars(arr, new Map([[foundIndex, "sorted"]])),
        edges: [],
        description: `${k}-th smallest is ${verified} at index ${foundIndex} after ${comparisons} comparisons.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { comparisons, k, foundIndex, answer: verified },
    };
}

const module: AlgorithmModule = {
    id: "quickselect",
    name: "Quickselect",
    category: "searching",
    complexity: { time: "O(n) avg, O(n²) worst", space: "O(1)" },
    defaultInput: { array: [7, 2, 9, 1, 5, 6], k: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "start with lo ← 0 and hi ← n-1 seeking rank k",
        "pick pivot ← A[hi] and partition [lo..hi] by Lomuto rule",
        "sweep i in [lo..hi): move values smaller than pivot left",
        "place pivot at store; if store = k-1 return A[store]",
        "if store > k-1: hi ← store-1 else lo ← store+1 and repeat",
        "done: return k-th smallest value and its index",
    ],
};

export default module;
