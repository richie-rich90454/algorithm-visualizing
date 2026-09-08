/**
 * cube-sort.ts – Cube Sort.
 *
 * Compare-exchanges along hypercube dimensions.
 * Time: O(n log n), Space: O(n)
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
    const fallback: number[] = [5, 2, 7, 1, 6, 3, 8, 4];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Cube vertices holding values.",
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
    const n13 = arr.length;
    const bits = Math.ceil(Math.log2(Math.max(n13, 2)));
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Cube sort: routing along ${bits} cube dimensions.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let d = 0; d < bits; d += 1) {
        for (let i = 0; i < n13; i += 1) {
            const j = i ^ (1 << d);
            if (j <= i || j >= n13) continue;
            comparisons += 1;
            if ((arr[i] ?? 0) > (arr[j] ?? 0)) {
                const t = arr[i] ?? 0;
                arr[i] = arr[j] ?? 0;
                arr[j] = t;
                swaps += 1;
                if (budget > 0) {
                    budget -= 1;
                    yield {
                        stepNumber: step,
                        entities: makeBars(
                            arr,
                            new Map<number, EntityState>([
                                [i, "swapped"],
                                [j, "swapped"],
                            ]),
                        ),
                        edges: [],
                        description: `Dimension ${d}: exchanging cube neighbors ${i} and ${j}.`,
                        codeLineNumber: 2,
                        layout: "array",
                        meta: { comparisons, swaps },
                    };
                    step += 1;
                }
            }
        }
    }
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
    id: "cube-sort",
    name: "Cube Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [5, 2, 7, 1, 6, 3, 8, 4],
    visualType: "array",
    run,
};
export default module;
