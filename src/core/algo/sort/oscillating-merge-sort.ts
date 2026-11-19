/**
 * oscillating-merge-sort.ts – Oscillating Merge Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Oscillating merge sort is a bottom-up merge sort whose merging direction
 * alternates between passes. One pass merges runs left to right, the next
 * merges them right to left, and the pattern repeats as the run width doubles.
 * The alternating direction keeps the distribution of data movement more even
 * and is the classic way to visualize bottom-up merging as a swing.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) in every case
 *   Space: O(n) for the auxiliary merge buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The two runs being merged are YELLOW and PINK.
 *   - The destination range turns GREEN when a merge completes.
 *   - The caption reports the current width and direction.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Stable: equal keys keep their relative order.
 *   - The direction of a pass does not affect the final sorted order.
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
    const arr = Array.isArray(input) ? [...(input as number[])] : [9, 2, 6, 1, 8, 3, 7, 4];
    const n = arr.length;
    const aux = new Array<number>(n).fill(0);
    let step = 0;
    let comparisons = 0;
    let merges = 0;

    const frame = (description: string, states: Map<number, EntityState>, codeLineNumber: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeBars(arr, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { comparisons, merges },
    });

    yield frame("Oscillating merge sort will alternate merge direction each pass.", new Map(), 0);

    let width = 1;
    let forward = true;
    while (width < n) {
        const direction = forward ? "left to right" : "right to left";
        yield frame(`Pass with run width ${width} merges ${direction}.`, new Map(), 1);

        const starts: number[] = [];
        for (let left = 0; left < n; left += 2 * width) {
            starts.push(left);
        }
        if (forward) {
            for (const left of starts) {
                yield* mergeRun(left, width, direction);
            }
        } else {
            for (let k = starts.length - 1; k >= 0; k -= 1) {
                yield* mergeRun(starts[k] as number, width, direction);
            }
        }
        width *= 2;
        forward = !forward;
    }

    function* mergeRun(left: number, width: number, direction: string): Generator<VisualFrame, void, unknown> {
        const mid = Math.min(left + width, n);
        const right = Math.min(left + 2 * width, n);
        if (mid >= right) {
            return;
        }
        let i = left;
        let j = mid;
        for (let k = left; k < right; k += 1) {
            if (i < mid && (j >= right || (arr[i] as number) <= (arr[j] as number))) {
                aux[k] = arr[i] as number;
                i += 1;
            } else {
                aux[k] = arr[j] as number;
                j += 1;
            }
            comparisons += 1;
        }
        const states = new Map<number, EntityState>();
        for (let k = left; k < right; k += 1) {
            arr[k] = aux[k] as number;
            states.set(k, "sorted");
        }
        merges += 1;
        yield frame(
            `${direction}: merged [${left}..${mid - 1}] with [${mid}..${right - 1}] into a run of ${right - left}.`,
            states,
            3,
        );
    }

    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted" as EntityState]));
    yield frame(
        `Array sorted in ${merges} merges and ${comparisons} comparisons.`,
        sortedStates,
        6,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Bottom-up merge sort doubles the sorted run width on every pass. Oscillating merge sort keeps that idea but reverses the sweep direction each time: even passes sweep left to right, odd passes sweep right to left. Because each merge touches a disjoint pair of runs, the direction never changes the resulting order.",
        invariants: [
            "After a pass of width w, every run of length up to 2w is internally sorted.",
            "Merges within a pass operate on disjoint ranges, so sweep order cannot affect the outcome.",
            "The merge uses the <= comparison on the left run, which preserves stability.",
        ],
        correctness:
            "Each merge interleaves two already sorted runs by repeatedly copying the smaller head, so its output is sorted and stable. Widths grow as powers of two until a single run covers the array; by induction that final run is sorted. Alternating the sweep direction only changes which disjoint merge happens first.",
        complexityRationale:
            "Every element is copied once per pass and there are log n passes, giving O(n log n) time regardless of input order. The auxiliary buffer holds the whole array during a merge, so space is O(n).",
        uses: [
            "Stable external sorting where data movement is expensive",
            "Tape and disk merge sorts that benefit from alternating sweep direction",
            "Teaching the bottom-up view of merge sort",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.4",
            "CLRS, Introduction to Algorithms, Chapter 2",
        ],
        workedExample:
            "On [9, 2, 6, 1] the first pass sweeps left to right, merging [9,2] to [2,9] and [6,1] to [1,6]. The second pass sweeps right to left with width two and merges the two runs into [1, 2, 6, 9].",
    },
    id: "oscillating-merge-sort",
    name: "Oscillating Merge Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [9, 2, 6, 1, 8, 3, 7, 4],
    visualType: "array",
    run,
    pseudocode: [
        "start with run width w ← 1 and direction forward",
        "for each pass, sweep runs of width w in the current direction",
        "for each adjacent pair of runs, allocate the destination range",
        "merge the two sorted runs into the auxiliary buffer",
        "copy the merged run back and flip the sweep direction",
        "double w after every pass",
        "stop when w reaches or exceeds the array length",
        "done: the single run is fully sorted",
    ],
};

export default module;
