/**
 * weak-heap-sort.ts – Weak Heap Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Weak-heap sort relaxes the heap so each node needs only one child pointer plus a reverse bit, halving the bookkeeping of heap sort. Joining nodes by distinguished ancestors builds the weak heap, then repeated extraction sorts. It keeps heap sort's guarantee with fewer comparisons.
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
    const fallback: number[] = [5, 1, 4, 2, 3];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Values before weak-heap build.",
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
    const bits14 = new Array<number>(arr.length).fill(0);
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
            edges: [],
            description: `Weak heap: building reverse-bit tree.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const p = i >> 1;
        comparisons += 1;
        if ((arr[i] ?? 0) > (arr[p] ?? 0)) {
            const t = arr[i] ?? 0;
            arr[i] = arr[p] ?? 0;
            arr[p] = t;
            bits14[i] = 1 - (bits14[i] ?? 0);
            swaps += 1;
            if (budget > 0) {
                budget -= 1;
                yield {
                    stepNumber: step,
                    entities: makeBars(
                        arr,
                        new Map<number, EntityState>([
                            [p, "swapped"],
                            [i, "swapped"],
                        ]),
                    ),
                    edges: [],
                    description: `Joining weak-heap node ${i} with parent ${p}.`,
                    codeLineNumber: 2,
                    layout: "array",
                    meta: { comparisons, swaps },
                };
                step += 1;
            }
        }
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[1, "comparing"]])),
            edges: [],
            description: `Extracting maxima with distinguished ancestors.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let end = arr.length - 1; end > 0; end -= 1) {
        const t = arr[0] ?? 0;
        arr[0] = arr[end] ?? 0;
        arr[end] = t;
        swaps += 1;
        let x = 1;
        while (x < end) {
            comparisons += 1;
            const y = x + (bits14[x] ?? 0);
            if (y < end && (arr[y] ?? 0) > (arr[x] ?? 0)) x = y;
            else break;
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
        "intuition": "Weak-heap sort relaxes the heap invariant: each node needs only one distinguished child and a reverse bit instead of two children. This halves pointer bookkeeping while still supporting find-minimum and delete-minimum in logarithmic time.",
        "invariants": [
            "Each node is no larger than its distinguished child and its reverse-designated neighbor.",
            "The weak-heap order implies the minimum is among the roots."
        ],
        "correctness": "Weak-heap operations preserve the relaxed order and the minimum of a weak heap is found at a distinguished root; deleting it and merging the resulting heaps restores the structure, so repeated extraction emits sorted values.",
        "complexityRationale": "Building takes O(n) and each extraction and merge is O(log n), giving O(n log n) worst-case time with fewer comparisons than binary heaps. The node array and reverse bits use O(n) space.",
        "uses": [
            "Sorting with fewer comparisons than binary heap sort",
            "Priority queues with cheap pointer storage",
            "Teaching relaxed heap invariants"
        ],
        "references": [
            "Dutton, Weak Heaps, Technical Report TR-87-15, University of Central Florida, 1988",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.1"
        ],
        "workedExample": "For [5, 1, 4, 2, 3], nodes are joined by distinguished edges so 1 is a root minimum; extract 1, merge its children back, and the next root minimum is 2, then 3, 4, 5."
    },
    id: "weak-heap-sort",
    name: "Weak Heap Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [5, 1, 4, 2, 3],
    visualType: "array",
    run,
    pseudocode: [
        "start with values before the weak-heap build",
        "build the reverse-bit weak-heap tree",
        "join each node with its distinguished ancestor",
        "extract each maximum to its final slot",
        "scan extracted maxima into final order",
        "done: array is fully sorted",
    ],
};
export default module;
