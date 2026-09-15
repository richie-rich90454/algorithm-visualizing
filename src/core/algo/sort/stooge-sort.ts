/**
 * stooge-sort.ts – Stooge Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Stooge sort swaps its ends if flipped, then recursively sorts the first two-thirds and the last two-thirds of the range. Its recurrence solves to about n to the 2.7, worse than bubble sort. Like slow sort, it is taught as a cautionary tale about plausible-looking recursion.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2.7)
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
    const fallback: number[] = [4, 1, 3, 2];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Tiny array – stooge recursion begins.",
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
    const stooge = function* (lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        if (lo >= hi) return;
        comparisons += 1;
        if ((arr[lo] ?? 0) > (arr[hi] ?? 0)) {
            const t = arr[lo] ?? 0;
            arr[lo] = arr[hi] ?? 0;
            arr[hi] = t;
            swaps += 1;
            if (budget > 0) {
                budget -= 1;
                yield {
                    stepNumber: step,
                    entities: makeBars(
                        arr,
                        new Map<number, EntityState>([
                            [lo, "swapped"],
                            [hi, "swapped"],
                        ]),
                    ),
                    edges: [],
                    description: `Stooge swap ends ${lo} and ${hi}.`,
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
                            [lo, "comparing"],
                            [hi, "comparing"],
                        ]),
                    ),
                    edges: [],
                    description: `Stooge compare ends ${lo} and ${hi}.`,
                    codeLineNumber: 1,
                    layout: "array",
                    meta: { comparisons, swaps },
                };
                step += 1;
            }
        }
        if (hi - lo + 1 > 2) {
            const t = Math.floor((hi - lo + 1) / 3);
            yield* stooge(lo, hi - t);
            yield* stooge(lo + t, hi);
            yield* stooge(lo, hi - t);
        }
    };
    yield* stooge(0, arr.length - 1);
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
    id: "stooge-sort",
    name: "Stooge Sort",
    category: "sorting",
    complexity: { time: "O(n^2.7)", space: "O(n)" },
    defaultInput: [4, 1, 3, 2],
    visualType: "array",
    run,
    pseudocode: [
        "start with the tiny array for stooge recursion",
        "if ends are flipped: swap A[lo] and A[hi]",
        "stooge sort the first two-thirds of the range",
        "stooge sort the last two-thirds of the range",
        "repeat until the range collapses",
        "done: array is fully sorted",
    ],
};
export default module;
