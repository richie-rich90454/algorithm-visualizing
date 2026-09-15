/**
 * bitonic-array-search.ts – Bitonic Array Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A bitonic array rises to a single peak and then falls (for example
 * [1, 3, 8, 12, 9, 5, 2]). The algorithm works in two stages. First it
 * locates the peak with a binary hunt: compare A[mid] with A[mid+1] and
 * climb toward the larger neighbor. Then it binary-searches the ascending
 * left side normally and the descending right side with reversed
 * comparisons. Either side can hold the target, so both are tried.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) – peak hunt plus two binary searches
 *   Space: O(1) auxiliary – only lo, hi, and mid pointers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Peak-hunt probes are YELLOW (comparing) with the neighbor PINK.
 *   - The confirmed peak stays PINK (highlight) during side searches.
 *   - A hit turns GREEN (sorted); a miss ends all IDLE.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a bitonic array: strictly increasing then strictly decreasing.
 *   - Shows how one structural fact (one peak) unlocks binary search twice.
 *   - The descending side flips the comparison, a favorite exam twist.
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
        description: `Bitonic search for target ${target} in ${arr.length} elements that rise then fall.`,
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
            description: `Empty array holds nothing, so target ${target} is absent.`,
            codeLineNumber: 5,
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
            description: `Peak hunt: compare A[${mid}]=${a} with A[${mid + 1}]=${b}; climb toward the larger neighbor.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, target, mid },
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
        description: `Peak is ${arr[peak]} at index ${peak}; binary-searching rising and falling sides for ${target}.`,
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
                description: `Checking ${v} at index ${mid} on the ${rising ? "rising" : "falling"} side against target ${target}.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { comparisons, target, mid, peak },
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
            description: `Found target ${target} at index ${verified} after ${comparisons} comparisons.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { comparisons, target, foundIndex: verified, peak },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `Target ${target} is absent from both bitonic sides after ${comparisons} comparisons.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { comparisons, target, peak },
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
    pseudocode: [
        "start with lo ← 0 and hi ← n-1 over the bitonic array",
        "while lo < hi: compare A[mid] with A[mid+1] and climb higher",
        "peak ← lo; it is the maximum of the rise-then-fall array",
        "binary-search rising side [0..peak] and falling side [peak..n-1]",
        "if A[mid] = target on either side: return its index",
        "done: return found index or report target absent",
    ],
};

export default module;
