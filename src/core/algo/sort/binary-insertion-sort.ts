/**
 * binary-insertion-sort.ts - Binary Insertion Sort
 *
 * Insertion sort that finds the insertion slot with binary search instead of a
 * linear scan. The number of comparisons drops from O(n) to O(log n) per
 * element, while the elements still have to be shifted one by one, so the
 * total time stays O(n^2). Using an upper bound keeps the sort stable.
 *
 * Time O(n^2), space O(1), stable.
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
    const arr = Array.isArray(input) ? [...(input as number[])] : [5, 1, 4, 2, 5, 3];
    let step = 0;
    let comparisons = 0;
    let shifts = 0;

    const frame = (
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(arr, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { comparisons, shifts, ...extra },
    });

    yield frame(new Map(), "Binary insertion sort: start with a sorted prefix of one element.", 0);
    step += 1;

    for (let i = 1; i < arr.length; i += 1) {
        const key = arr[i];
        if (key === undefined) {
            continue;
        }
        yield frame(new Map([[i, "comparing"]]), `Selecting ${key} for insertion into the sorted prefix.`, 1, { i });
        step += 1;

        let lo = 0;
        let hi = i;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            const probe = arr[mid];
            comparisons += 1;
            const goRight = probe !== undefined && probe <= key;
            const probeStates = new Map<number, EntityState>([
                [i, "highlight"],
                [mid, "comparing"],
            ]);
            yield frame(
                probeStates,
                `Binary probe at ${mid} (value ${probe}): search the ${goRight ? "upper" : "lower"} half.`,
                3,
                { i, lo, hi, mid },
            );
            step += 1;
            if (goRight) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        const pos = lo;

        for (let j = i; j > pos; j -= 1) {
            const moving = arr[j - 1];
            if (moving === undefined) {
                continue;
            }
            arr[j] = moving;
            shifts += 1;
            yield frame(
                new Map([
                    [j, "swapped"],
                    [i, "highlight"],
                ]),
                `Shifting ${moving} right to open slot ${pos}.`,
                4,
                { i, pos },
            );
            step += 1;
        }
        arr[pos] = key;

        const prefix = new Map<number, EntityState>();
        for (let k = 0; k <= i; k += 1) {
            prefix.set(k, "sorted");
        }
        yield frame(prefix, `Placed ${key} at slot ${pos}; the prefix of ${i + 1} values is sorted.`, 5, { i, pos });
        step += 1;
    }

    const done = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"] as [number, EntityState]));
    yield frame(
        done,
        `Sorted ${arr.length} values with ${comparisons} binary comparisons and ${shifts} shifts.`,
        7,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Keep the left part sorted, and insert each new value into it. Finding the insertion slot by binary search examines only log(n) positions instead of scanning the whole prefix. The values after the slot still have to slide right one at a time, so the search improvement does not change the quadratic worst case.",
        invariants: [
            "The prefix before index i is always sorted.",
            "Binary search locates the first slot whose value is greater than the key, which keeps equal values in their original order.",
            "Every element of the original array is present exactly once, either in the prefix or in the unprocessed suffix.",
        ],
        correctness:
            "Binary search on a sorted prefix returns the unique stable insertion point. Shifting the larger values right and writing the key into that slot restores the sorted-prefix invariant without losing any element. When the prefix grows to the full array, the whole array is sorted, and using the upper bound makes the sort stable.",
        complexityRationale:
            "Each of the n insertions spends O(log n) comparisons in binary search and up to O(n) value moves, so total time is O(n^2) with O(n log n) comparisons. Only the key and a few indices are kept, giving O(1) auxiliary space.",
        uses: [
            "Reducing comparisons when comparisons are expensive but moves are cheap",
            "Sorting small runs inside library and hybrid sorts",
            "A teaching example of combining binary search with insertion",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 3, Section 5.2.1",
            "Sedgewick and Wayne, Algorithms, Section 2.1",
        ],
        workedExample:
            "For [5, 1, 4] the key 1 binary-searches the prefix [5] and lands at slot 0, giving [1, 5, 4]. The key 4 probes index 0, then slot 2, and is inserted at slot 1, giving the sorted [1, 4, 5].",
    },
    id: "binary-insertion-sort",
    name: "Binary Insertion Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    defaultInput: [5, 1, 4, 2, 5, 3],
    visualType: "array",
    run,
    pseudocode: [
        "start with the prefix A[0] trivially sorted",
        "key ← A[i], the next element to place",
        "set lo ← 0 and hi ← i for the sorted prefix",
        "probe mid; move lo or hi to bracket the key",
        "shift values from the insertion slot right by one",
        "write key into the slot and grow the prefix",
        "repeat for every element of the array",
        "done: array is sorted and equal keys keep their order",
    ],
};

export default module;
