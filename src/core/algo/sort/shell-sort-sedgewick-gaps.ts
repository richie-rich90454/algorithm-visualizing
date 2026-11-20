/**
 * shell-sort-sedgewick-gaps.ts - Shell Sort with Sedgewick's Gap Sequence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Shell sort performs a gapped insertion sort for a shrinking series of gaps.
 * This module uses Sedgewick's sequence h(k) = 4^k + 3*2^(k-1) + 1, which
 * yields 1, 8, 23, 77, 281, ... The sequence has a proven O(n^(4/3)) worst
 * case and a simple closed form, unlike empirical tables. Wide early passes
 * move values long distances so the final gap-1 insertion pass is nearly free.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^(4/3)) worst case for Sedgewick's sequence
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

/** Sedgewick's gap sequence below n, largest first, ending at gap 1. */
function sedgewickGaps(n: number): number[] {
    const gaps: number[] = [1];
    for (let k = 1; k < 40; k += 1) {
        const gap = 4 ** k + 3 * 2 ** (k - 1) + 1;
        if (gap >= n) break;
        gaps.push(gap);
    }
    return gaps.reverse();
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const arr = Array.isArray(input) ? [...(input as number[])] : [23, 3, 41, 7, 11, 13, 17, 29, 2, 19, 31, 5, 37, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113];
    const n = arr.length;
    const gaps = sedgewickGaps(n);
    let step = 0;
    let comparisons = 0;
    let shifts = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Initial array - Sedgewick gaps ${gaps.join(", ")} will be used from widest to narrowest.`,
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
            description: `Starting pass with Sedgewick gap ${gap}.`,
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
        description: `Array sorted with ${comparisons} comparisons and ${shifts} shifts using Sedgewick's gaps.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { comparisons, shifts, gaps },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Sedgewick derived a gap sequence from a closed formula instead of an empirical table: 4^k + 3*2^(k-1) + 1 gives 1, 8, 23, 77, 281 and so on. Shell sort runs insertion sort at each spacing from largest down to one. The wide passes let small values jump toward the front early, so the final ordinary insertion pass has little left to do.",
        invariants: [
            "Every gap is strictly smaller than the array length and the last gap is 1.",
            "After a gap pass, each subsequence of indices spaced by that gap is sorted.",
            "The final gap-1 pass is an ordinary insertion sort on the whole array.",
        ],
        correctness:
            "A gapped insertion pass sorts every subsequence separated by the gap while leaving other subsequences untouched, so it never destroys earlier progress. Because the sequence ends at gap 1, the last pass is an insertion sort over the entire array, which is correct for any starting order; earlier passes only reduce the number of shifts it performs.",
        complexityRationale:
            "Sedgewick's sequence has a proven O(n^(4/3)) worst-case comparison bound. Only the current gap, an index, and a single held key are kept in addition to the array, so auxiliary space is O(1).",
        uses: [
            "Sorting medium arrays with a small, recursion-free routine",
            "Embedding a sort in memory-constrained firmware",
            "Demonstrating how a gap formula affects sort performance",
        ],
        references: [
            "Sedgewick, Algorithms, 3rd edition, Shellsort chapter",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.1",
        ],
        workedExample:
            "For thirty values the Sedgewick gaps below 30 are 1, 8, 23. The gap-23 pass compares elements twenty-three apart, gap 8 refines the order, and gap 1 finishes the array in ascending order.",
    },
    id: "shell-sort-sedgewick-gaps",
    name: "Shell Sort (Sedgewick Gaps)",
    category: "sorting",
    complexity: { time: "O(n^(4/3)) worst case", space: "O(1)" },
    defaultInput: [23, 3, 41, 7, 11, 13, 17, 29, 2, 19, 31, 5, 37, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113],
    visualType: "array",
    run,
    pseudocode: [
        "build Sedgewick's gap sequence down to gap 1",
        "begin a pass with the next gap",
        "pick a key and compare across the gap",
        "if the left element is larger, shift it right by gap",
        "insert the key and advance to the next index",
        "move to a smaller gap after finishing the pass",
        "done: array is fully sorted",
    ],
};

export default module;
