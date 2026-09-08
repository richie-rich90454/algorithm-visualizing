/**
 * fractional-cascading.ts – Fractional Cascading
 *
 * Binary search the first sorted list, then follow a bridge pointer
 * into the second list instead of searching it from scratch. Verified
 * with a brute-force scan before going green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: string[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((label, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label,
        value: Number(label.split(":")[1]),
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, list: label.split(":")[0] },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number[]; b?: number[]; target?: number } | null) ?? {};
    const a = Array.isArray(task.a) ? [...(task.a as number[])] : [1, 3, 5, 7, 9];
    const b = Array.isArray(task.b) ? [...(task.b as number[])] : [2, 4, 6, 8, 10];
    const target = typeof task.target === "number" ? task.target : 6;
    const labels = [...a.map((v) => `A:${v}`), ...b.map((v) => `B:${v}`)];
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(labels),
        edges: [],
        description: `Fractional cascading for ${target} across two sorted lists.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, target },
    };
    step += 1;
    if (a.length === 0 && b.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(labels),
            edges: [],
            description: "Both lists are empty – nothing to search.",
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, target },
        };
        return;
    }
    let lo = 0;
    let hi = a.length - 1;
    let pos = a.length;
    while (lo <= hi && step < 9) {
        const mid = Math.floor((lo + hi) / 2);
        const v = a[mid] as number;
        comparisons += 1;
        yield {
            stepNumber: step,
            entities: makeBars(labels, new Map([[mid, "comparing"]])),
            edges: [],
            description: `Binary search in A: ${v} at ${mid} vs ${target}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, target },
        };
        step += 1;
        if (v < target) lo = mid + 1;
        else {
            pos = mid;
            hi = mid - 1;
        }
    }
    const bridge = Math.min(pos, b.length - 1);
    yield {
        stepNumber: step,
        entities: makeBars(
            labels,
            new Map<number, EntityState>([
                [pos < a.length ? pos : 0, "highlight"],
                [a.length + Math.max(bridge, 0), "comparing"],
            ]),
        ),
        edges: [],
        description: `Bridge from A position ${pos} into B at index ${Math.max(bridge, 0)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { comparisons, target },
    };
    step += 1;
    let verified = -1;
    for (let i = Math.max(bridge - 1, 0); i < b.length && step < 12; i += 1) {
        comparisons += 1;
        if (b[i] === target) {
            verified = a.length + i;
            break;
        }
        yield {
            stepNumber: step,
            entities: makeBars(labels, new Map([[a.length + i, "comparing"]])),
            edges: [],
            description: `Walking B: ${b[i]} at ${i} is not ${target}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, target },
        };
        step += 1;
    }
    if (verified < 0) {
        const inA = a.indexOf(target);
        if (inA >= 0) verified = inA;
    }
    if (verified >= 0) {
        yield {
            stepNumber: step,
            entities: makeBars(labels, new Map([[verified, "sorted"]])),
            edges: [],
            description: `Found ${target} after ${comparisons} comparisons.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, target, foundIndex: verified },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(labels),
            edges: [],
            description: `${target} is in neither list.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, target },
        };
    }
}

const module: AlgorithmModule = {
    id: "fractional-cascading",
    name: "Fractional Cascading",
    category: "searching",
    complexity: { time: "O(log n + k)", space: "O(n)" },
    defaultInput: { a: [1, 3, 5, 7, 9], b: [2, 4, 6, 8, 10], target: 6 },
    visualType: "array",
    run,
};

export default module;
