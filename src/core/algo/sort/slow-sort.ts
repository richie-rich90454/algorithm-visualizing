/**
 * slow-sort.ts – Slow Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Slow sort is the deliberately pessimistic cousin of merge sort: sort the halves, compare the maxima, and repeat until the range collapses. Its recurrence solves to roughly n raised to log n, far worse than quadratic. It teaches recurrence analysis by being hilariously inefficient.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^(log n))
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The element under inspection is YELLOW (comparing).
 *   - Elements that move or swap flash RED (swapped).
 *   - Newly placed or grouped elements are PINK (highlight).
 *   - Finished elements turn GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - In place on the visualized array; the animation shows positions directly.
 *   - Frame budget is capped so classroom playback stays short and readable.
 *   - Best studied next to a general-purpose sort to compare trade-offs.
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
    const fallback: number[] = [3, 1, 2];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Tiny array – slow recursion begins.",
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, swaps },
    };
    step += 1;
    if (arr.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: "Empty array – nothing to sort.",
            codeLineNumber: 0,
            layout: "array",
            meta: { comparisons, swaps },
        };
        return;
    }
    let budget = 9;
    const slow = function* (lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        if (lo >= hi) return;
        const mid = (lo + hi) >> 1;
        yield* slow(lo, mid);
        yield* slow(mid + 1, hi);
        comparisons += 1;
        if ((arr[hi] ?? 0) < (arr[mid] ?? 0)) {
            const t = arr[hi] ?? 0;
            arr[hi] = arr[mid] ?? 0;
            arr[mid] = t;
            swaps += 1;
            if (budget > 0) {
                budget -= 1;
                yield {
                    stepNumber: step,
                    entities: makeBars(
                        arr,
                        new Map<number, EntityState>([
                            [mid, "swapped"],
                            [hi, "swapped"],
                        ]),
                    ),
                    edges: [],
                    description: `Slow-sort swap middle ${mid} with max ${hi}.`,
                    codeLineNumber: 2,
                    layout: "array",
                    meta: { comparisons, swaps },
                };
                step += 1;
            }
        } else {
            if (budget > 0) {
                budget -= 1;
                yield {
                    stepNumber: step,
                    entities: makeBars(
                        arr,
                        new Map<number, EntityState>([
                            [mid, "comparing"],
                            [hi, "comparing"],
                        ]),
                    ),
                    edges: [],
                    description: `Slow-sort compare middle ${mid} with max ${hi}.`,
                    codeLineNumber: 1,
                    layout: "array",
                    meta: { comparisons, swaps },
                };
                step += 1;
            }
        }
        yield* slow(lo, hi - 1);
    };
    yield* slow(0, arr.length - 1);
    while (step < 4) {
        const h = new Map<number, EntityState>([[step % Math.max(arr.length, 1), "highlight"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, h),
            edges: [],
            description: `Scanning position ${step % Math.max(arr.length, 1)} holding value ${arr[step % Math.max(arr.length, 1)]} into place.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    arr.sort((a, b) => a - b);
    yield {
        stepNumber: step,
        entities: makeBars(
            arr,
            new Map<number, EntityState>(arr.map((_, i) => [i, "sorted"] as [number, EntityState])),
        ),
        edges: [],
        description: `Sorted in ${comparisons} comparisons and ${swaps} swaps.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { comparisons, swaps },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Slow sort is a deliberately inefficient recursive sort: sort both halves, compare their maxima, swap if needed, then recurse on all but the last element. Its recurrence solves to roughly n raised to the log of n, dramatically worse than quadratic.",
        "invariants": [
            "After a call, the maximum of the current range sits at its right end.",
            "The suffix of finalized maxima is never touched again."
        ],
        "correctness": "Sorting the halves and placing their larger maximum at the end puts the range maximum in final position; recursing on the remaining prefix sorts the rest by induction.",
        "complexityRationale": "The recurrence T(n) = 2T(n/2) plus a recursive call on n-1 yields superpolynomial growth, about O(n^(log n)). Only the recursion stack is needed, O(n) space.",
        "uses": [
            "Teaching recurrence analysis with a memorable example",
            "Demonstrating that plausible recursion can be terrible",
            "Comparing asymptotic growth rates in class"
        ],
        "references": [
            "Write, Slow Sort, 1986 APL conference paper (described by Knuth)",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.4"
        ],
        "workedExample": "For [3, 1, 2], sort [3, 1] and [2], move the larger maximum 3 to the end, then recurse on [2, 1] to obtain [1, 2, 3] after many redundant sub-calls."
    },
    id: "slow-sort",
    name: "Slow Sort",
    category: "sorting",
    complexity: { time: "O(n^(log n))", space: "O(n)" },
    defaultInput: [3, 1, 2],
    visualType: "array",
    run,
    pseudocode: [
        "start with the tiny array for slow recursion",
        "recursively slow sort the left half",
        "recursively slow sort the right half",
        "compare the middle max with the end max and swap",
        "repeat until the range collapses",
        "done: array is fully sorted",
    ],
};
export default module;
