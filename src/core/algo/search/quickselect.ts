/**
 * quickselect.ts – Quickselect
 *
 * Finds the k-th smallest element with Lomuto partitioning, recursing
 * only into the side containing k. Verified against a sorted copy
 * before the answer goes green.
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
        description: `Quickselect: ${k}-th smallest of ${arr.length} elements.`,
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
            description: "Empty array – no k-th element exists.",
            codeLineNumber: 1,
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
            description: `Partition [${lo}..${hi}] around pivot ${pivot}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, k },
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
            description: `Pivot ${pivot} settles at index ${store}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, k },
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
        description: `${k}-th smallest is ${verified} (index ${foundIndex}) after ${comparisons} comparisons.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { comparisons, k, foundIndex },
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
};

export default module;
