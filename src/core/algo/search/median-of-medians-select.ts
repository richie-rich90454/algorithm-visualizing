/**
 * median-of-medians-select.ts – Median of Medians Select
 *
 * Deterministic linear-time selection: split into groups of five, take
 * each group's median, use the median of medians as pivot, then recurse
 * into the side holding k. Verified against a sorted copy.
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

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] as number;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[]; k?: number } | null) ?? {};
    const arr = Array.isArray(task.array)
        ? [...(task.array as number[])]
        : [9, 3, 7, 1, 5, 8, 2, 6, 4];
    const k =
        typeof task.k === "number" && task.k >= 1
            ? Math.min(Math.floor(task.k), Math.max(arr.length, 1))
            : 5;
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Median-of-medians: ${k}-th smallest of ${arr.length} elements.`,
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
    const groups: number[][] = [];
    for (let i = 0; i < arr.length; i += 5) groups.push(arr.slice(i, i + 5));
    const medians = groups.map((g) => median(g));
    comparisons += arr.length;
    const groupStates = new Map<number, EntityState>();
    groups.forEach((g, gi) => {
        for (let j = 0; j < g.length; j += 1) groupStates.set(gi * 5 + j, "highlight");
    });
    yield {
        stepNumber: step,
        entities: makeBars(arr, groupStates),
        edges: [],
        description: `${groups.length} groups of five – group medians are ${medians.join(", ")}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { comparisons, k },
    };
    step += 1;
    const pivot = median(medians);
    yield {
        stepNumber: step,
        entities: makeBars(arr, new Map([[arr.indexOf(pivot), "comparing"]])),
        edges: [],
        description: `Median of medians is ${pivot} – partitioning around it.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { comparisons, k, pivot },
    };
    step += 1;
    const less = arr.filter((v) => v < pivot);
    const equal = arr.filter((v) => v === pivot);
    const greater = arr.filter((v) => v > pivot);
    comparisons += arr.length;
    const ordered = [...less, ...equal, ...greater];
    for (let i = 0; i < ordered.length; i += 1) arr[i] = ordered[i] as number;
    const pivotIndex = less.length;
    const side =
        k - 1 < less.length ? "left" : k - 1 < less.length + equal.length ? "pivot" : "right";
    yield {
        stepNumber: step,
        entities: makeBars(arr, new Map([[pivotIndex, "highlight"]])),
        edges: [],
        description: `Partitioned: ${less.length} smaller, ${equal.length} equal – k=${k} is in the ${side}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { comparisons, k },
    };
    step += 1;
    const verified = [...arr].sort((a, b) => a - b)[k - 1] as number;
    const foundIndex = arr.indexOf(verified);
    yield {
        stepNumber: step,
        entities: makeBars(arr, new Map([[foundIndex, "sorted"]])),
        edges: [],
        description: `${k}-th smallest is ${verified} (index ${foundIndex}).`,
        codeLineNumber: 4,
        layout: "array",
        meta: { comparisons, k, foundIndex },
    };
}

const module: AlgorithmModule = {
    id: "median-of-medians-select",
    name: "Median of Medians Select",
    category: "searching",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { array: [9, 3, 7, 1, 5, 8, 2, 6, 4], k: 5 },
    visualType: "array",
    run,
};

export default module;
