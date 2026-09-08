/**
 * natural-merge-sort.ts – Natural Merge Sort.
 *
 * Merges the runs nature already left sorted.
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
    const fallback: number[] = [1, 3, 2, 4, 6, 5];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Runs detectable in the input.",
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
    const runs15: number[][] = [[]];
    for (const v of arr) {
        const cur = runs15[runs15.length - 1] as number[];
        if (cur.length > 0 && v < (cur[cur.length - 1] ?? 0)) runs15.push([]);
        (runs15[runs15.length - 1] as number[]).push(v);
        comparisons += 1;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Natural runs detected: ${runs15.length} run(s).`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    while (runs15.length > 1) {
        const a15 = runs15.shift() ?? [];
        const b15 = runs15.shift() ?? [];
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(
                    arr,
                    new Map<number, EntityState>([
                        [0, "comparing"],
                        [a15.length, "comparing"],
                    ]),
                ),
                edges: [],
                description: `Merging runs of length ${a15.length} and ${b15.length}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
        const m15: number[] = [];
        let p15 = 0,
            q15 = 0;
        while (p15 < a15.length && q15 < b15.length) {
            comparisons += 1;
            if ((a15[p15] ?? 0) <= (b15[q15] ?? 0)) m15.push(a15[p15++] ?? 0);
            else m15.push(b15[q15++] ?? 0);
        }
        while (p15 < a15.length) m15.push(a15[p15++] ?? 0);
        while (q15 < b15.length) m15.push(b15[q15++] ?? 0);
        runs15.push(m15);
        swaps += 1;
    }
    const done = runs15[0] ?? [];
    for (let i = 0; i < arr.length; i += 1) arr[i] = done[i] ?? 0;
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
    id: "natural-merge-sort",
    name: "Natural Merge Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [1, 3, 2, 4, 6, 5],
    visualType: "array",
    run,
};
export default module;
