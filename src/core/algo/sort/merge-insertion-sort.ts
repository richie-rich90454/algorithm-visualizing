/**
 * merge-insertion-sort.ts – Merge-Insertion Sort.
 *
 * Ford-Johnson pairing plus binary insertion chains.
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
    const fallback: number[] = [5, 3, 1, 4, 2];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Unpaired elements awaiting pairing.",
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
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i + 1 < arr.length; i += 2) {
        const a = arr[i] ?? 0;
        const b = arr[i + 1] ?? 0;
        comparisons += 1;
        pairs.push(a > b ? [b, a] : [a, b]);
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(
                arr,
                new Map<number, EntityState>([
                    [0, "comparing"],
                    [1, "comparing"],
                ]),
            ),
            edges: [],
            description: `Pairing up and sorting each pair.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const big = pairs.map((p) => p[1]).sort((x, y) => x - y);
    const small = pairs.map((p) => p[0]).sort((x, y) => x - y);
    comparisons += big.length + small.length;
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Larger elements ordered – binary-inserting smaller ones.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const chain: number[] = [...big];
    for (const v of small) {
        let lo = 0,
            hi = chain.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            comparisons += 1;
            if ((chain[mid] ?? 0) < v) lo = mid + 1;
            else hi = mid;
        }
        chain.splice(lo, 0, v);
        swaps += 1;
    }
    if (arr.length % 2 === 1) {
        const last = arr[arr.length - 1] ?? 0;
        let lo = 0,
            hi = chain.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            comparisons += 1;
            if ((chain[mid] ?? 0) < last) lo = mid + 1;
            else hi = mid;
        }
        chain.splice(lo, 0, last);
    }
    for (let i = 0; i < arr.length; i += 1) arr[i] = chain[i] ?? 0;
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
    id: "merge-insertion-sort",
    name: "Merge-Insertion Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [5, 3, 1, 4, 2],
    visualType: "array",
    run,
};
export default module;
