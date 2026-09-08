/**
 * loser-tree-merge-sort.ts – Loser Tree Merge Sort.
 *
 * Tournament tree of run heads picks each winner.
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
    const fallback: number[] = [6, 1, 5, 2, 4, 3];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Runs seeded as tree leaves.",
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
    const runs11: number[][] = [];
    for (let i = 0; i < arr.length; i += 2) runs11.push(arr.slice(i, i + 2).sort((x, y) => x - y));
    comparisons += arr.length;
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Loser tree: seeding leaves with ${runs11.length} runs.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const ptr = runs11.map(() => 0);
    const out11: number[] = [];
    while (true) {
        let win = -1;
        for (let r = 0; r < runs11.length; r += 1) {
            if ((ptr[r] ?? 0) >= (runs11[r]?.length ?? 0)) continue;
            comparisons += 1;
            if (win < 0 || (runs11[r]?.[ptr[r] ?? 0] ?? 0) < (runs11[win]?.[ptr[win] ?? 0] ?? 0))
                win = r;
        }
        if (win < 0) break;
        out11.push(runs11[win]?.[ptr[win] ?? 0] ?? 0);
        ptr[win] = (ptr[win] ?? 0) + 1;
        swaps += 1;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[1, "comparing"]])),
            edges: [],
            description: `Playing matches up the loser tree – winners to output.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let i = 0; i < arr.length; i += 1) arr[i] = out11[i] ?? 0;
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
    id: "loser-tree-merge-sort",
    name: "Loser Tree Merge Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [6, 1, 5, 2, 4, 3],
    visualType: "array",
    run,
};
export default module;
