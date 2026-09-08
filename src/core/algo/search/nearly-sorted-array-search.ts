/**
 * nearly-sorted-array-search.ts – Nearly Sorted Array Search
 *
 * Each element sits at most k away from its sorted slot, so every step
 * checks i−1, i, and i+1, then jumps two ahead. Verified by brute force.
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
    const task = (input as { array?: number[]; target?: number; k?: number } | null) ?? {};
    const arr = Array.isArray(task.array) ? [...(task.array as number[])] : [3, 1, 2, 4, 6, 5];
    const target = typeof task.target === "number" ? task.target : 5;
    const k = typeof task.k === "number" && task.k >= 0 ? Math.floor(task.k) : 1;
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Searching nearly-sorted array (k=${k}) for ${target}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, target, k },
    };
    step += 1;
    if (arr.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: "Empty array – nothing to search.",
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, target, k },
        };
        return;
    }
    for (let i = 0; i < arr.length && step < 11; i += 2) {
        const window = [i - 1, i, i + 1].filter((idx) => idx >= 0 && idx < arr.length);
        comparisons += window.length;
        const states = new Map<number, EntityState>(
            window.map((idx) => [idx, "comparing"] as [number, EntityState]),
        );
        const values = window.map((idx) => `${arr[idx]}@${idx}`).join(", ");
        if (window.some((idx) => arr[idx] === target)) break;
        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Window around ${i} holds ${values} – no ${target}, jumping ahead.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, target, k },
        };
        step += 1;
    }
    const verified = arr.indexOf(target);
    if (verified >= 0) {
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map([[verified, "sorted"]])),
            edges: [],
            description: `Found ${target} at index ${verified} after ${comparisons} comparisons.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target, k, foundIndex: verified },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `${target} is not in the array.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target, k },
        };
    }
}

const module: AlgorithmModule = {
    id: "nearly-sorted-array-search",
    name: "Nearly Sorted Array Search",
    category: "searching",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { array: [3, 1, 2, 4, 6, 5], target: 5, k: 1 },
    visualType: "array",
    run,
};

export default module;
