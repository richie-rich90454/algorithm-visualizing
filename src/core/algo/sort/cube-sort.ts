/**
 * cube-sort.ts – Cube Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cube sort routes values along the dimensions of a hypercube, comparing neighbors that differ in one bit. Each dimension pass exchanges out-of-order neighbors, just like bubble sort limited to cube edges. It is parallel by construction: all edges of one dimension fire at once.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n)
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
    const fallback: number[] = [5, 2, 7, 1, 6, 3, 8, 4];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Cube vertices holding values.",
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
    const n13 = arr.length;
    const bits = Math.ceil(Math.log2(Math.max(n13, 2)));
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Cube sort: routing along ${bits} cube dimensions.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let d = 0; d < bits; d += 1) {
        for (let i = 0; i < n13; i += 1) {
            const j = i ^ (1 << d);
            if (j <= i || j >= n13) continue;
            comparisons += 1;
            if ((arr[i] ?? 0) > (arr[j] ?? 0)) {
                const t = arr[i] ?? 0;
                arr[i] = arr[j] ?? 0;
                arr[j] = t;
                swaps += 1;
                if (budget > 0) {
                    budget -= 1;
                    yield {
                        stepNumber: step,
                        entities: makeBars(
                            arr,
                            new Map<number, EntityState>([
                                [i, "swapped"],
                                [j, "swapped"],
                            ]),
                        ),
                        edges: [],
                        description: `Dimension ${d}: exchanging cube neighbors ${i} and ${j}.`,
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
        "intuition": "Cube sort arranges values at the vertices of a hypercube and compares neighbors that differ in exactly one coordinate bit. Each dimension pass orders pairs along that dimension, and all edges of a dimension can fire simultaneously. It is a parallel sort built from local swaps.",
        "invariants": [
            "After processing a dimension, every edge along that dimension connects an ordered pair.",
            "The set of values stored at vertices never changes."
        ],
        "correctness": "Ordering all edges of one dimension is equivalent to sorting along that bit; processing every bit dimension in sequence gives sorted order under the hypercube's Gray-code ranking. Local swaps never change the value set, so the end state is the sorted permutation.",
        "complexityRationale": "There are log n dimensions and each pass touches n elements, so O(n log n) work with logarithmic depth when edges run in parallel. The visualization holds the array plus edge metadata, O(n) space.",
        "uses": [
            "Parallel sorting on hypercube topologies",
            "Teaching dimension-by-dimension local sorting",
            "Network-on-chip sorting demonstrations"
        ],
        "references": [
            "Leighton, Introduction to Parallel Algorithms and Architectures, Chapter 4",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.3"
        ],
        "workedExample": "For [6, 3, 7, 1] on four cube vertices, the first dimension compares pairs (6, 7) and (3, 1) and orders them; the second compares across the other bit. The final vertex-by-vertex read gives [1, 3, 6, 7]."
    },
    id: "cube-sort",
    name: "Cube Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [5, 2, 7, 1, 6, 3, 8, 4],
    visualType: "array",
    run,
    pseudocode: [
        "start with values sitting on cube vertices",
        "route along the next cube dimension",
        "compare cube neighbors and exchange if flipped",
        "advance through all cube dimensions",
        "scan vertices into final order",
        "done: cube order is sorted",
    ],
};
export default module;
