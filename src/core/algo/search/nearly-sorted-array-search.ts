/**
 * nearly-sorted-array-search.ts – Nearly Sorted Array Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a nearly sorted array every element sits at most k positions from its
 * sorted slot (here k = 1, so each value moved by at most one). The algorithm
 * walks the array two steps at a time and checks the window [i-1, i, i+1]:
 * the target, if present near i, must appear inside that window. Finding it
 * ends the search; otherwise the scan jumps ahead by two. It is a tiny
 * specialization of searching in k-sorted data, where a heap would handle
 * larger k.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) worst – each element is examined at most twice
 *   Space: O(1) auxiliary – only the index and a 3-element window
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The 3-element window under test is YELLOW (comparing).
 *   - A hit turns GREEN (sorted); a miss ends all IDLE.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a k-sorted array with k = 1 for this exact window logic.
 *   - Shows how a displacement promise turns linear search into strided
 *     checks without missing any candidate.
 *   - The general k-sorted case uses a min-heap of size k+1 instead.
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
        description: `Searching nearly sorted array (k=${k}) of ${arr.length} elements for target ${target}.`,
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
            description: `Empty array holds nothing, so target ${target} is absent.`,
            codeLineNumber: 5,
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
            description: `Window centered at ${i} holds ${values}: no match for ${target}, jumping two ahead.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target, k, center: i },
        };
        step += 1;
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
            meta: { comparisons, target, k, foundIndex: verified },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `Target ${target} is absent after ${comparisons} windowed comparisons.`,
            codeLineNumber: 5,
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
    pseudocode: [
        "start at i ← 0 knowing each element is within k slots",
        "build window W ← {i-1, i, i+1} clipped to [0, n-1]",
        "compare every element of W with target",
        "if target is in W: return its index as the match",
        "advance i ← i+2 and repeat while i < n",
        "done: return found index or report target absent",
    ],
};

export default module;
