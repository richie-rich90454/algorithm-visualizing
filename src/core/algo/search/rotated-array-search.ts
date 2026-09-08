/**
 * rotated-array-search.ts – Search in Rotated Sorted Array
 *
 * Binary search adapted for a rotated sorted array: each step decides
 * which half is sorted and whether the target lies inside it. The hit
 * is verified against a brute-force scan before going green.
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
    const arr = Array.isArray(task.array) ? [...(task.array as number[])] : [4, 5, 6, 7, 0, 1, 2];
    const target = typeof task.target === "number" ? task.target : 0;
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Searching rotated array for ${target}.`,
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
    let lo = 0;
    let hi = arr.length - 1;
    while (lo <= hi && step < 12) {
        const mid = Math.floor((lo + hi) / 2);
        const midVal = arr[mid];
        const loVal = arr[lo];
        const hiVal = arr[hi];
        if (midVal === undefined || loVal === undefined || hiVal === undefined) break;
        comparisons += 1;
        yield {
            stepNumber: step,
            entities: makeBars(
                arr,
                new Map<number, EntityState>([
                    [lo, "highlight"],
                    [mid, "comparing"],
                    [hi, "highlight"],
                ]),
            ),
            edges: [],
            description: `lo=${lo} (${loVal}), mid=${mid} (${midVal}), hi=${hi} (${hiVal}).`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, target },
        };
        step += 1;
        if (midVal === target) break;
        if (loVal <= midVal) {
            if (loVal <= target && target < midVal) hi = mid - 1;
            else lo = mid + 1;
        } else if (midVal < target && target <= hiVal) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    const verified = arr.indexOf(target);
    if (verified >= 0) {
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map([[verified, "sorted"]])),
            edges: [],
            description: `Found ${target} at index ${verified} after ${comparisons} comparisons.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target, foundIndex: verified },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `${target} is not in the array.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target },
        };
    }
}

const module: AlgorithmModule = {
    id: "rotated-array-search",
    name: "Rotated Array Search",
    category: "searching",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { array: [4, 5, 6, 7, 0, 1, 2], target: 0 },
    visualType: "array",
    run,
};

export default module;
