/**
 * shell-sort-tokuda-gaps.ts - Shell Sort with Tokuda's Gap Sequence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Shell sort performs gapped insertion passes from a wide spacing down to one.
 * Tokuda's sequence starts at 1 and grows each term by the recurrence
 * gap <- floor(2.25 * gap) + 1, giving 1, 3, 7, 16, 37, 84, 190, ... This
 * multiplier has the best proven worst-case bound of the common practical
 * sequences, O(n^(4/3)), while keeping the number of passes small.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^(4/3)) worst case for Tokuda's sequence
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The active Tokuda gap is named in the pass caption.
 *   - Yellow bars are compared across the gap.
 *   - Red bars are shifted right; the final frame is all green.
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

/** Tokuda's gaps from the 2.25 recurrence below n, largest first. */
function tokudaGaps(n: number): number[] {
    const gaps: number[] = [];
    let gap = 1;
    while (gap < n) {
        gaps.push(gap);
        gap = Math.floor(gap * 2.25) + 1;
    }
    return gaps.reverse();
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const arr = Array.isArray(input) ? [...(input as number[])] : [23, 3, 41, 7, 11, 13, 17, 29];
    const n = arr.length;
    const gaps = tokudaGaps(n);
    let step = 0;
    let comparisons = 0;
    let shifts = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Initial array - Tokuda's gaps ${gaps.join(", ")} will be used from widest to narrowest.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, shifts, gaps },
    };
    step += 1;

    for (const gap of gaps) {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `Starting pass with Tokuda gap ${gap}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, shifts, gap, gaps },
        };
        step += 1;

        for (let i = gap; i < n; i += 1) {
            const key = arr[i];
            if (key === undefined) {
                continue;
            }
            let j = i;
            while (j - gap >= 0) {
                const left = arr[j - gap];
                if (left === undefined) {
                    break;
                }
                comparisons += 1;
                const compareStates = new Map<number, EntityState>([
                    [j - gap, "comparing"],
                    [i, "highlight"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, compareStates),
                    edges: [],
                    description: `Gap ${gap}: comparing key ${key} with ${left} one gap to the left.`,
                    codeLineNumber: 3,
                    layout: "array",
                    meta: { comparisons, shifts, gap, gaps },
                };
                step += 1;

                if (left <= key) {
                    break;
                }
                arr[j] = left;
                shifts += 1;
                const shiftStates = new Map<number, EntityState>([
                    [j, "swapped"],
                    [j - gap, "highlight"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, shiftStates),
                    edges: [],
                    description: `Gap ${gap}: shifting ${left} right by ${gap} positions.`,
                    codeLineNumber: 4,
                    layout: "array",
                    meta: { comparisons, shifts, gap, gaps },
                };
                step += 1;
                j -= gap;
            }
            arr[j] = key;
        }
    }

    const finalStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, finalStates),
        edges: [],
        description: `Array sorted with ${comparisons} comparisons and ${shifts} shifts using Tokuda's gaps.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { comparisons, shifts, gaps },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Tokuda refined the gap multiplier used by Shell sort to about 2.25. Starting from 1, each next gap is floor(2.25 * gap) + 1, producing 1, 3, 7, 16, 37, 84. That growth rate is the key to a proven O(n^(4/3)) worst case, better than the classic halving gaps, while still needing only a handful of passes.",
        invariants: [
            "Gaps are generated by the 2.25 recurrence and always end at 1.",
            "After a pass, each gap-spaced subsequence is sorted.",
            "The gap-1 pass is a full insertion sort of the whole array.",
        ],
        correctness:
            "Every gapped insertion pass sorts the indices at distance gap without corrupting the relative order needed by the final pass. Since gap 1 is always included, the last pass is an ordinary insertion sort, which is correct regardless of the array's state when it begins.",
        complexityRationale:
            "Tokuda proved an O(n^(4/3)) worst-case bound for this multiplier sequence, the best among the simple practical gap rules. The implementation uses only a gap variable, an index, and one key value, so auxiliary space is O(1).",
        uses: [
            "An in-place sort with a strong theoretical bound",
            "Sorting integer arrays in memory-constrained code",
            "Comparing gap-growth rules in a sorting lesson",
        ],
        references: [
            "Tokuda, An Improved Shellsort Algorithm, 2011",
            "Sedgewick, Analysis of Shellsort and Related Algorithms, 1996",
        ],
        workedExample:
            "For an array of length 10 the Tokuda gaps below 10 are 1, 3, 7. The gap-7 pass compares three pairs, gap 3 sorts three interleaved subsequences, and the final gap-1 pass leaves the array fully sorted.",
    },
    id: "shell-sort-tokuda-gaps",
    name: "Shell Sort (Tokuda Gaps)",
    category: "sorting",
    complexity: { time: "O(n^(4/3))", space: "O(1)" },
    defaultInput: [23, 3, 41, 7, 11, 13, 17, 29],
    visualType: "array",
    run,
    pseudocode: [
        "build Tokuda's 2.25 gaps down to 1",
        "begin a pass with the next gap",
        "pick a key and compare across the gap",
        "if the left element is larger, shift it right by gap",
        "insert the key and advance to the next index",
        "move to a smaller gap after finishing the pass",
        "done: array is fully sorted",
    ],
};

export default module;
