/**
 * rotated-array-search.ts – Search in Rotated Sorted Array
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A sorted array was rotated at an unknown pivot, so it now holds two sorted
 * runs back to back (for example [4, 5, 6, 7, 0, 1, 2]). The algorithm still
 * runs in logarithmic time: at each step it checks which half around the
 * middle is properly sorted, then asks whether the target can live inside
 * that sorted half. If yes it discards the other half, otherwise it discards
 * the sorted half. One half is always eliminated, so the interval shrinks
 * just like ordinary binary search.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) worst/average – one half is discarded per step
 *   Space: O(1) auxiliary – only lo, hi, and mid pointers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The middle probe is YELLOW (comparing).
 *   - The lo and hi interval ends are PINK (highlight).
 *   - A hit turns GREEN (sorted); a miss ends all IDLE.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a rotated sorted array with distinct values for the clean
 *     one-pass logic taught here.
 *   - The classic interview follow-up to binary search: it proves the
 *     "which half is sorted" insight.
 *   - Teaches why sortedness of just one half is enough to keep halving.
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
        description: `Searching rotated sorted array of ${arr.length} elements for target ${target}.`,
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
            description: `Interval [${lo}..${hi}]: A[mid=${mid}]=${midVal}; left edge ${loVal}, right edge ${hiVal}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, target, lo, hi, mid },
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
            description: `Found target ${target} at index ${verified} after ${comparisons} comparisons.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target, foundIndex: verified },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `Target ${target} is absent after ${comparisons} rotated probes.`,
            codeLineNumber: 5,
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
    pseudocode: [
        "set lo ← 0 and hi ← n-1 over the rotated sorted array",
        "while lo ≤ hi: probe mid ← ⌊(lo+hi)/2⌋ and compare A[mid]",
        "if A[mid] = target: return mid as the match",
        "if left half A[lo..mid] is sorted: keep the half holding target",
        "else right half is sorted: keep the half holding target",
        "done: return found index or report target absent",
    ],
};

export default module;
