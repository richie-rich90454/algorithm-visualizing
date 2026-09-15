/**
 * sqrt-decomposition-search.ts – Sqrt Decomposition Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Searches a *sorted* array by splitting it into blocks of about √n. It
 * first compares the target against each block's last element, skipping
 * whole blocks that end too low, then linear-scans inside the first block
 * that could hold the target. Balancing √n blocks against √n elements per
 * block keeps both phases at O(√n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(√n) – at most √n block skips plus √n in-block checks
 *   Space: O(1) auxiliary – only the block size and scan index
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Skipped and candidate blocks are PINK (highlight).
 *   - Each in-block probe is YELLOW (comparing).
 *   - A hit turns GREEN (sorted); a miss ends all IDLE.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a sorted array; the block size ⌊√n⌋ is provably optimal.
 *   - The simpler cousin of jump search, with explicit block structure.
 *   - Shows how preprocessing an array into blocks buys sublinear search.
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
    const arr = Array.isArray(task.array)
        ? [...(task.array as number[])]
        : [2, 4, 6, 8, 10, 12, 14, 16, 18];
    const target = typeof task.target === "number" ? task.target : 14;
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Sqrt-decomposition search for ${target} in ${arr.length} sorted elements.`,
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
            description: "Empty array holds nothing, so there is nothing to search.",
            codeLineNumber: 5,
            layout: "array",
            meta: { comparisons, target },
        };
        return;
    }
    const block = Math.max(1, Math.floor(Math.sqrt(arr.length)));
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Block size is ⌊√${arr.length}⌋ = ${block}; skipping whole blocks of ${target} first.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, target, block },
    };
    step += 1;
    let candidate = 0;
    for (let b = 0; b * block < arr.length && step < 9; b += 1) {
        const last = Math.min((b + 1) * block - 1, arr.length - 1);
        const lastVal = arr[last] as number;
        comparisons += 1;
        if (lastVal >= target) {
            candidate = b;
            const states = new Map<number, EntityState>();
            for (let i = b * block; i <= last; i += 1) states.set(i, "highlight");
            yield {
                stepNumber: step,
                entities: makeBars(arr, states),
                edges: [],
                description: `Block ${b} ends at ${lastVal} ≥ ${target} – scanning inside it.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, target },
            };
            step += 1;
            break;
        }
        candidate = b + 1;
        const states = new Map<number, EntityState>();
        for (let i = b * block; i <= last; i += 1) states.set(i, "highlight");
        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Block ${b} ends at ${lastVal} < ${target}, so discard the whole block.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, target },
        };
        step += 1;
    }
    const start = candidate * block;
    const end = Math.min(start + block - 1, arr.length - 1);
    for (let i = start; i <= end && step < 13; i += 1) {
        const v = arr[i] as number;
        comparisons += 1;
        if (v === target) break;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map([[i, "comparing"]])),
            edges: [],
            description: `Scanning block ${candidate} [${start}..${end}]: ${v} at index ${i} is not ${target}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, target },
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
            codeLineNumber: 5,
            layout: "array",
            meta: { comparisons, target, foundIndex: verified },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `${target} is absent after ${comparisons} block-plus-scan comparisons.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { comparisons, target },
        };
    }
}

const module: AlgorithmModule = {
    id: "sqrt-decomposition-search",
    name: "Sqrt Decomposition Search",
    category: "searching",
    complexity: { time: "O(√n)", space: "O(1)" },
    defaultInput: { array: [2, 4, 6, 8, 10, 12, 14, 16, 18], target: 14 },
    visualType: "array",
    run,
    pseudocode: [
        "start with block ← ⌊√n⌋ over the sorted array",
        "for each block: compare its last element with target",
        "if block end ≥ target: stop skipping, target is inside",
        "else discard the whole block and test the next one",
        "linear-scan the surviving block and compare each element",
        "done: return found index or report target absent",
    ],
};

export default module;
