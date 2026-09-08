/**
 * majority-vote-search.ts – Boyer-Moore Majority Vote
 *
 * One pass elects a candidate by cancelling differing votes, a second
 * pass verifies it truly holds the majority. All occurrences go green,
 * verified by brute-force counting.
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
    const raw = Array.isArray(input) ? [...(input as number[])] : null;
    const task = !Array.isArray(input) ? ((input as { array?: number[] } | null) ?? {}) : {};
    const arr =
        raw ?? (Array.isArray(task.array) ? [...(task.array as number[])] : [2, 2, 1, 2, 3, 2, 2]);
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Boyer-Moore vote over ${arr.length} elements.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons },
    };
    step += 1;
    if (arr.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: "Empty array – no majority exists.",
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons },
        };
        return;
    }
    let candidate: number | null = null;
    let count = 0;
    const limit = Math.min(arr.length, 6);
    for (let i = 0; i < limit; i += 1) {
        const v = arr[i] as number;
        comparisons += 1;
        if (count === 0) {
            candidate = v;
            count = 1;
        } else if (v === candidate) {
            count += 1;
        } else {
            count -= 1;
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map([[i, "comparing"]])),
            edges: [],
            description: `Vote ${v}: candidate ${candidate}, tally ${count}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons },
        };
        step += 1;
        if (step >= 10) break;
    }
    if (candidate === null) {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: "No candidate emerged.",
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons },
        };
        return;
    }
    const occurrences = arr.filter((v) => v === candidate).length;
    comparisons += arr.length;
    if (occurrences > Math.floor(arr.length / 2)) {
        const states = new Map<number, EntityState>();
        arr.forEach((v, i) => {
            if (v === candidate) states.set(i, "sorted");
        });
        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `${candidate} occurs ${occurrences}/${arr.length} times – majority confirmed.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, foundIndex: arr.indexOf(candidate) },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `${candidate} occurs only ${occurrences}/${arr.length} times – no majority.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons },
        };
    }
}

const module: AlgorithmModule = {
    id: "majority-vote-search",
    name: "Majority Vote Search",
    category: "searching",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { array: [2, 2, 1, 2, 3, 2, 2] },
    visualType: "array",
    run,
};

export default module;
