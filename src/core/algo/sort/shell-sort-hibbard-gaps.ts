/**
 * shell-sort-hibbard-gaps.ts - Shell Sort with Hibbard's Gap Sequence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Shell sort compares and shifts elements that are a fixed gap apart. Hibbard's
 * gap sequence uses the Mersenne numbers 1, 3, 7, 15, 31, ... given by 2^k - 1.
 * Because consecutive gaps are relatively prime, an element moved during a
 * wide-gap pass is revisited by many later passes, which gives a proven
 * O(n^(3/2)) worst-case bound.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^(3/2)) worst case for Hibbard's sequence
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The active gap is announced at the start of each pass.
 *   - Bars compared across the gap are yellow (comparing).
 *   - A shifted bar flashes red (swapped).
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

/** Hibbard's gaps 2^k - 1 below n, largest first, always ending at 1. */
function hibbardGaps(n: number): number[] {
    const gaps: number[] = [];
    for (let k = 1; ; k += 1) {
        const gap = 2 ** k - 1;
        if (gap >= n) {
            break;
        }
        gaps.push(gap);
    }
    return gaps.reverse();
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const arr = Array.isArray(input) ? [...(input as number[])] : [23, 3, 41, 7, 11, 13, 17, 29];
    const n = arr.length;
    const gaps = hibbardGaps(n);
    let step = 0;
    let comparisons = 0;
    let shifts = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Initial array - Hibbard's gaps ${gaps.join(", ")} will be used from widest to narrowest.`,
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
            description: `Starting pass with Hibbard gap ${gap} (2^k - 1).`,
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
        description: `Array sorted with ${comparisons} comparisons and ${shifts} shifts using Hibbard's gaps.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { comparisons, shifts, gaps },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Hibbard proposed gaps of the form 2^k - 1: 1, 3, 7, 15, 31. Consecutive values are coprime, so an element displaced by a wide gap is revisited by many later passes. That extra mixing is what gives the sequence a clean worst-case guarantee rather than just good measured speed.",
        invariants: [
            "Each gap equals 2^k - 1 for some k and the final gap is 1.",
            "After a gap pass, every gap-spaced subsequence is sorted.",
            "The gap-1 pass is an ordinary insertion sort on the full array.",
        ],
        correctness:
            "Gapped insertion sorting only permutes elements inside one gap subsequence at a time, so it never breaks the internal order established by earlier passes in a way that matters for the final pass. The last pass uses gap 1 and therefore performs a standard insertion sort, which always leaves the whole array sorted.",
        complexityRationale:
            "Hibbard's sequence admits a O(n^(3/2)) worst-case bound on comparisons, better than the halving sequence. The algorithm keeps only the gap, an index, and a single held value, so auxiliary space is O(1).",
        uses: [
            "Sorting medium arrays without recursion",
            "A teaching example with a provable sub-quadratic bound",
            "Systems where a fixed, reproducible gap table is useful",
        ],
        references: [
            "Hibbard, An Improved Construction of Increment Sequences, 1963",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.1",
        ],
        workedExample:
            "For an array of length 8 the Hibbard gaps below 8 are 1, 3, 7. The gap-7 pass compares positions 0 and 7, gap 3 sorts three interleaved subsequences, and gap 1 finishes the array with only a few adjacent shifts.",
    },
    id: "shell-sort-hibbard-gaps",
    name: "Shell Sort (Hibbard Gaps)",
    category: "sorting",
    complexity: { time: "O(n^(3/2))", space: "O(1)" },
    defaultInput: [23, 3, 41, 7, 11, 13, 17, 29],
    visualType: "array",
    run,
    pseudocode: [
        "build Hibbard's gaps 2^k - 1 down to 1",
        "begin a pass with the next gap",
        "pick a key and compare across the gap",
        "if the left element is larger, shift it right by gap",
        "insert the key and advance to the next index",
        "move to a smaller gap after finishing the pass",
        "done: array is fully sorted",
    ],
};

export default module;
