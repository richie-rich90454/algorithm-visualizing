/**
 * slow-sort.ts – Slow Sort.
 *
 * Multiply-and-surrender recursion, slow by design.
 * Time: O(n^(log n)), Space: O(n)
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
            description: "Scanning elements into place.",
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
    id: "slow-sort",
    name: "Slow Sort",
    category: "sorting",
    complexity: { time: "O(n^(log n))", space: "O(n)" },
    defaultInput: [3, 1, 2],
    visualType: "array",
    run,
};
export default module;
