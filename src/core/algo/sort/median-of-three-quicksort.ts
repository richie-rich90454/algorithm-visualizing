/**
 * median-of-three-quicksort.ts - Quicksort with Median-of-Three Pivot
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This quicksort variant selects its pivot as the median of the first, middle,
 * and last elements of the current subarray instead of taking a single fixed
 * position. The median-of-three rule avoids the worst case on already sorted or
 * reverse-sorted input, where a naive first-element pivot would produce deeply
 * unbalanced partitions. Partitioning then uses the Lomuto scheme.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) average, O(n^2) worst case
 *   Space: O(log n) average recursion stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current array.
 *   - The pivot is GOLD; the scan position is YELLOW; a swap is ORANGE.
 *   - The final frame marks the array GREEN.
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

/** Index holding the median of the three sampled values. */
function medianOfThree(a: number[], i: number, j: number, k: number): number {
    const x = a[i] as number;
    const y = a[j] as number;
    const z = a[k] as number;
    if (x <= y) return y <= z ? j : x <= z ? k : i;
    return x <= z ? i : y <= z ? k : j;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const a: number[] = Array.isArray(input) ? [...(input as number[])] : [7, 2, 9, 4, 1, 6, 3, 8, 5];
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

    function* quick(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        if (hi - lo <= 1) return;
        const mid = Math.floor((lo + hi) / 2);
        const candidates = [a[lo] as number, a[mid] as number, a[hi - 1] as number];
        const pIdx = medianOfThree(a, lo, mid, hi - 1);
        const pivot = a[pIdx] as number;
        const tmp = a[pIdx] as number;
        a[pIdx] = a[hi - 1] as number;
        a[hi - 1] = tmp;
        const pivotStates = new Map<number, EntityState>([[hi - 1, "pivot"]]);
        yield emit(
            `Subarray [${lo}, ${hi}): median of ${candidates.join(", ")} is ${pivot}, moved to the end.`,
            2,
            pivotStates,
            { lo, hi, pivotValue: pivot, candidates },
        );

        let i = lo - 1;
        for (let j = lo; j < hi - 1; j += 1) {
            const compareStates = new Map<number, EntityState>(pivotStates);
            compareStates.set(j, "comparing");
            compareStates.set(hi - 1, "pivot");
            yield emit(`Compare A[${j}]=${a[j]} with pivot ${pivot}.`, 4, compareStates, { lo, hi, pivotValue: pivot, j });
            if ((a[j] as number) <= pivot) {
                i += 1;
                const t = a[i] as number;
                a[i] = a[j] as number;
                a[j] = t;
                if (i !== j) {
                    const swapStates = new Map<number, EntityState>(pivotStates);
                    swapStates.set(i, "swapped");
                    swapStates.set(j, "swapped");
                    yield emit(`A[${j}] <= pivot, swap into the low region at ${i}.`, 4, swapStates, { lo, hi, pivotValue: pivot });
                }
            }
        }
        const final = i + 1;
        const t = a[final] as number;
        a[final] = a[hi - 1] as number;
        a[hi - 1] = t;
        const placeStates = new Map<number, EntityState>([[final, "pivot"]]);
        yield emit(`Pivot ${pivot} placed at index ${final}; left and right remain to sort.`, 5, placeStates, { lo, hi, pivotValue: pivot, pivotIndex: final });
        yield* quick(lo, final);
        yield* quick(final + 1, hi);
    }

    yield emit("Median-of-three quicksort begins.", 0);
    yield* quick(0, a.length);
    const all = new Map<number, EntityState>(a.map((_, idx) => [idx, "sorted" as EntityState]));
    yield emit(`Sorted: [${a.join(", ")}].`, 8, all, { sorted: true });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Quicksort partitions an array around a pivot, then recurses on the two sides. A single fixed pivot is catastrophic on already ordered data, so this variant looks at the first, middle, and last values and uses their median. That value is unlikely to be extreme, so both partitions tend to be useful and the recursion stays shallow.",
        invariants: [
            "After a partition, every element left of the pivot is at most the pivot and every element to the right is greater.",
            "The pivot is always one of the first, middle, or last values of the current subarray.",
            "Each recursive call works on a strictly smaller subarray.",
        ],
        correctness:
            "The Lomuto partition loop maintains that positions below i hold values at most the pivot, positions from i+1 up to j-1 hold values greater than the pivot, and the rest are unseen. When the scan finishes, swapping the pivot into position i+1 establishes the partition invariant. By induction, recursively sorting the two smaller sides yields a fully sorted subarray.",
        complexityRationale:
            "Each partition scans the subarray once, costing O(n) per level. Balanced partitions from median-of-three give O(n log n) average time; an unlucky sequence of samples still permits O(n^2). The recursion stack is O(log n) on average.",
        uses: [
            "General-purpose in-memory sorting in standard libraries",
            "Sorting where input may already be sorted or nearly sorted",
            "A baseline for studying pivot-selection strategies",
        ],
        references: [
            "Cormen et al., Introduction to Algorithms, 3rd ed., Ch. 7",
            "Sedgewick and Wayne, Algorithms, 4th ed., Section 2.3",
        ],
        workedExample:
            "For [7, 2, 9, 4, 1, 6, 3, 8, 5] the first subarray samples 7, 1, and 5, whose median is 5. Moving 5 to the end and partitioning puts smaller values to its left and larger values to its right; applying the same rule recursively produces [1, 2, 3, 4, 5, 6, 7, 8, 9].",
    },
    id: "median-of-three-quicksort",
    name: "Median-of-Three Quicksort",
    category: "sorting",
    complexity: { time: "O(n log n) average", space: "O(log n) average" },
    defaultInput: [7, 2, 9, 4, 1, 6, 3, 8, 5],
    visualType: "array",
    run,
    pseudocode: [
        "quicksort(A, lo, hi): if hi - lo <= 1 return",
        "mid = floor((lo + hi) / 2)",
        "pivot = median of A[lo], A[mid], A[hi-1]; swap it to hi-1",
        "i = lo - 1",
        "for j from lo to hi-2: if A[j] <= pivot: i++, swap A[i], A[j]",
        "swap A[i+1], A[hi-1]; p = i+1",
        "quicksort(A, lo, p)",
        "quicksort(A, p+1, hi)",
        "done: the whole array is sorted",
    ],
};

export default module;
