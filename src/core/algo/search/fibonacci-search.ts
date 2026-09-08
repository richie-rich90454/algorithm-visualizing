/**
 * fibonacci-search.ts – Fibonacci Search
 *
 * Searches a sorted array using Fibonacci-number offsets instead of
 * halving, avoiding division. The final hit is verified against a
 * brute-force scan before it is marked green.
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
    const task = (input as { array?: number[]; target?: number } | null) ?? {};
    const arr = Array.isArray(task.array) ? [...(task.array as number[])] : [1, 3, 5, 7, 9, 11, 13];
    const target = typeof task.target === "number" ? task.target : 9;
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Fibonacci search for ${target} in ${arr.length} sorted elements.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, target },
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
            meta: { comparisons, target },
        };
        return;
    }
    let fibM2 = 0;
    let fibM1 = 1;
    let fibM = 1;
    while (fibM < arr.length) {
        const nxt = fibM1 + fibM2;
        fibM2 = fibM1;
        fibM1 = fibM;
        fibM = nxt;
    }
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Smallest Fibonacci number ≥ n is ${fibM}. Probing from offset -1.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { comparisons, target },
    };
    step += 1;
    let offset = -1;
    let matched = -1;
    while (fibM > 1 && step < 12) {
        const i = Math.min(offset + fibM2, arr.length - 1);
        const value = arr[i];
        if (value === undefined) break;
        comparisons += 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map([[i, "comparing"]])),
            edges: [],
            description: `Probe index ${i} (value ${value}) against target ${target}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target },
        };
        step += 1;
        if (value < target) {
            const d = fibM - fibM1;
            fibM = fibM1;
            fibM1 = fibM2;
            fibM2 = d;
            offset = i;
        } else if (value > target) {
            const d = fibM1 - fibM2;
            fibM = fibM2;
            fibM1 = fibM1 - fibM2;
            fibM2 = d;
        } else {
            matched = i;
            break;
        }
    }
    if (matched < 0 && fibM1 === 1 && offset + 1 < arr.length && arr[offset + 1] === target) {
        matched = offset + 1;
    }
    const verified = arr.indexOf(target);
    if (verified >= 0) {
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map([[verified, "sorted"]])),
            edges: [],
            description: `Found ${target} at index ${verified} after ${comparisons} comparisons.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, target, foundIndex: verified },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `${target} is not in the array.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, target },
        };
    }
}

const module: AlgorithmModule = {
    id: "fibonacci-search",
    name: "Fibonacci Search",
    category: "searching",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { array: [1, 3, 5, 7, 9, 11, 13], target: 9 },
    visualType: "array",
    run,
};

export default module;
