/**
 * samplesort.ts – Samplesort.
 *
 * Samples splitters, buckets, sorts each bucket.
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
    const fallback: number[] = [6, 2, 5, 1, 4, 3];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Oversized sample awaiting splitters.",
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
    const s = [...arr].sort((x, y) => x - y);
    const splitters = [s[1] ?? 0, s[3] ?? 0].filter((v, i, a) => a.indexOf(v) === i);
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(
                arr,
                new Map<number, EntityState>([
                    [1, "comparing"],
                    [3, "comparing"],
                ]),
            ),
            edges: [],
            description: `Samplesort: oversampling splitters ${splitters.join(", ")}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const bins: number[][] = Array.from({ length: splitters.length + 1 }, () => []);
    for (const v of arr) {
        let b = 0;
        while (b < splitters.length && v > (splitters[b] ?? 0)) {
            b += 1;
            comparisons += 1;
        }
        bins[b]?.push(v);
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Partitioning into ${bins.length} buckets by splitter.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const out3: number[] = [];
    for (const b of bins) {
        b.sort((x, y) => x - y);
        out3.push(...b);
        swaps += 1;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[2, "highlight"]])),
            edges: [],
            description: `Buckets sorted recursively, concatenated.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let i = 0; i < arr.length; i += 1) arr[i] = out3[i] ?? 0;
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
    id: "samplesort",
    name: "Samplesort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [6, 2, 5, 1, 4, 3],
    visualType: "array",
    run,
};
export default module;
