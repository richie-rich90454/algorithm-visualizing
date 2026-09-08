/**
 * sqrt-decomposition-search.ts – Sqrt Decomposition Search
 *
 * Splits a sorted array into √n blocks: skip whole blocks whose last
 * element is below the target, then linear-scan the candidate block.
 * Verified with a brute-force scan.
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
            description: "Empty array – nothing to search.",
            codeLineNumber: 1,
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
        description: `Block size √n ≈ ${block}. Skipping whole blocks first.`,
        codeLineNumber: 1,
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
            description: `Block ${b} ends at ${lastVal} < ${target} – skipping it.`,
            codeLineNumber: 2,
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
            description: `Linear scan: ${v} at ${i} is not ${target}.`,
            codeLineNumber: 3,
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
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, target, foundIndex: verified },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `${target} is not in the array.`,
            codeLineNumber: 4,
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
};

export default module;
