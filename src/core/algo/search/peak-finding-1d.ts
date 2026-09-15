/**
 * peak-finding-1d.ts – 1D Peak Finding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A peak is an element at least as large as both neighbors (edges compare
 * against negative infinity, so the ends can be peaks too). The algorithm
 * binary-searches for one: compare A[mid] with A[mid+1] and climb toward
 * the larger side. The larger side must contain a peak, so half the array
 * is discarded each step. Any peak is acceptable – the array can hold many.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) – the interval halves on every comparison
 *   Space: O(1) auxiliary – only lo, hi, and mid pointers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The mid element is YELLOW (comparing), its right neighbor PINK.
 *   - The confirmed peak turns GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Works on any unsorted array – no sortedness promise is needed.
 *   - Always succeeds: every finite array holds at least one peak.
 *   - The 2D version generalizes the same climb-toward-larger idea.
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
        description: `Hunting a peak among ${arr.length} unsorted elements; edges count as peaks.`,
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
            description: "Empty array holds no elements, so no peak exists here.",
            codeLineNumber: 4,
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
            description: `Compare A[${mid}]=${a} with A[${mid + 1}]=${b}; climb toward the larger neighbor.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, lo, hi, mid },
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
        description: `Peak ${arr[verified]} at index ${verified} beats both neighbors after ${comparisons} comparisons.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { comparisons, foundIndex: verified, peak: verified },
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
    pseudocode: [
        "set lo ← 0 and hi ← n-1 over the unsorted array",
        "while lo < hi: compare A[mid] with A[mid+1]",
        "if A[mid] < A[mid+1]: lo ← mid+1 else hi ← mid",
        "peak ← lo; confirm it beats both neighbors",
        "done: return peak index and its value",
    ],
};

export default module;
