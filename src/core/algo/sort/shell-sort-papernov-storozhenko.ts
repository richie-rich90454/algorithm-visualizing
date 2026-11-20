/**
 * shell-sort-papernov-storozhenko.ts - Shell Sort with Papernov-Storozhenko Gaps
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Shell sort runs insertion sort over a shrinking sequence of gaps. This module
 * uses the Papernov-Storozhenko sequence, whose consecutive ratios approach
 * 2.25: 1, 3, 7, 16, 35, 79, 177, 397, ... Its smooth, slowly growing gaps were
 * designed to keep the number of comparisons low, and the sequence admits a
 * sub-quadratic worst-case bound. Wide passes move elements far before the
 * final gap-1 insertion pass.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^(3/2)) worst case for Papernov-Storozhenko gaps
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars compared across the gap are yellow (comparing).
 *   - A shifted bar flashes red (swapped).
 *   - The final frame shows every bar green (sorted).
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

/** Papernov-Storozhenko gaps below n, largest first, ending at gap 1. */
function papernovStorozhenkoGaps(n: number): number[] {
    const known = [1, 3, 7, 16, 35, 79, 177, 397, 893, 2009, 4519, 10169, 22881, 51483];
    const gaps: number[] = [];
    let last = 1;
    for (const gap of known) {
        if (gap >= n) break;
        gaps.push(gap);
        last = gap;
    }
    while (last < n && gaps.length < 40) {
        last = Math.floor(last * 2.25) + 1;
        if (last >= n) break;
        gaps.push(last);
    }
    return gaps.reverse();
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const arr = Array.isArray(input) ? [...(input as number[])] : [23, 3, 41, 7, 11, 13, 17, 29, 2, 19, 31, 5, 37, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113];
    const n = arr.length;
    const gaps = papernovStorozhenkoGaps(n);
    let step = 0;
    let comparisons = 0;
    let shifts = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Initial array - Papernov-Storozhenko gaps ${gaps.join(", ")} will be used from widest to narrowest.`,
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
            description: `Starting pass with Papernov-Storozhenko gap ${gap}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, shifts, gap, gaps },
        };
        step += 1;

        for (let i = gap; i < n; i += 1) {
            const key = arr[i];
            if (key === undefined) continue;
            let j = i;
            while (j - gap >= 0) {
                const left = arr[j - gap];
                if (left === undefined) break;
                comparisons += 1;
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, new Map<number, EntityState>([[j - gap, "comparing"], [i, "highlight"]])),
                    edges: [],
                    description: `Gap ${gap}: comparing key ${key} with ${left} one gap to the left.`,
                    codeLineNumber: 3,
                    layout: "array",
                    meta: { comparisons, shifts, gap, gaps },
                };
                step += 1;

                if (left <= key) break;
                arr[j] = left;
                shifts += 1;
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, new Map<number, EntityState>([[j, "swapped"], [j - gap, "highlight"]])),
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
        description: `Array sorted with ${comparisons} comparisons and ${shifts} shifts using Papernov-Storozhenko gaps.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { comparisons, shifts, gaps },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Papernov and Storozhenko chose gaps whose successive ratios approach 2.25, giving 1, 3, 7, 16, 35, 79, 177 and so on. Shell sort applies insertion sort at each of these spacings from largest to smallest. The nearly geometric growth spreads small values toward the front in a handful of passes, leaving the final gap-1 pass with very little work.",
        invariants: [
            "Each gap is strictly below the array length and the sequence ends at gap 1.",
            "After a gap pass, every subsequence spaced by that gap is in sorted order.",
            "Once the gap-1 pass completes, the entire array is sorted.",
        ],
        correctness:
            "An insertion pass at gap g sorts each of the g interleaved subsequences independently, so it cannot undo the ordering produced by earlier passes. The last pass uses gap 1, which is an ordinary insertion sort of the whole array and is correct for any input; earlier passes only reduce the remaining disorder.",
        complexityRationale:
            "The bound on the sum of the gaps gives a sub-quadratic worst case of about O(n^(3/2)) for this sequence. The algorithm keeps only a gap, an index, and one held key beyond the array itself, so it uses O(1) extra space.",
        uses: [
            "Sorting when a simple in-place routine is preferred",
            "A case study in how gap ratios influence comparison counts",
            "Teaching shell sort with a theoretically motivated sequence",
        ],
        references: [
            "Papernov and Storozhenko, A Method of Information Sorting in Computer Memories, 1965",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.1",
        ],
        workedExample:
            "For thirty values the Papernov-Storozhenko gaps below 30 are 1, 3, 7, 16. The gap-16 pass compares widely separated elements, gaps 7 and 3 refine the order, and the gap-1 pass leaves the array fully ascending.",
    },
    id: "shell-sort-papernov-storozhenko",
    name: "Shell Sort (Papernov-Storozhenko Gaps)",
    category: "sorting",
    complexity: { time: "O(n^(3/2)) worst case", space: "O(1)" },
    defaultInput: [23, 3, 41, 7, 11, 13, 17, 29, 2, 19, 31, 5, 37, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113],
    visualType: "array",
    run,
    pseudocode: [
        "build Papernov-Storozhenko gaps down to gap 1",
        "begin a pass with the next gap",
        "pick a key and compare across the gap",
        "if the left element is larger, shift it right by gap",
        "insert the key and advance to the next index",
        "move to a smaller gap after finishing the pass",
        "done: array is fully sorted",
    ],
};

export default module;
