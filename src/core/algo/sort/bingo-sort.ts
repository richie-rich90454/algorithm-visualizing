/**
 * bingo-sort.ts - Bingo Sort
 *
 * Bingo sort is a selection-sort variant tuned for inputs with repeated values.
 * It finds the smallest remaining value once, then sweeps the unsorted suffix
 * and moves every copy of that value into its final block in a single pass.
 * With many duplicates this removes a full scan per equal element.
 *
 * Time: O(n^2) worst case, O(n) when all values are equal
 * Space: O(1) auxiliary
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

function settledPrefix(count: number): Map<number, EntityState> {
    const states = new Map<number, EntityState>();
    for (let i = 0; i < count; i += 1) {
        states.set(i, "sorted");
    }
    return states;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const arr = Array.isArray(input) ? [...(input as number[])] : [5, 3, 5, 1, 4, 1, 2, 5];
    const n = arr.length;
    let step = 0;
    let comparisons = 0;
    let placements = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array for bingo sort - each pass places one whole value group.",
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, placements, size: n },
    };
    step += 1;

    let placed = 0;
    while (placed < n) {
        let minimum = arr[placed] as number;
        for (let j = placed + 1; j < n; j += 1) {
            comparisons += 1;
            if ((arr[j] as number) < minimum) {
                minimum = arr[j] as number;
            }
        }

        let next = Infinity;
        for (let j = placed; j < n; j += 1) {
            comparisons += 1;
            const value = arr[j] as number;
            if (value > minimum && value < next) {
                next = value;
            }
        }

        const scanStates = settledPrefix(placed);
        for (let j = placed; j < n; j += 1) {
            if (arr[j] === minimum) {
                scanStates.set(j, "highlight");
            }
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, scanStates),
            edges: [],
            description:
                `Bingo value is ${minimum}; the next distinct target is ` +
                `${next === Infinity ? "none" : next}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, placements, minimum, next: next === Infinity ? -1 : next },
        };
        step += 1;

        if (next === Infinity) {
            const allSorted = settledPrefix(n);
            yield {
                stepNumber: step,
                entities: makeBars(arr, allSorted),
                edges: [],
                description: `Every remaining bar equals ${minimum}, so the last group is placed.`,
                codeLineNumber: 4,
                layout: "array",
                meta: { comparisons, placements, minimum },
            };
            step += 1;
            break;
        }

        let scan = placed;
        while (scan < n) {
            if (arr[scan] === minimum) {
                if (scan !== placed) {
                    const displaced = arr[placed] as number;
                    arr[placed] = minimum;
                    arr[scan] = displaced;
                    placements += 1;
                }
                const states = settledPrefix(placed + 1);
                states.set(placed, "swapped");
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, states),
                    edges: [],
                    description: `Placed copy ${placements + 1} of value ${minimum} at index ${placed}.`,
                    codeLineNumber: 3,
                    layout: "array",
                    meta: { comparisons, placements, minimum, placed },
                };
                step += 1;
                placed += 1;
            }
            scan += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(arr, settledPrefix(n)),
        edges: [],
        description: `Array sorted with ${comparisons} comparisons and ${placements} moves.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { comparisons, placements, size: n },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Selection sort hunts for one minimum at a time, even when the same value appears many times. Bingo sort finds the next smallest value once and then sweeps the remaining bars, sliding every equal copy into its final block. A value that occurs ten times costs one group pass instead of ten full scans.",
        invariants: [
            "The prefix before the placement index contains finalized values in nondecreasing order.",
            "Every value in the suffix is at least the minimum chosen for the current group.",
            "The sweep never changes the multiset of values, only their positions.",
        ],
        correctness:
            "The chosen value is the smallest in the suffix, so every copy of it belongs before any larger value. The sweep moves all copies into consecutive final positions without disturbing already placed bars. Induction on the number of placed positions gives a fully sorted array when the loop ends.",
        complexityRationale:
            "Finding the minimum and the next value scans the suffix twice, and the sweep scans it once. With d distinct values that is at most 3dn work, which is O(n^2) in general and O(n) when every value is equal. Only a few scalar indices are kept, so auxiliary space is O(1).",
        uses: [
            "Sorting records with a small set of repeated category keys",
            "Teaching how grouping can reduce redundant comparisons",
            "A gentle bridge from selection sort to counting-based methods",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 3, Section 5.2.3",
            "Wikipedia: Bingo sort (selection sort with repeated-key optimization)",
        ],
        workedExample:
            "For [5, 3, 5, 1, 4, 1, 2, 5] the first minimum is 1 and the next target is 2. The sweep moves both 1s to the front: [1, 1, 5, 3, 4, 2, 5, 5]. The next group is 2, then 3, then 4, then the three 5s, giving [1, 1, 2, 3, 4, 5, 5, 5].",
    },
    id: "bingo-sort",
    name: "Bingo Sort",
    category: "sorting",
    complexity: { time: "O(n^2)", space: "O(1)" },
    defaultInput: [5, 3, 5, 1, 4, 1, 2, 5],
    visualType: "array",
    run,
    pseudocode: [
        "set placed to zero and read the array length",
        "find the smallest value in the unsorted suffix",
        "find the next distinct value larger than it",
        "sweep the suffix and move each copy of the smallest into place",
        "if no larger value exists, the final group is already in place",
        "done: the whole array is sorted",
    ],
};

export default module;
