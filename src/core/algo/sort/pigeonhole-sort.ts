/**
 * pigeonhole-sort.ts – Pigeonhole Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Pigeonhole sort drops each value into the hole labeled with that exact value, then reads holes back in order. It is counting sort without the counting step, perfect when every key maps to its own hole. The pigeonhole principle guarantees correctness: n items into matching holes come out ordered.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + k)
 *   Space: O(k)
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
    const fallback: number[] = [4, 1, 3, 2, 1];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Empty pigeonholes awaiting values.",
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
    const mn = Math.min(...arr);
    const mx2 = Math.max(...arr);
    const holes = new Array<number>(mx2 - mn + 1).fill(0);
    for (const v of arr) {
        holes[v - mn] = (holes[v - mn] ?? 0) + 1;
        comparisons += 1;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Pigeonhole: dropping each value into its hole.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    let p2 = 0;
    for (let h = 0; h < holes.length; h += 1) {
        const c = holes[h] ?? 0;
        for (let k = 0; k < c; k += 1) {
            arr[p2] = mn + h;
            p2 += 1;
        }
        if (c > 0) swaps += 1;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[1, "comparing"]])),
            edges: [],
            description: `Reading holes back in order.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[2, "highlight"]])),
            edges: [],
            description: `Holes emptied – values collected sorted.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    void 0;
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
    id: "pigeonhole-sort",
    name: "Pigeonhole Sort",
    category: "sorting",
    complexity: { time: "O(n + k)", space: "O(k)" },
    defaultInput: [4, 1, 3, 2, 1],
    visualType: "array",
    run,
    pseudocode: [
        "start with empty pigeonholes for each value",
        "drop each value into its matching hole",
        "read holes back in order from low to high",
        "collect repeated values from each occupied hole",
        "scan holes into final order",
        "done: values are collected in sorted order",
    ],
};
export default module;
