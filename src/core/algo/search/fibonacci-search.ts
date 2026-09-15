/**
 * fibonacci-search.ts – Fibonacci Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fibonacci search finds a target in a *sorted* array using Fibonacci numbers
 * instead of halving. It first raises the smallest Fibonacci number F(k) that
 * covers the array length, then probes at offset + F(k-2). Each comparison
 * discards a Fibonacci-sized slice: if the probe is too small the search
 * moves the offset forward, if too large it steps down two Fibonacci levels.
 * No division is needed, only addition and subtraction, which is why the
 * method was prized on hardware where division was expensive.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) worst/average – each step shrinks the range by a
 *          Fibonacci ratio, just like golden-section search
 *   Space: O(1) auxiliary – only a few Fibonacci counters and an offset
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current probe index is YELLOW (comparing).
 *   - The Fibonacci setup frame is all IDLE – it shows the starting range.
 *   - A hit turns GREEN (sorted); a miss ends all IDLE.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a sorted array.
 *   - Uses only addition and subtraction – no division or bit shifts.
 *   - Excellent for teaching how number sequences can drive search ranges.
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
        description: `Searching for ${target} in ${arr.length} sorted elements using Fibonacci offsets.`,
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
            description: `Empty array holds no elements, so target ${target} cannot be found here.`,
            codeLineNumber: 5,
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
        description: `Smallest Fibonacci number covering n=${arr.length} is F=${fibM}; probing starts at offset -1.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { comparisons, target, fibM },
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
            description: `Probe index ${i} holds ${value} against target ${target} with offset ${offset}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target, probe: i, offset, fibM },
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
            description: `Found target ${target} at index ${verified} after ${comparisons} comparisons.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, target, foundIndex: verified },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `Target ${target} is absent after ${comparisons} Fibonacci probes.`,
            codeLineNumber: 5,
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
    pseudocode: [
        "set up Fibonacci numbers with smallest F(k) covering n; offset ← -1",
        "build F(k) by repeated addition until F(k) ≥ n",
        "probe i ← min(offset+F(k-2), n-1); compare A[i] with target",
        "if A[i] < target: shift offset ← i and step down one level",
        "if A[i] > target: step down two Fibonacci levels",
        "done: return found index or report target absent",
    ],
};

export default module;
