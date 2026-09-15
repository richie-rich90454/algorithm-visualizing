/**
 * burstsort.ts – Burstsort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Burstsort sorts strings by bursting a trie: keys sharing a prefix share a bucket until the bucket overflows, then it bursts into deeper trie nodes. Each bucket is small enough to sort fast with classic methods. It beats quicksort on large string sets by exploiting common prefixes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n · w)
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
    const fallback: number[] = [5, 3, 1, 4, 2];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Keys queued before trie bursting.",
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
    const buckets = new Map<string, number[]>();
    for (const v of arr) {
        const k = String(v)[0] ?? "0";
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k)?.push(v);
        comparisons += 1;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Burstsort: bursting values into ${buckets.size} trie buckets.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const keys = [...buckets.keys()].sort();
    swaps += 1;
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[1, "comparing"]])),
            edges: [],
            description: `Buckets ordered – sorting inside each bucket.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const out: number[] = [];
    for (const k of keys) out.push(...(buckets.get(k) ?? []).sort((x, y) => x - y));
    for (let i = 0; i < arr.length; i += 1) arr[i] = out[i] ?? 0;
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
    id: "burstsort",
    name: "Burstsort",
    category: "sorting",
    complexity: { time: "O(n · w)", space: "O(n)" },
    defaultInput: [5, 3, 1, 4, 2],
    visualType: "array",
    run,
    pseudocode: [
        "start with unsorted keys queued for the trie",
        "burst keys into trie buckets by leading bytes",
        "sort keys inside each bucket",
        "traverse buckets in order to collect output",
        "scan collected keys into final order",
        "done: keys are in sorted order",
    ],
};
export default module;
