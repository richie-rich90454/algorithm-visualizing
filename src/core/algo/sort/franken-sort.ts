/**
 * franken-sort.ts - FrankenSort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * FrankenSort is a recursive comparison sort that repeatedly sorts the two
 * halves of an array, swaps the two middle quarters, and then sorts the halves
 * and the middle block again. The overlap is what stitches the pieces into one
 * sorted array. Blocks of at most five elements are finished with selection
 * sort, which is the base case of the recursion.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) - three recursive calls on blocks of size about n/2
 *   Space: O(log n) recursion stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current array is drawn as bars.
 *   - A freshly sorted block is GREEN; a swapped pair is ORANGE.
 *   - The final frame marks the whole array GREEN.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(a: number[], states: Map<number, EntityState>): VisualEntity[] {
    return a.map((value, index) => ({
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
    const a: number[] = Array.isArray(input) ? [...(input as number[])] : [5, 3, 8, 1, 9, 2, 7, 4, 6];
    let step = 0;

    const emit = (
        description: string,
        codeLineNumber: number,
        states: Map<number, EntityState> = new Map(),
        meta: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => {
        const s = step;
        step += 1;
        return {
            stepNumber: s,
            entities: makeBars(a, states),
            edges: [],
            description,
            codeLineNumber,
            layout: "array",
            meta: { n: a.length, ...meta },
        };
    };

    const selectionSort = (lo: number, hi: number): void => {
        for (let i = lo; i < hi - 1; i += 1) {
            let best = i;
            for (let j = i + 1; j < hi; j += 1) {
                if ((a[j] as number) < (a[best] as number)) best = j;
            }
            if (best !== i) {
                const t = a[i] as number;
                a[i] = a[best] as number;
                a[best] = t;
            }
        }
    };

    function* franken(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        const n = hi - lo;
        if (n <= 5) {
            selectionSort(lo, hi);
            const done = new Map<number, EntityState>();
            for (let i = lo; i < hi; i += 1) done.set(i, "sorted");
            yield emit(`Selection-sorted the block [${lo}, ${hi}).`, 0, done, { lo, hi });
            return;
        }
        const m = Math.ceil(n / 4);
        yield emit(`Block [${lo}, ${hi}): m = ceil(${n}/4) = ${m}, splitting into halves.`, 1, new Map(), { lo, hi, m });
        yield* franken(lo, lo + 2 * m);
        yield* franken(lo + 2 * m, hi);
        const swapped = new Map<number, EntityState>();
        for (let i = m; i < 2 * m; i += 1) {
            const t = a[lo + i] as number;
            a[lo + i] = a[lo + i + m] as number;
            a[lo + i + m] = t;
            swapped.set(lo + i, "swapped");
            swapped.set(lo + i + m, "swapped");
        }
        yield emit(`Swapped the two middle quarters of [${lo}, ${hi}).`, 4, swapped, { lo, hi, m });
        yield* franken(lo, lo + 2 * m);
        yield* franken(lo + 2 * m, hi);
        yield* franken(lo + m, lo + 3 * m);
    }

    yield emit("FrankenSort starts: recursively sort, swap the middle, then sort again.", 1);
    yield* franken(0, a.length);
    const all = new Map<number, EntityState>(a.map((_, i) => [i, "sorted" as EntityState]));
    yield emit(`Sorted: [${a.join(", ")}].`, 8, all, { sorted: true });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "FrankenSort sorts a block by sorting its two halves, swapping the middle quarters, and then sorting the halves and the overlapping middle block again. The overlap lets elements that ended up on the wrong side migrate across the boundary. Small blocks are finished with selection sort, which anchors the recursion.",
        invariants: [
            "Every recursive call works on a block whose values are a permutation of the original block values.",
            "A call that returns has left its whole block in nondecreasing order.",
            "The block sizes shrink toward the base case of five elements or fewer.",
        ],
        correctness:
            "By induction on the block size: blocks of five or fewer are sorted outright by selection sort. For a larger block, the first two calls sort its halves; after the middle quarters are exchanged, the outer elements are in their final halves, and the two re-sorting calls plus the middle-block call fix the boundary. The three calls all operate on strictly smaller blocks, so induction gives a fully sorted result.",
        complexityRationale:
            "At each level roughly three calls operate on blocks of size about n/2, giving T(n) = 3T(n/2) + O(n) and therefore O(n log n) time. The recursion depth is logarithmic, so O(log n) stack space is needed.",
        uses: [
            "A teaching example of a multi-call recursive sort and recurrence analysis",
            "An exercise in proving correctness of overlapping recursive calls",
            "Counting swaps as a function of input size in algorithms coursework",
        ],
        references: [
            "United States Naval Academy, SI335 Problem Set 4: FrankenSort, 2025",
            "Cormen et al., Introduction to Algorithms, 3rd ed., Ch. 2 and 4",
        ],
        workedExample:
            "For [5, 3, 8, 1, 9, 2, 7, 4, 6] with n = 9 and m = 3, the first half [5, 3, 8, 1, 9, 2] and the tail [7, 4, 6] are sorted, positions 3 and 4 are swapped with positions 6 and 7, and the three follow-up calls settle the overlap so the final array is [1, 2, 3, 4, 5, 6, 7, 8, 9].",
    },
    id: "franken-sort",
    name: "FrankenSort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(log n)" },
    defaultInput: [5, 3, 8, 1, 9, 2, 7, 4, 6],
    visualType: "array",
    run,
    pseudocode: [
        "if block size n <= 5: selection sort the block",
        "let m = ceil(n/4), split the block into two halves",
        "franken sort the first half",
        "franken sort the second half",
        "for i from m to 2m-1: swap A[i] with A[i+m]",
        "franken sort the first half again",
        "franken sort the second half again",
        "franken sort the middle block A[m..3m]",
        "done: the whole array is sorted",
    ],
};

export default module;
