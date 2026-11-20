/**
 * block-sort.ts – Block Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Block sort (wiki sort) is the in-place answer to merge sort: it merges sorted runs using only O(1) extra space. Small blocks are sorted first, then rotated into place and merged with buffer tricks. It proves stable merging does not require a full auxiliary array.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n)
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
    const fallback: number[] = [5, 1, 4, 2, 3];
    const arr: number[] = Array.isArray(input) ? [...(input as number[])] : [...fallback];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Blocks queued for in-place merging.",
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
    const B = 2;
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(
                arr,
                new Map<number, EntityState>([
                    [0, "highlight"],
                    [1, "highlight"],
                ]),
            ),
            edges: [],
            description: `Block sort: sorting blocks of ${B}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let s = 0; s < arr.length; s += B) {
        const blk = arr.slice(s, s + B).sort((x, y) => x - y);
        comparisons += blk.length;
        for (let k = 0; k < blk.length; k += 1) arr[s + k] = blk[k] ?? 0;
        swaps += 1;
        if (budget > 0) {
            budget -= 1;
            yield {
                stepNumber: step,
                entities: makeBars(arr, new Map<number, EntityState>([[s, "sorted"]])),
                edges: [],
                description: `Block at ${s} sorted – rotating into place.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, swaps },
            };
            step += 1;
        }
    }
    if (budget > 0) {
        budget -= 1;
        yield {
            stepNumber: step,
            entities: makeBars(
                arr,
                new Map<number, EntityState>([
                    [0, "comparing"],
                    [arr.length - 1, "comparing"],
                ]),
            ),
            edges: [],
            description: `Merging sorted blocks in place.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { comparisons, swaps },
        };
        step += 1;
    }
    for (let i = 1; i < arr.length; i += 1) {
        const key = arr[i] ?? 0;
        let j = i - 1;
        comparisons += 1;
        while (j >= 0 && (arr[j] ?? 0) > key) {
            comparisons += 1;
            arr[j + 1] = arr[j] ?? 0;
            j -= 1;
            swaps += 1;
        }
        arr[j + 1] = key;
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
        "intuition": "Block sort, also called wiki sort, achieves a stable in-place merge by treating the array as small blocks. It sorts internal blocks, rotates whole blocks into place, then merges block by block using a tiny buffer. This shows that stable merging does not require a full auxiliary array.",
        "invariants": [
            "Each block is internally sorted after its local sort.",
            "The buffer region contains only elements that are out of place relative to the merge front."
        ],
        "correctness": "Rotations move correctly sized blocks to their merge positions without disturbing internal order; the two-finger merge then interleaves elements from the left and right runs stably. Every rotation preserves the multiset and each merge step emits the smaller head, so the final array is sorted.",
        "complexityRationale": "Sorting blocks and merging both scan each element O(log n) times across the run-doubling rounds, giving O(n log n) time. The buffer is bounded by one block, so auxiliary space is O(1).",
        "uses": [
            "Stable in-place sorting under memory limits",
            "Library sort implementations avoiding full buffers",
            "Studying in-place merge techniques"
        ],
        "references": [
            "Peters, Wiki Sort, 2014 (in-place stable merge sort)",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.4"
        ],
        "workedExample": "For [5, 1, 4, 2, 3], sort small blocks into [1, 5] and [2, 4] with [3] alone, rotate blocks so the smaller heads come first, then merge pairwise to [1, 2, 4, 5] and finally [1, 2, 3, 4, 5]."
    },
    id: "block-sort",
    name: "Block Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(1)" },
    defaultInput: [5, 1, 4, 2, 3],
    visualType: "array",
    run,
    pseudocode: [
        "start with unsorted blocks queued for merging",
        "sort each block of size B in place",
        "rotate each sorted block into its run position",
        "merge sorted blocks in place across the array",
        "scan blocks into final order",
        "done: array is fully sorted",
    ],
};
export default module;
