/**
 * sublist-search.ts – Sublist Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Tests whether a pattern appears as a contiguous sublist of a longer list.
 * It slides a window along the list one start position at a time, comparing
 * element by element inside the window and abandoning the start at the first
 * mismatch. When every pattern element matches in a row, the start index is
 * the answer; exhausting all starts proves the pattern absent.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n·m) worst – every start may compare against the full pattern
 *   Space: O(1) auxiliary – only the start and match counters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Matched prefix cells are PINK (highlight), the failing cell YELLOW.
 *   - The confirmed occurrence turns GREEN (sorted) across its full width.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Works on any list, sorted or not – the naive string-matching analog.
 *   - KMP and Boyer-Moore build on this by skipping hopeless starts.
 *   - The list is rendered as an array; metadata.index marks each node.
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
            description: "Empty list or pattern holds nothing to match.",
            codeLineNumber: 5,
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
            description: `Start ${start}: matched ${matched}/${pattern.length} elements before failing, sliding right.`,
            codeLineNumber: 3,
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
            description: `Pattern [${pattern.join(",")}] found at index ${verified} after ${comparisons} comparisons.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { comparisons, foundIndex: verified },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(list),
            edges: [],
            description: `Pattern [${pattern.join(",")}] is not a sublist after ${comparisons} comparisons.`,
            codeLineNumber: 5,
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
    pseudocode: [
        "start with start ← 0 at the head of the list",
        "for each start: compare pattern[k] with list[start+k] in order",
        "if all m pattern elements match: return start as the match",
        "on the first mismatch: abandon this start and slide start ← start+1",
        "repeat until start+m exceeds the list length",
        "done: return match index or report pattern absent",
    ],
};

export default module;
