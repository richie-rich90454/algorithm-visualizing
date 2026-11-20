/**
 * shell-sort-knuth-gaps.ts - Shell Sort with Knuth's Gap Sequence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Shell sort is insertion sort performed at a series of decreasing spacings.
 * Knuth's gaps are (3^k - 1) / 2: 1, 4, 13, 40, 121, ... The roughly 3-to-1
 * ratio between successive gaps is close to the value that minimizes the
 * number of passes needed to bring elements near their final positions, and it
 * gives a O(n^(3/2)) worst-case bound.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^(3/2)) worst case for Knuth's sequence
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current gap is shown in each pass caption.
 *   - Yellow bars are being compared across the gap.
 *   - Red bars are being shifted to the right.
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

/** Knuth's gaps (3^k - 1)/2 below n, largest first, always ending at 1. */
function knuthGaps(n: number): number[] {
    const gaps: number[] = [];
    for (let k = 1; ; k += 1) {
        const gap = Math.floor((3 ** k - 1) / 2);
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
    const gaps = knuthGaps(n);
    let step = 0;
    let comparisons = 0;
    let shifts = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Initial array - Knuth's gaps ${gaps.join(", ")} will be used from widest to narrowest.`,
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
            description: `Starting pass with Knuth gap ${gap} = (3^k - 1) / 2.`,
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
        description: `Array sorted with ${comparisons} comparisons and ${shifts} shifts using Knuth's gaps.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { comparisons, shifts, gaps },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Knuth's sequence grows each gap by a factor of about three: 1, 4, 13, 40, 121. Shell sort applies insertion sort at each spacing, largest first. The 3-to-1 growth means only a logarithmic number of passes, while the wide early passes move elements close to their final positions.",
        invariants: [
            "Each gap has the form (3^k - 1)/2 and the sequence ends at gap 1.",
            "After each pass, every gap-spaced subsequence is sorted.",
            "The final gap-1 pass produces a fully sorted array.",
        ],
        correctness:
            "Insertion sorting a gap subsequence changes only that subsequence, so earlier progress is preserved across passes. Because the sequence includes gap 1, the last pass is a complete insertion sort; insertion sort is correct on every input, hence the array is sorted when it ends.",
        complexityRationale:
            "Knuth's gaps give a O(n^(3/2)) worst-case comparison bound, with only O(log n) passes. The algorithm stores a gap, an index, and a single key value, so it needs O(1) auxiliary space.",
        uses: [
            "A compact in-place sort for medium arrays",
            "Demonstrating how the gap ratio affects Shell sort",
            "Teaching a sequence with a clean worst-case proof",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.1",
            "Shell, A High-Speed Sorting Procedure, Communications of the ACM, 1959",
        ],
        workedExample:
            "For an array of length 20 the Knuth gaps below 20 are 1, 4, 13. The gap-13 pass compares only seven pairs, the gap-4 pass sorts five interleaved subsequences, and the gap-1 pass finishes the job on an almost-sorted array.",
    },
    id: "shell-sort-knuth-gaps",
    name: "Shell Sort (Knuth Gaps)",
    category: "sorting",
    complexity: { time: "O(n^(3/2))", space: "O(1)" },
    defaultInput: [23, 3, 41, 7, 11, 13, 17, 29],
    visualType: "array",
    run,
    pseudocode: [
        "build Knuth's gaps (3^k - 1)/2 down to 1",
        "begin a pass with the next gap",
        "pick a key and compare across the gap",
        "if the left element is larger, shift it right by gap",
        "insert the key and advance to the next index",
        "move to a smaller gap after finishing the pass",
        "done: array is fully sorted",
    ],
};

export default module;
