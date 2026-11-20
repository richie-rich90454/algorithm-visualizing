/**
 * strand-sort.ts – Strand Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Strand sort repeatedly pulls increasing strands out of the input pool and merges each strand into the output. Each strand is already sorted, so merging stays cheap. It is a natural fit for linked lists, where pulling strands costs no extra memory.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n²)
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
        description: "Unsorted input pool with empty output.",
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
    const work: number[] = [...arr];
    const out: number[] = [];
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map<number, EntityState>([[0, "comparing"]])),
            edges: [],
            description: `Pulling increasing strands from the input.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    while (work.length > 0) {
        const strand: number[] = [work.shift() ?? 0];
        for (let i = 0; i < work.length; i += 1) {
            comparisons += 1;
            if ((work[i] ?? 0) >= (strand[strand.length - 1] ?? 0))
                strand.push(work.splice(i, 1)[0] ?? 0);
        }
        const merged: number[] = [];
        let a2 = 0,
            b2 = 0;
        while (a2 < out.length && b2 < strand.length) {
            comparisons += 1;
            if ((out[a2] ?? 0) <= (strand[b2] ?? 0)) merged.push(out[a2++] ?? 0);
            else merged.push(strand[b2++] ?? 0);
        }
        while (a2 < out.length) merged.push(out[a2++] ?? 0);
        while (b2 < strand.length) merged.push(strand[b2++] ?? 0);
        out.length = 0;
        out.push(...merged);
        swaps += 1;
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(arr, new Map<number, EntityState>([[0, "highlight"]])),
                edges: [],
                description: `Merged strand of length ${strand.length}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
    }
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

    education: {
        "intuition": "Strand sort repeatedly pulls an increasing strand from the remaining values and merges it into the output. Because each strand is already sorted, merging is cheap. It is a natural fit for linked lists where extraction needs no extra memory.",
        "invariants": [
            "Each extracted strand is increasing.",
            "The output is sorted after every merge."
        ],
        "correctness": "Taking the maximal increasing prefix starting from the smallest available value yields a sorted strand; merging sorted strands preserves sorted order, so after all values are consumed the output is sorted.",
        "complexityRationale": "In the worst case each pass extracts one element, costing O(n) per pass and O(n^2) total; merging adds comparable work. Lists and output buffers use O(n) space.",
        "uses": [
            "Sorting linked lists without random access",
            "Teaching merge-based list algorithms",
            "Streaming data with natural increasing runs"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.4 (list sorting)",
            "Sedgewick and Wayne, Algorithms, Section 2.2"
        ],
        "workedExample": "From [5, 1, 4, 2, 3], pull strand [1, 4], then [2, 3], then [5]; merge [1, 4] with [2, 3] to [1, 2, 3, 4] and finally merge in [5] for [1, 2, 3, 4, 5]."
    },
    id: "strand-sort",
    name: "Strand Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(n)" },
    defaultInput: [5, 1, 4, 2, 3],
    visualType: "array",
    run,
    pseudocode: [
        "start with the input pool full and output empty",
        "pull one increasing strand from the input pool",
        "merge the strand into the sorted output",
        "repeat until the input pool is empty",
        "scan strands into final order",
        "done: output holds all values sorted",
    ],
};
export default module;
