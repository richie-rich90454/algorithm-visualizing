/**
 * majority-vote-search.ts – Boyer-Moore Majority Vote
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Boyer-Moore vote finds a majority element (one appearing more than
 * n/2 times) in two passes. Pass one elects a candidate: keep a tally that
 * rises on matches and falls on mismatches, swapping in a new candidate
 * whenever the tally hits zero. Differing votes cancel out, so a true
 * majority must survive as the final candidate. Pass two counts its real
 * occurrences to confirm or reject it.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) – one electing pass plus one verifying pass
 *   Space: O(1) auxiliary – only candidate and tally
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The element casting the current vote is YELLOW (comparing).
 *   - Confirmed majority copies turn GREEN (sorted); rejection ends IDLE.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Needs no sorting and no hash map – the constant-space classic.
 *   - Verification is mandatory: the first pass can elect a false candidate.
 *   - Generalizes to k-way majorities with k-1 counters.
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
            description: "Empty array holds no votes, so no majority exists here.",
            codeLineNumber: 4,
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
            description: `Vote ${i + 1}: ${v} against candidate ${candidate} leaves tally ${count}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, candidate: candidate ?? "none", tally: count },
        };
        step += 1;
        if (step >= 10) break;
    }
    if (candidate === null) {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: "No candidate emerged from the vote.",
            codeLineNumber: 4,
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
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, foundIndex: arr.indexOf(candidate) },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `${candidate} occurs only ${occurrences}/${arr.length} times – no majority.`,
            codeLineNumber: 4,
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
    pseudocode: [
        "start with candidate ← none and tally ← 0 over the array",
        "for each vote: adopt it if tally = 0, else rise or fall the tally",
        "candidate survives elimination; count its real occurrences",
        "if count > n/2: confirm the candidate as the majority element",
        "done: return majority value or report that none exists",
    ],
};

export default module;
