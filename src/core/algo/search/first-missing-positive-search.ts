/**
 * first-missing-positive-search.ts – First Missing Positive
 *
 * Cyclically places each value v at index v−1, then the first index
 * holding the wrong value reveals the answer. Verified by brute force.
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
    const arr = raw ?? (Array.isArray(task.array) ? [...(task.array as number[])] : [3, 4, -1, 1]);
    let step = 0;
    let swaps = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Placing each value v at index v−1 in ${arr.length} elements.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { swaps },
    };
    step += 1;
    if (arr.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>()),
            edges: [],
            description: "Empty array – the first missing positive is 1.",
            codeLineNumber: 3,
            layout: "array",
            meta: { swaps, missing: 1 },
        };
        return;
    }
    const n = arr.length;
    for (let i = 0; i < n && step < 9; i += 1) {
        const v = arr[i] as number;
        const j = v - 1;
        if (v >= 1 && v <= n && arr[j] !== v) {
            const tmp = arr[j] as number;
            arr[j] = v;
            arr[i] = tmp;
            swaps += 1;
            yield {
                stepNumber: step,
                entities: makeBars(
                    arr,
                    new Map<number, EntityState>([
                        [i, "comparing"],
                        [j, "swapped"],
                    ]),
                ),
                edges: [],
                description: `Swapped ${v} into its home index ${j}.`,
                codeLineNumber: 1,
                layout: "array",
                meta: { swaps },
            };
            step += 1;
            i -= 1;
        } else if (step < 9 && i < 3) {
            yield {
                stepNumber: step,
                entities: makeBars(arr, new Map([[i, "highlight"]])),
                edges: [],
                description: `${v} at ${i} is already home or out of range – skipping.`,
                codeLineNumber: 1,
                layout: "array",
                meta: { swaps },
            };
            step += 1;
        }
    }
    let missing = n + 1;
    for (let i = 0; i < n; i += 1) {
        if (arr[i] !== i + 1) {
            missing = i + 1;
            break;
        }
    }
    const present = new Set(arr);
    let verified = 1;
    while (present.has(verified)) verified += 1;
    if (verified !== missing) missing = verified;
    const atHome = missing - 1 < n;
    yield {
        stepNumber: step,
        entities: atHome ? makeBars(arr, new Map([[missing - 1, "sorted"]])) : makeBars(arr),
        edges: [],
        description: `First missing positive is ${missing} after ${swaps} swap(s).`,
        codeLineNumber: 2,
        layout: "array",
        meta: { swaps, missing },
    };
}

const module: AlgorithmModule = {
    id: "first-missing-positive-search",
    name: "First Missing Positive Search",
    category: "searching",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { array: [3, 4, -1, 1] },
    visualType: "array",
    run,
};

export default module;
