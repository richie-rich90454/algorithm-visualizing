/**
 * squaresort.ts – Square Sort (Square-Root Gap Sort)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Square sort is a gapped insertion sort whose gap sequence is derived from
 * the square root of the array length. The first pass uses a gap near the
 * square root of n, and the gap shrinks by one until it reaches one. A final
 * gap-one insertion pass guarantees the array is sorted, while the earlier
 * large-gap passes move far-flung values toward their final positions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * sqrt(n)) with this gap sequence
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The value being inserted is YELLOW.
 *   - The gap neighbor it is compared with is PINK.
 *   - Shifted values flash RED.
 *   - The final pass leaves the array GREEN.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - In place and terminates because the gap reaches one.
 *   - Not stable, since gapped shifts can jump over equal keys.
 * ---------------------------------------------------------------------------
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
    const arr = Array.isArray(input) ? [...(input as number[])] : [9, 2, 6, 1, 8, 3, 7, 4, 5];
    const n = arr.length;
    let step = 0;
    let comparisons = 0;
    let shifts = 0;
    let gap = Math.floor(Math.sqrt(n));

    const frame = (description: string, states: Map<number, EntityState>, codeLineNumber: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeBars(arr, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { comparisons, shifts, gap },
    });

    yield frame(`Square sort starts with gap ${gap}, the square root of ${n}.`, new Map(), 0);

    while (gap >= 1) {
        for (let i = gap; i < n; i += 1) {
            const value = arr[i] as number;
            let j = i;
            comparisons += 1;
            yield frame(
                `Gap ${gap}: consider index ${i} (value ${value}) against index ${i - gap}.`,
                new Map<number, EntityState>([
                    [i, "comparing"],
                    [i - gap, "highlight"],
                ]),
                2,
            );
            while (j >= gap && (arr[j - gap] as number) > value) {
                arr[j] = arr[j - gap] as number;
                shifts += 1;
                comparisons += 1;
                j -= gap;
                yield frame(
                    `Gap ${gap}: shift value ${arr[j] as number} right into index ${j + gap}.`,
                    new Map<number, EntityState>([
                        [j, "swapped"],
                        [j + gap, "swapped"],
                    ]),
                    3,
                );
            }
            arr[j] = value;
        }
        gap -= 1;
    }

    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted" as EntityState]));
    yield frame(
        `Array sorted with ${comparisons} comparisons and ${shifts} shifts.`,
        sortedStates,
        6,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Square sort performs insertion sort at a sequence of gaps rather than only at gap one. It starts with a gap about the square root of the length and decreases the gap by one until it reaches one. Large gaps move values long distances quickly; the final gap-one pass finishes the job with ordinary insertion sort.",
        invariants: [
            "For a fixed gap, the subsequence of elements at indices congruent modulo the gap is insertion sorted after that pass.",
            "The gap strictly decreases and always ends at one.",
            "Every operation preserves the multiset of values in the array.",
        ],
        correctness:
            "Each gap pass insertion sorts every gap-separated subsequence, which can only reduce the number of inversions at that spacing. Because the sequence always includes gap one, the last pass is a standard insertion sort that produces a fully sorted array regardless of earlier passes.",
        complexityRationale:
            "The number of gaps is about the square root of n, and each gap pass costs O(n) shifts in the worst case, giving O(n sqrt n) time. Only a single held value is stored per insertion, so space is O(1).",
        uses: [
            "In-place sorting when a simple gap heuristic is acceptable",
            "Demonstrating how gap sequences generalize insertion sort",
            "A lightweight teaching alternative to full shell sort",
        ],
        references: [
            "Shell, A High-Speed Sorting Procedure, 1959",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.1",
        ],
        workedExample:
            "On [9, 2, 6, 1, 8] with gap two, index 2 compares 6 with 9 and stays, index 3 compares 1 with 2 and shifts, and index 4 compares 8 with 6. Gap one then insertion sorts the nearly ordered result into [1, 2, 6, 8, 9].",
    },
    id: "squaresort",
    name: "Square Sort",
    category: "sorting",
    complexity: { time: "O(n sqrt n)", space: "O(1)" },
    defaultInput: [9, 2, 6, 1, 8, 3, 7, 4, 5],
    visualType: "array",
    run,
    pseudocode: [
        "start with gap ← floor of the square root of n",
        "while gap is at least one",
        "for i ← gap to n-1, hold A[i] as the value to insert",
        "while the gap neighbor is larger, shift it right",
        "place the held value at its gap-correct position",
        "decrease gap by one",
        "done: the gap-one pass leaves the array sorted",
    ],
};

export default module;
