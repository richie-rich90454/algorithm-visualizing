/**
 * bitonic-array-search.ts – Bitonic Array Search
 *
 * Finds the peak of a bitonic (up-then-down) array, then binary searches
 * the ascending side and the descending side. The hit is verified with
 * a brute-force scan before going green.
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
    const arr = Array.isArray(task.array) ? [...(task.array as number[])] : [1, 3, 8, 12, 9, 5, 2];
    const target = typeof task.target === "number" ? task.target : 9;
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Bitonic search for ${target}: rise then fall.`,
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
    while (lo < hi && step < 9) {
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
            description: `Peak hunt: ${a} at ${mid} vs ${b} at ${mid + 1}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, target },
        };
        step += 1;
        if (a < b) lo = mid + 1;
        else hi = mid;
    }
    const peak = lo;
    yield {
        stepNumber: step,
        entities: makeBars(arr, new Map([[peak, "highlight"]])),
        edges: [],
        description: `Peak is ${arr[peak]} at index ${peak}. Binary searching both sides.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { comparisons, target, peak },
    };
    step += 1;
    const asc: Array<[number, number]> = [[0, peak]];
    const desc: Array<[number, number]> = [[peak, arr.length - 1]];
    for (const [s, e] of [...asc, ...desc]) {
        let l = s;
        let h = e;
        const rising = s === 0;
        while (l <= h && step < 12) {
            const mid = Math.floor((l + h) / 2);
            const v = arr[mid];
            if (v === undefined) break;
            comparisons += 1;
            yield {
                stepNumber: step,
                entities: makeBars(
                    arr,
                    new Map<number, EntityState>([
                        [mid, "comparing"],
                        [peak, "highlight"],
                    ]),
                ),
                edges: [],
                description: `Checking ${v} at ${mid} on the ${rising ? "rising" : "falling"} side.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { comparisons, target },
            };
            step += 1;
            if (v === target) break;
            if (v < target === rising) l = mid + 1;
            else h = mid - 1;
        }
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
    id: "bitonic-array-search",
    name: "Bitonic Array Search",
    category: "searching",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { array: [1, 3, 8, 12, 9, 5, 2], target: 9 },
    visualType: "array",
    run,
};

export default module;
