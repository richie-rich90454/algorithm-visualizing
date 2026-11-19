/**
 * quadsort.ts - Quad Sort (Four-Way Merge Sort)
 *
 * Quad sort splits each segment into four quarters, sorts them recursively,
 * and merges all four sorted runs with a single four-pointer merge. Compared
 * with a binary merge sort it halves the number of merge levels, trading a
 * slightly larger merge step for fewer passes over the data.
 *
 * Time: O(n log n), with a smaller logarithmic factor than two-way merging
 * Space: O(n) auxiliary for the merge buffers
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
    const arr = Array.isArray(input) ? [...(input as number[])] : [9, 2, 7, 1, 8, 3, 6, 4, 5, 0];
    const n = arr.length;
    let step = 0;
    let merges = 0;

    function* sortSegment(lo: number, hi: number): Generator<VisualFrame, void, unknown> {
        if (hi - lo <= 1) {
            return;
        }
        const span = hi - lo;
        const m1 = lo + Math.floor(span / 4);
        const m2 = lo + Math.floor(span / 2);
        const m3 = lo + Math.floor((3 * span) / 4);
        const bounds = [lo, m1, m2, m3, hi];

        yield* sortSegment(lo, m1);
        yield* sortSegment(m1, m2);
        yield* sortSegment(m2, m3);
        yield* sortSegment(m3, hi);

        const runs = [
            arr.slice(bounds[0] as number, bounds[1] as number),
            arr.slice(bounds[1] as number, bounds[2] as number),
            arr.slice(bounds[2] as number, bounds[3] as number),
            arr.slice(bounds[3] as number, bounds[4] as number),
        ];
        const pointers = [0, 0, 0, 0];
        const merged: number[] = [];
        while (merged.length < span) {
            let bestRun = -1;
            let bestValue = Infinity;
            for (let r = 0; r < 4; r += 1) {
                const run = runs[r] as number[];
                const pointer = pointers[r] as number;
                if (pointer < run.length) {
                    const value = run[pointer] as number;
                    if (value < bestValue) {
                        bestValue = value;
                        bestRun = r;
                    }
                }
            }
            if (bestRun < 0) {
                break;
            }
            merged.push(bestValue);
            pointers[bestRun] = (pointers[bestRun] as number) + 1;
        }
        for (let k = 0; k < merged.length; k += 1) {
            arr[lo + k] = merged[k] as number;
        }
        merges += 1;

        const states = new Map<number, EntityState>();
        for (let k = 0; k < merged.length; k += 1) {
            states.set(lo + k, "sorted");
        }
        const frame: VisualFrame = {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description:
                `Four-way merge of quarters [${bounds.join(", ")}] produced ` +
                `${merged.length} ordered values.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { merges, segment: `${lo}-${hi}`, merged: merged.length },
        };
        step += 1;
        yield frame;
    }

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array - quad sort splits each segment into four quarters.",
        codeLineNumber: 0,
        layout: "array",
        meta: { merges, size: n },
    };
    step += 1;

    yield* sortSegment(0, n);

    const allSorted = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted" as EntityState]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, allSorted),
        edges: [],
        description: `Array sorted with ${merges} four-way merge(s).`,
        codeLineNumber: 4,
        layout: "array",
        meta: { merges, size: n },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A binary merge sort halves a segment and merges two runs at each level. Quad sort cuts a segment into four quarters, sorts each one, and performs a single merge with four pointers. Fewer merge levels mean fewer full passes over the data, which is useful when each pass is expensive.",
        invariants: [
            "The four quarters cover the segment without gaps or overlap.",
            "Each quarter is internally sorted before the four-way merge begins.",
            "At every merge step the smallest unused head among the four runs is chosen next.",
        ],
        correctness:
            "Recursion sorts each quarter by induction. The merge repeatedly takes the minimum among the heads of four already sorted runs, so it emits values in nondecreasing order and preserves every element exactly once. Replacing the four sorted quarters with their merge therefore sorts the whole segment.",
        complexityRationale:
            "Each merge level touches every element once, and there are log base four of n levels, giving O(n log n) time with about half the levels of a two-way merge. Four run buffers of total size n give O(n) auxiliary space.",
        uses: [
            "External sorting where each merge pass reads and writes large blocks",
            "Stable sorting when equal keys must keep their original order",
            "Teaching multi-way merging and logarithmic factor reductions",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 3, Section 5.2.4",
            "Wikipedia: Merge sort, multi-way merge variants",
        ],
        workedExample:
            "For [9, 2, 7, 1, 8, 3, 6, 4] the quarters are [9, 2], [7, 1], [8, 3], [6, 4]. Recursion sorts them to [2, 9], [1, 7], [3, 8], [4, 6]; the four-pointer merge then emits 1, 2, 3, 4, 6, 7, 8, 9.",
    },
    id: "quadsort",
    name: "Quad Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [9, 2, 7, 1, 8, 3, 6, 4, 5, 0],
    visualType: "array",
    run,
    pseudocode: [
        "if the segment holds one value, return it unchanged",
        "split the segment into four contiguous quarters",
        "recursively sort every quarter, then four-way merge the heads",
        "copy the merged run back over the segment",
        "done: every segment is sorted",
    ],
};

export default module;
