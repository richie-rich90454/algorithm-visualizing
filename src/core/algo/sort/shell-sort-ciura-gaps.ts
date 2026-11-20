/**
 * shell-sort-ciura-gaps.ts - Shell Sort with Ciura's Gap Sequence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Shell sort runs insertion sort across a shrinking sequence of gaps. This
 * module uses Ciura's sequence, which was found empirically to minimize the
 * number of comparisons for medium-sized arrays: 1, 4, 10, 23, 57, 132, 301,
 * 701, 1750, ... Beyond 1750 the sequence is extended by the same 2.25 growth
 * factor. The wide early passes spread small values toward the front and large
 * values toward the back, so the final gap-1 pass has very little shifting to
 * do.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^(4/3)) typical for Ciura's sequence
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars being compared across the gap are yellow (comparing).
 *   - A shifted bar flashes red (swapped).
 *   - A finished frame shows every bar green (sorted).
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

/** Ciura's gap sequence, largest first, with all gaps strictly below n. */
function ciuraGaps(n: number): number[] {
    const known = [1, 4, 10, 23, 57, 132, 301, 701, 1750, 4202, 10086, 24207, 58126];
    const gaps: number[] = [];
    let last = 1;
    for (const gap of known) {
        if (gap >= n) {
            break;
        }
        gaps.push(gap);
        last = gap;
    }
    while (last < n) {
        last = Math.floor(last * 2.25) + 1;
        if (last >= n) {
            break;
        }
        gaps.push(last);
    }
    return gaps.reverse();
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const arr = Array.isArray(input) ? [...(input as number[])] : [23, 3, 41, 7, 11, 13, 17, 29];
    const n = arr.length;
    const gaps = ciuraGaps(n);
    let step = 0;
    let comparisons = 0;
    let shifts = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Initial array - Ciura's gaps ${gaps.join(", ")} will be used from widest to narrowest.`,
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
            description: `Starting pass with Ciura gap ${gap}.`,
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
        description: `Array sorted with ${comparisons} comparisons and ${shifts} shifts using Ciura's gaps.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { comparisons, shifts, gaps },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Ciura found a short gap sequence by experiment: 1, 4, 10, 23, 57, 132, 301, 701, 1750. Shell sort applies insertion sort at each of these spacings, from largest down to one. Wide gaps let values travel long distances in a few moves, so the last ordinary insertion pass starts from an almost-sorted array.",
        invariants: [
            "Every gap used is strictly smaller than the array length and the sequence ends at gap 1.",
            "After a gap pass, every gap-spaced subsequence is in sorted order.",
            "When the gap-1 pass finishes, the whole array is sorted.",
        ],
        correctness:
            "A gapped insertion pass sorts each subsequence of indices separated by the gap without disturbing other subsequences. Because the final pass uses gap 1, it is an ordinary insertion sort on the entire array, which is correct for any starting order; earlier passes only reduce the work it must do.",
        complexityRationale:
            "Ciura's sequence is not proven optimal but extensive measurements show about O(n^(4/3)) comparisons for practical sizes. Only the gap, an index, and one held value are stored, giving O(1) extra space.",
        uses: [
            "Sorting medium arrays with a very short implementation",
            "Embedded systems that cannot afford recursion or a buffer",
            "Teaching how a gap sequence changes sort performance",
        ],
        references: [
            "Ciura, Best Increments for the Average Case of Shellsort, 2001",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.1",
        ],
        workedExample:
            "For [23, 3, 41, 7, 11, 13, 17, 29] the Ciura gaps below 8 are 1, 4. The gap-4 pass compares (23,11), (3,13), (41,17), (7,29), and the gap-1 pass finishes the array as [3, 7, 11, 13, 17, 23, 29, 41].",
    },
    id: "shell-sort-ciura-gaps",
    name: "Shell Sort (Ciura Gaps)",
    category: "sorting",
    complexity: { time: "O(n^(4/3)) typical", space: "O(1)" },
    defaultInput: [23, 3, 41, 7, 11, 13, 17, 29],
    visualType: "array",
    run,
    pseudocode: [
        "build Ciura's gap sequence down to gap 1",
        "begin a pass with the next gap",
        "pick a key and compare across the gap",
        "if the left element is larger, shift it right by gap",
        "insert the key and advance to the next index",
        "move to a smaller gap after finishing the pass",
        "done: array is fully sorted",
    ],
};

export default module;
