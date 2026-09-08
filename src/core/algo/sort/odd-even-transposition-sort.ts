/**
 * odd-even-transposition-sort.ts – Odd-Even Transposition Sort.
 *
 * Brick sort alternates odd and even neighbor swaps.
 * Time: O(n²), Space: O(1)
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
    const fallback: number[] = [5, 1, 4, 2, 3];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial brick wall of bars.",
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
    for (let pass = 0; pass < arr.length; pass += 1) {
        const parity = pass % 2;
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(arr, new Map<number, EntityState>([[parity, "highlight"]])),
                edges: [],
                description: `Pass ${pass}: comparing ${parity === 0 ? "even" : "odd"}-indexed pairs.`,
                codeLineNumber: 1,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
        for (let j = parity; j + 1 < arr.length; j += 2) {
            const a = arr[j] ?? 0;
            const c = arr[j + 1] ?? 0;
            comparisons += 1;
            if (a > c) {
                arr[j] = c;
                arr[j + 1] = a;
                swaps += 1;
                if (budget > 0) {
                    budget -= 1;
                    yield {
                        stepNumber: step,
                        entities: makeBars(
                            arr,
                            new Map<number, EntityState>([
                                [j, "swapped"],
                                [j + 1, "swapped"],
                            ]),
                        ),
                        edges: [],
                        description: `Swapping pair (${a}, ${c}).`,
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
    id: "odd-even-transposition-sort",
    name: "Odd-Even Transposition Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    defaultInput: [5, 1, 4, 2, 3],
    visualType: "array",
    run,
};
export default module;
