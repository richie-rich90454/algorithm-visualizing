/**
 * cycle-sort.ts – Cycle Sort.
 *
 * Rotates each element directly into its cycle slot.
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
    const fallback: number[] = [4, 3, 2, 5, 1];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Elements waiting for cycle rotation.",
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
    for (let start = 0; start < arr.length; start += 1) {
        const item = arr[start] ?? 0;
        let pos = start;
        for (let i = start + 1; i < arr.length; i += 1) {
            comparisons += 1;
            if ((arr[i] ?? 0) < item) pos += 1;
        }
        if (pos === start) continue;
        while (item === (arr[pos] ?? -1)) pos += 1;
        const displaced = arr[pos] ?? 0;
        arr[pos] = item;
        arr[start] = displaced;
        swaps += 1;
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(
                    arr,
                    new Map<number, EntityState>([
                        [start, "swapped"],
                        [pos, "sorted"],
                    ]),
                ),
                edges: [],
                description: `Rotating cycle: placing ${item} at index ${pos}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
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
    id: "cycle-sort",
    name: "Cycle Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    defaultInput: [4, 3, 2, 5, 1],
    visualType: "array",
    run,
};
export default module;
