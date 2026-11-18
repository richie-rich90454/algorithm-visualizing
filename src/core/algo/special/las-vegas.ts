/**
 * las-vegas.ts – Las Vegas Algorithm (randomized quicksort)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Las Vegas algorithm is randomized but always returns the correct answer –
 * only the running time is random. The classic example is randomized
 * quicksort: it picks a random pivot each partition, which makes bad inputs
 * unlikely rather than impossible. The worst case O(n²) still exists but only
 * with negligible probability; the expected time is O(n log n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) expected, O(n²) worst (with tiny probability)
 *   Space: O(log n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The random pivot is PURPLE (pivot).
 *   - Partitioning elements are YELLOW (comparing).
 *   - The sorted result is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Randomize the input order, never the answer" is the idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build bars for the current array state.
 *
 * @param arr The array values.
 * @param states Optional index → state overrides.
 * @returns Bar entities.
 */
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

/**
 * The Las Vegas generator.
 *
 * @param input `{ array }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[] } | null) ?? {};
    const arr = [...(task.array ?? [7, 2, 9, 1, 5, 8, 3])];

    let step = 0;

    // Deterministic pseudo-random.
    let seed = 42;
    const rand = (): number => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    // Frame 0: the array.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Las Vegas quicksort on [${arr.join(", ")}] – random pivots avoid worst case.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: arr.length },
    };
    step += 1;

    // Recursive randomized quicksort.
    const quickSort = function* (lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        if (lo >= hi) {
            return;
        }

        // Pick a random pivot and swap it to the end.
        const pivotIndex = lo + Math.floor(rand() * (hi - lo + 1));
        const tmp = arr[pivotIndex];
        arr[pivotIndex] = arr[hi] ?? 0;
        arr[hi] = tmp ?? 0;
        const pivot = arr[hi] ?? 0;

        const states = new Map<number, EntityState>([[hi, "pivot"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Random pivot ${pivot} chosen – moved to index ${hi} for partitioning.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { pivot, hi },
        };
        step += 1;

        // Lomuto partition.
        let i = lo;
        for (let j = lo; j < hi; j += 1) {
            if ((arr[j] ?? 0) <= pivot) {
                const a = arr[j];
                const b = arr[i];
                if (a !== undefined && b !== undefined) {
                    arr[j] = b;
                    arr[i] = a;
                }
                i += 1;
            }
        }
        const atI = arr[i];
        const pivotVal = arr[hi];
        if (atI !== undefined && pivotVal !== undefined) {
            arr[hi] = atI;
            arr[i] = pivotVal;
        }

        const partStates = new Map<number, EntityState>([[i, "sorted"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, partStates),
            edges: [],
            description: `Partitioned around ${pivot} – pivot settled at index ${i} of ${arr.length}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { pivot, pos: i },
        };
        step += 1;

        yield* quickSort(lo, i - 1);
        yield* quickSort(i + 1, hi);
    };

    yield* quickSort(0, arr.length - 1);

    const finalStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, finalStates),
        edges: [],
        description: `Sorted [${arr.join(", ")}] in O(n log n) expected time.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { sorted: true, values: [...arr] },
    };
}

/** The Las Vegas module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A Las Vegas algorithm always returns the correct answer; only its running time is random. Randomized quicksort is the classic example: it picks a random pivot at each partition, making consistently bad partitions very unlikely. The result is always a correctly sorted array, with expected O(n log n) time.",
        "invariants": [
            "After a partition the pivot sits in its final position, with no larger element to its left and no smaller one to its right.",
            "Partitioning never changes the multiset of elements, only their order.",
            "Recursive calls always operate on disjoint subranges."
        ],
        "correctness": "Lomuto partitioning places the pivot correctly and maintains the left/right ordering invariant, so by induction each recursively sorted subarray is correct and the whole array is sorted. Randomizing the pivot does not affect correctness, since any pivot yields a valid partition; it only changes the probability of unbalanced splits.",
        "complexityRationale": "Each partition scans its subarray once, costing O(size). With random pivots the expected recursion depth is O(log n), giving expected O(n log n) time; the O(n^2) worst case occurs only with negligible probability. The recursion stack uses O(log n) expected space.",
        "uses": [
            "General-purpose sorting in standard libraries",
            "Sorting records by key in databases",
            "Depth sorting in graphics",
            "A teaching example of randomized algorithms and expected analysis"
        ],
        "references": [
            "Cormen et al., Introduction to Algorithms (CLRS), Chapter 7",
            "Motwani and Raghavan, Randomized Algorithms, Chapter 1"
        ],
        "workedExample": "On [7,2,9,1,5,8,3], a random pivot of 5 is moved to the end and partitioning puts elements at most 5 to its left and the rest to its right, fixing 5 in place. Recursing on each side with fresh random pivots eventually yields [1,2,3,5,7,8,9], always correctly sorted."
    },
    id: "las-vegas",
    name: "Las Vegas (Randomized Quicksort)",
    category: "sorting",
    complexity: { time: "O(n log n) expected", space: "O(log n)" },
    defaultInput: { array: [7, 2, 9, 1, 5, 8, 3] },
    visualType: "array",
    run,
    pseudocode: [
        "initialize array copy with deterministic random seed",
        "for each quicksort partition pick a random pivot",
        "move pivot to the end for Lomuto partitioning",
        "partition around pivot into final position",
        "recurse left and right subarrays randomly",
        "repeat until every segment is sorted",
        "done: array sorted with expected O(n log n) time",
    ],
};

export default module;
