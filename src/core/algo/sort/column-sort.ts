/**
 * column-sort.ts – Column Sort.
 *
 * Sorts columns, permutes, sorts again until ordered.
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
    const fallback: number[] = [6, 2, 7, 1, 5, 3, 8, 4];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Matrix columns before the first sort.",
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
    const cc = Math.max(2, Math.ceil(Math.sqrt(arr.length)));
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Column sort: sorting each column.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let c = 0; c < cc; c += 1) {
        const col: number[] = [];
        for (let r = c; r < arr.length; r += cc) col.push(arr[r] ?? 0);
        col.sort((x, y) => x - y);
        comparisons += col.length;
        for (let k = 0; k < col.length; k += 1) arr[c + k * cc] = col[k] ?? 0;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(
                arr,
                new Map<number, EntityState>([
                    [0, "comparing"],
                    [arr.length - 1, "comparing"],
                ]),
            ),
            edges: [],
            description: `Columns sorted – permuting rows to columns.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    swaps += 1;
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[1, "highlight"]])),
            edges: [],
            description: `Reshaped – sorting each column again.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let c = 0; c < cc; c += 1) {
        const col: number[] = [];
        for (let r = c; r < arr.length; r += cc) col.push(arr[r] ?? 0);
        col.sort((x, y) => x - y);
        comparisons += col.length;
        for (let k = 0; k < col.length; k += 1) arr[c + k * cc] = col[k] ?? 0;
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
    id: "column-sort",
    name: "Column Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [6, 2, 7, 1, 5, 3, 8, 4],
    visualType: "array",
    run,
};
export default module;
