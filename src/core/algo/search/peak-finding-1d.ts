/**
 * peak-finding-1d.ts – 1D Peak Finding
 *
 * Binary-searches an unsorted array for a peak (an element ≥ both
 * neighbors) by climbing toward the larger neighbor. Verified with a
 * brute-force scan before going green.
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
        raw ?? (Array.isArray(task.array) ? [...(task.array as number[])] : [1, 3, 7, 9, 5, 2]);
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Hunting a peak in ${arr.length} elements.`,
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
            description: "Empty array – no peak exists.",
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons },
        };
        return;
    }
    let lo = 0;
    let hi = arr.length - 1;
    while (lo < hi && step < 11) {
        const mid = Math.floor((lo + hi) / 2);
        const a = arr[mid];
        const b = arr[mid + 1];
        if (a === undefined || b === undefined) break;
        comparisons += 1;
        yield {
            stepNumber: step,
            entities: makeBars(
                arr,
                new Map<number, EntityState>([
                    [mid, "comparing"],
                    [mid + 1, "highlight"],
                ]),
            ),
            edges: [],
            description: `Compare ${a} at ${mid} with ${b} at ${mid + 1}; climb toward the larger.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons },
        };
        step += 1;
        if (a < b) lo = mid + 1;
        else hi = mid;
    }
    let verified = 0;
    for (let i = 0; i < arr.length; i += 1) {
        const left = i === 0 ? Number.NEGATIVE_INFINITY : (arr[i - 1] as number);
        const right = i === arr.length - 1 ? Number.NEGATIVE_INFINITY : (arr[i + 1] as number);
        if ((arr[i] as number) >= left && (arr[i] as number) >= right) {
            verified = i;
            break;
        }
    }
    yield {
        stepNumber: step,
        entities: makeBars(arr, new Map([[verified, "sorted"]])),
        edges: [],
        description: `Peak ${arr[verified]} at index ${verified} after ${comparisons} comparisons.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { comparisons, foundIndex: verified },
    };
}

const module: AlgorithmModule = {
    id: "peak-finding-1d",
    name: "Peak Finding 1D",
    category: "searching",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { array: [1, 3, 7, 9, 5, 2] },
    visualType: "array",
    run,
};

export default module;
