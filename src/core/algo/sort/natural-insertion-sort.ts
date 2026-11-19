/**
 * natural-insertion-sort.ts - Natural Insertion Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Plain insertion sort shifts every displaced element even when much of the
 * input is already ordered. Natural insertion sort first notices an ascending
 * run: if the next element is already at least as large as its predecessor,
 * the run simply extends and nothing moves. Only a real inversion triggers
 * the usual shift-and-insert. On nearly sorted data this saves most writes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) worst case, O(n) on already sorted input
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Elements in the growing sorted prefix turn green.
 *   - A value that fits in place extends the run (pink highlight).
 *   - Shifted elements flash red; the held value is yellow.
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
    const task = (input as { array?: number[] } | null) ?? {};
    const arr = Array.isArray(task.array) ? [...task.array] : [3, 4, 2, 1, 8, 7, 9];
    const n = arr.length;
    let step = 0;
    let shifts = 0;
    let runExtensions = 0;

    const snap = (
        description: string,
        codeLineNumber: number,
        states: Map<number, EntityState>,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(arr, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { shifts, runExtensions, n },
    });
    const sortedPrefix = (upTo: number, extra: Map<number, EntityState> = new Map()): Map<number, EntityState> => {
        const s = new Map<number, EntityState>(extra);
        for (let i = 0; i < upTo; i += 1) s.set(i, "sorted");
        return s;
    };

    yield snap("Initial array; ascending runs will be preserved.", 0, new Map());
    step += 1;

    for (let i = 1; i < n; i += 1) {
        const current = arr[i] as number;
        const previous = arr[i - 1] as number;
        if (current >= previous) {
            runExtensions += 1;
            yield snap(
                `${current} is not smaller than ${previous}; the ascending run extends to position ${i}.`,
                2,
                sortedPrefix(i + 1, new Map([[i, "highlight"]])),
            );
            step += 1;
            continue;
        }

        yield snap(
            `Inversion found: ${current} is smaller than ${previous}, so insert it leftward.`,
            3,
            sortedPrefix(i, new Map([[i, "active"]])),
        );
        step += 1;

        let j = i - 1;
        while (j >= 0 && (arr[j] as number) > current) {
            arr[j + 1] = arr[j] as number;
            shifts += 1;
            yield snap(
                `Shifting ${arr[j]} one slot right to open a gap for ${current}.`,
                4,
                sortedPrefix(i, new Map([[j, "swapped"], [i, "active"]])),
            );
            step += 1;
            j -= 1;
        }
        arr[j + 1] = current;
        yield snap(
            `Placed ${current} at position ${j + 1}.`,
            5,
            sortedPrefix(i + 1, new Map([[j + 1, "active"]])),
        );
        step += 1;
    }

    const all = new Map<number, EntityState>();
    for (let i = 0; i < n; i += 1) all.set(i, "sorted");
    yield snap(`Sorted with ${shifts} shift(s) and ${runExtensions} run extension(s).`, 7, all);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An insertion sort keeps a sorted prefix and slides each new value into place. If the array already contains rising stretches, forcing those values to move is wasted effort. Natural insertion sort notices when a value already continues the rising stretch and leaves it exactly where it is, dropping into the shift-and-insert routine only when it meets a genuine inversion.",
        invariants: [
            "The prefix arr[0..i] is sorted after position i is processed.",
            "A value is shifted only when it is strictly greater than the value being inserted.",
            "Extending a run never moves an existing element.",
        ],
        correctness:
            "At index i, if arr[i] is at least arr[i-1] and the prefix arr[0..i-1] is sorted by induction, then arr[0..i] is already sorted and no work is needed. Otherwise the inner loop shifts exactly those prefix elements greater than the held value x until it reaches a position j with arr[j] at most x, then writes x at j+1. The prefix remains sorted because all shifted values are greater than x and all values at or before j are at most x. By induction the whole array is sorted at the end.",
        complexityRationale:
            "Each inversion causes one shift, so the worst case is the n(n-1)/2 shifts of ordinary insertion sort, O(n^2). When the input is already sorted every step extends a run, costing one comparison each for O(n) time. Only the held value and a few indices are kept, so space is O(1).",
        uses: [
            "Sorting logs or sensor feeds that arrive nearly in order",
            "Incremental sorting where each new record is usually the largest",
            "A gentle teaching bridge between insertion sort and adaptive sorts",
        ],
        references: [
            "Knuth, The Art of Computer Programming Vol. 3, Section 5.1",
            "Sedgewick and Wayne, Algorithms, 4th Edition, Chapter 2",
        ],
        workedExample:
            "For [3, 4, 2, 1], 4 extends the run after 3 with no movement. The value 2 is an inversion, so 4 and 3 each shift right once and 2 is inserted at the front, giving [2, 3, 4, 1]. Finally 1 shifts three elements to land at the front, yielding [1, 2, 3, 4].",
    },
    id: "natural-insertion-sort",
    name: "Natural Insertion Sort",
    category: "sorting",
    complexity: { time: "O(n^2) worst, O(n) sorted", space: "O(1)" },
    defaultInput: { array: [3, 4, 2, 1, 8, 7, 9] },
    visualType: "array",
    run,
    pseudocode: [
        "treat the first element as a sorted prefix of length one",
        "for i from 1 to n-1",
        "if array[i] is at least array[i-1], extend the run and continue",
        "otherwise hold array[i] as the value to insert",
        "shift each larger element in the prefix one position right",
        "place the held value in the opened gap",
        "advance to the next element",
        "done: the whole array is sorted",
    ],
};

export default module;
