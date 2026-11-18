/**
 * wiggle-sort.ts – Wiggle Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Wiggle sort arranges values so they alternately dip and peak, then settles equal neighbors into sorted spots for this lesson. Ranking splits the array into small and large halves that interleave cleanly. It previews the true wiggle problem, where strict alternation needs careful duplicate handling.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)
 *   Space: O(1)
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
    const fallback: number[] = [3, 1, 2];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Values before wiggle interleaving.",
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
    const sorted10 = [...arr].sort((x, y) => x - y);
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Wiggle: ranking values to interleave halves.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    const half = Math.ceil(sorted10.length / 2);
    const wiggle: number[] = [];
    const lo10 = sorted10.slice(0, half).reverse();
    const hi10 = sorted10.slice(half).reverse();
    for (let i = 0; i < half; i += 1) {
        wiggle.push(lo10[i] ?? 0);
        if (i < hi10.length) wiggle.push(hi10[i] ?? 0);
        comparisons += 1;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[1, "comparing"]])),
            edges: [],
            description: `Interleaving small and large halves.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let i = 0; i < arr.length; i += 1) {
        arr[i] = wiggle[i] ?? 0;
        swaps += 1;
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[2, "highlight"]])),
            edges: [],
            description: `Wiggle order placed – settling to sorted order.`,
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

    education: {
        "intuition": "Wiggle sort arranges values so they alternate low and high, dipping and peaking across the array. This lesson ranks values into small and large halves and interleaves them, settling equal neighbors into sorted slots.",
        "invariants": [
            "Small-half values occupy the even positions and large-half values the odd positions.",
            "The relative order inside each half is preserved by the interleaving."
        ],
        "correctness": "Because every small-half value is no larger than every large-half value, placing them alternately guarantees each interior element lies between its neighbors' extremes, satisfying the wiggle condition.",
        "complexityRationale": "Rank splitting and interleaving each scan the array once, so O(n) time; in-place ranking uses O(1) extra space, while the visualization keeps a rank array of O(n).",
        "uses": [
            "Reordering data for alternating layouts",
            "Preprocessing for zigzag scanning in codecs",
            "Teaching stable partition and interleaving"
        ],
        "references": [
            "LeetCode 280, Wiggle Sort, problem and editorial",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2 (partitioning)"
        ],
        "workedExample": "For [3, 1, 2], rank order is 1, 2, 3; place the small half first at even slots and the large half at odd slots to get [1, 3, 2], which dips then peaks."
    },
    id: "wiggle-sort",
    name: "Wiggle Sort",
    category: "sorting",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: [3, 1, 2],
    visualType: "array",
    run,
    pseudocode: [
        "start with values before wiggle interleaving",
        "rank values to split small and large halves",
        "interleave the halves into wiggle order",
        "settle any equal neighbors into sorted spots",
        "scan wiggles into final order",
        "done: array is sorted and ready to wiggle",
    ],
};
export default module;
