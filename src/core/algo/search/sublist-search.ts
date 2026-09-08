/**
 * sublist-search.ts – Sublist Search
 *
 * Slides a pattern window along a list (linked-list-as-array) and
 * compares element by element at each start. The verified match goes
 * green with its start index.
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
    const task = (input as { list?: number[]; pattern?: number[] } | null) ?? {};
    const list = Array.isArray(task.list) ? [...(task.list as number[])] : [1, 2, 3, 4, 5];
    const pattern = Array.isArray(task.pattern) ? [...(task.pattern as number[])] : [3, 4];
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(list),
        edges: [],
        description: `Hunting pattern [${pattern.join(",")}] inside a ${list.length}-node list.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons },
    };
    step += 1;
    if (list.length === 0 || pattern.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(list),
            edges: [],
            description: "Empty list or pattern – nothing to match.",
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons },
        };
        return;
    }
    for (let start = 0; start + pattern.length <= list.length && step < 11; start += 1) {
        let matched = 0;
        while (matched < pattern.length) {
            comparisons += 1;
            if (list[start + matched] !== pattern[matched]) break;
            matched += 1;
        }
        const states = new Map<number, EntityState>();
        for (let k = 0; k < pattern.length && start + k < list.length; k += 1) {
            states.set(start + k, k < matched ? "highlight" : "comparing");
        }
        if (matched === pattern.length) break;
        yield {
            stepNumber: step,
            entities: makeBars(list, states),
            edges: [],
            description: `Start ${start}: matched ${matched}/${pattern.length} before failing.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons },
        };
        step += 1;
    }
    let verified = -1;
    for (let start = 0; start + pattern.length <= list.length; start += 1) {
        if (pattern.every((v, k) => list[start + k] === v)) {
            verified = start;
            break;
        }
    }
    if (verified >= 0) {
        const states = new Map<number, EntityState>();
        for (let k = 0; k < pattern.length; k += 1) states.set(verified + k, "sorted");
        yield {
            stepNumber: step,
            entities: makeBars(list, states),
            edges: [],
            description: `Pattern found at index ${verified} after ${comparisons} comparisons.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, foundIndex: verified },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(list),
            edges: [],
            description: `Pattern [${pattern.join(",")}] is not a sublist.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons },
        };
    }
}

const module: AlgorithmModule = {
    id: "sublist-search",
    name: "Sublist Search",
    category: "searching",
    complexity: { time: "O(n × m)", space: "O(1)" },
    defaultInput: { list: [1, 2, 3, 4, 5], pattern: [3, 4] },
    visualType: "array",
    run,
};

export default module;
