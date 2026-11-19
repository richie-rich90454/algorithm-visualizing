/**
 * dual-pivot-quicksort.ts – Dual-Pivot Quick Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dual-pivot quick sort picks two pivots from the ends of a range and splits
 * the middle into three regions in one pass: values below the small pivot,
 * values between the pivots, and values above the large pivot. Only the outer
 * two regions need further recursion, so it uses fewer comparisons per element
 * than the single-pivot schemes and is the basis of Java's Arrays.sort for
 * primitive types.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) average, O(n^2) worst
 *   Space: O(log n) average recursion depth
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The two active pivots are PURPLE.
 *   - The scanning pointers are YELLOW.
 *   - Swapped values flash RED.
 *   - The finished array is GREEN.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Not stable, in place.
 *   - Three-way partition keeps equal keys in the middle region.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(
    arr: number[],
    states: Map<number, EntityState> = new Map(),
    pivots: number[] = [],
): VisualEntity[] {
    return arr.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: pivots.includes(index) ? "pivot" : (states.get(index) ?? "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const arr = Array.isArray(input) ? [...(input as number[])] : [9, 2, 6, 1, 8, 3, 7, 4, 5];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;

    const frame = (
        description: string,
        states: Map<number, EntityState>,
        pivots: number[],
        codeLineNumber: number,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeBars(arr, states, pivots),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { comparisons, swaps },
    });

    const swap = (i: number, j: number): void => {
        const temp = arr[i] as number;
        arr[i] = arr[j] as number;
        arr[j] = temp;
        swaps += 1;
    };

    yield frame("Dual-pivot quick sort will split each range into three regions.", new Map(), [], 0);

    function* sort(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        if (lo >= hi) {
            return;
        }
        if ((arr[lo] as number) > (arr[hi] as number)) {
            swap(lo, hi);
        }
        const lp = arr[lo] as number;
        const rp = arr[hi] as number;
        let lt = lo + 1;
        let i = lo + 1;
        let gt = hi - 1;

        while (i <= gt) {
            const value = arr[i] as number;
            comparisons += 1;
            if (value < lp) {
                swap(i, lt);
                lt += 1;
                i += 1;
            } else if (value > rp) {
                swap(i, gt);
                gt -= 1;
            } else {
                i += 1;
            }
            const states = new Map<number, EntityState>([
                [lt - 1, "sorted"],
                [i, "comparing"],
                [gt, "comparing"],
            ]);
            yield frame(
                `Partition [${lo}..${hi}] with pivots ${lp} and ${rp}: scanning index ${i}.`,
                states,
                [lo, hi],
                3,
            );
        }

        swap(lo, lt - 1);
        swap(hi, gt + 1);
        yield frame(
            `Placed pivot ${lp} at ${lt - 1} and pivot ${rp} at ${gt + 1}.`,
            new Map(),
            [lt - 1, gt + 1],
            4,
        );

        yield* sort(lo, lt - 2);
        yield* sort(lt, gt);
        yield* sort(gt + 2, hi);
    }

    yield* sort(0, arr.length - 1);

    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted" as EntityState]));
    yield frame(
        `Array sorted with ${comparisons} comparisons and ${swaps} swaps.`,
        sortedStates,
        [],
        9,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Standard quick sort chooses one pivot and makes two regions. Dual-pivot quick sort chooses two pivots from the range ends and separates the middle into three regions in one scan. The two pivots eventually settle at the boundaries of the outer regions so only the smaller and larger regions need another pass.",
        invariants: [
            "At all times the small pivot is no greater than the large pivot.",
            "Values in the left region are below the small pivot, values in the right region are above the large pivot, and the middle holds values between them.",
            "The three recursive ranges are disjoint and together cover the original range.",
        ],
        correctness:
            "The partition loop maintains the three regions by swapping each inspected value into the correct one. When the pointers cross, swapping the two stored pivots into the region boundaries puts every element in its proper side. By induction each recursive range is sorted, and the concatenating pivots are already in order, so the whole range is sorted.",
        complexityRationale:
            "Each partition scans its range once, so the cost follows the quick-sort recurrence: O(n log n) on balanced splits and O(n^2) on consistently unbalanced ones. Two pivots reduce the average comparison count, and recursion uses O(log n) stack frames on average.",
        uses: [
            "Primitive-type array sorting in the Java standard library",
            "High-throughput in-place sorting with low comparison counts",
            "Teaching three-way partitioning as a generalization of Hoare partitioning",
        ],
        references: [
            "Bentley and McIlroy, Engineering a Sort Function, 1993",
            "CLRS, Introduction to Algorithms, Chapter 7",
        ],
        workedExample:
            "On [3, 1, 4, 2] the pivots are 3 and 2; swapping the ends first gives 2 and 3. The scan places 1 below 2 and keeps 4 between the pivots, yielding [1, 2, 4, 3]. The outer ranges are singletons and the middle range is sorted, giving [1, 2, 3, 4].",
    },
    id: "dual-pivot-quicksort",
    name: "Dual-Pivot Quick Sort",
    category: "sorting",
    complexity: { time: "O(n log n) avg, O(n^2) worst", space: "O(log n)" },
    defaultInput: [9, 2, 6, 1, 8, 3, 7, 4, 5],
    visualType: "array",
    run,
    pseudocode: [
        "start with a range [lo..hi] of the array",
        "if A[lo] > A[hi], swap the two end values",
        "set lp to A[lo] and rp to A[hi] as the two pivots",
        "partition the middle into below-lp, between, above-rp",
        "swap pivots into the boundaries of their regions",
        "recurse on the range left of the small pivot",
        "recurse on the middle range between the pivots",
        "recurse on the range right of the large pivot",
        "skip any range of zero or one element",
        "done: the whole array is sorted",
    ],
};

export default module;
