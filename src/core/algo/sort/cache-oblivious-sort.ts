/**
 * cache-oblivious-sort.ts - Cache-Oblivious Sort (Funnel Sort)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cache-oblivious sort recursively splits an array of n items into r = ceil(sqrt(n))
 * contiguous runs, sorts each run, and then merges the sorted runs through a
 * binary funnel of buffers. The split factor changes with the subproblem size,
 * so no cache size is ever named: the recursion adapts itself to every level
 * of the memory hierarchy. This teaching core uses a binary merge tree as the
 * funnel and records each split, recursive sort, and merge pass as a frame.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) comparisons on the RAM model
 *   Space: O(n) for the merge buffers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each array item is a bar whose height is its value.
 *   - Bars being merged in the current funnel pass are highlighted.
 *   - The final frame marks the whole array as sorted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type MetaExtra = Record<string, number | string | boolean | number[]>;

/** Snapshot the current array as one bar per item. */
function makeBars(values: number[], states: Map<number, EntityState>): VisualEntity[] {
    return values.map((value, index) => ({
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

/** Mark every index in [lo, hi) with the given state. */
function markRange(states: Map<number, EntityState>, lo: number, hi: number, state: EntityState): void {
    for (let i = lo; i < hi; i += 1) {
        states.set(i, state);
    }
}

/** Sort an array with the sqrt decomposition and binary funnel merge. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: unknown } | null) ?? {};
    const source = Array.isArray(task.array)
        ? task.array
        : [8, 3, 5, 1, 9, 2, 6, 4, 7, 0, 5, 3, 8, 1, 2, 6];
    const arr: number[] = source
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
        .slice();

    const frames: VisualFrame[] = [];
    let step = 0;
    const push = (states: Map<number, EntityState>, description: string, line: number, extra: MetaExtra): void => {
        frames.push({
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description,
            codeLineNumber: line,
            layout: "array",
            meta: { n: arr.length, ...extra },
        });
        step += 1;
    };

    push(
        new Map(),
        `Cache-oblivious sort on ${arr.length} items: recursively split into sqrt-size runs and merge them through a binary funnel.`,
        0,
        { phase: "start", runs: 1 },
    );

    if (arr.length > 1) {
        /** Merge the two adjacent sorted ranges [lo, mid) and [mid, hi) in place. */
        const mergeAdjacent = (lo: number, mid: number, hi: number): void => {
            const left = arr.slice(lo, mid);
            const right = arr.slice(mid, hi);
            let i = 0;
            let j = 0;
            let k = lo;
            while (i < left.length && j < right.length) {
                const a = left[i] ?? 0;
                const b = right[j] ?? 0;
                if (a <= b) {
                    arr[k] = a;
                    i += 1;
                } else {
                    arr[k] = b;
                    j += 1;
                }
                k += 1;
            }
            while (i < left.length) {
                arr[k] = left[i] ?? 0;
                i += 1;
                k += 1;
            }
            while (j < right.length) {
                arr[k] = right[j] ?? 0;
                j += 1;
                k += 1;
            }
        };

        /** Recursively sort [lo, hi). */
        const sortRange = (lo: number, hi: number): void => {
            const n = hi - lo;
            if (n <= 1) {
                return;
            }
            const runCount = Math.max(2, Math.ceil(Math.sqrt(n)));
            const runSize = Math.ceil(n / runCount);

            // Sort each run recursively.
            for (let s = lo; s < hi; s += runSize) {
                sortRange(s, Math.min(hi, s + runSize));
            }

            const starts: number[] = [];
            for (let s = lo; s < hi; s += runSize) {
                starts.push(s);
            }
            const runStates = new Map<number, EntityState>();
            starts.forEach((start, index) => {
                markRange(runStates, start, Math.min(hi, start + runSize), index % 2 === 0 ? "visited" : "active");
            });
            push(
                runStates,
                `Sorted ${starts.length} runs of at most ${runSize} items each; the funnel will now merge them.`,
                2,
                { phase: "runs", runCount: starts.length, runSize },
            );

            // Binary funnel: repeatedly merge adjacent runs until one remains.
            let runs: Array<{ lo: number; hi: number }> = starts.map((start) => ({
                lo: start,
                hi: Math.min(hi, start + runSize),
            }));
            while (runs.length > 1) {
                const next: Array<{ lo: number; hi: number }> = [];
                const mergeStates = new Map<number, EntityState>();
                for (let i = 0; i < runs.length; i += 2) {
                    const left = runs[i];
                    const right = runs[i + 1];
                    if (!right) {
                        next.push(left);
                        continue;
                    }
                    markRange(mergeStates, left.lo, right.hi, "comparing");
                    mergeAdjacent(left.lo, left.hi, right.hi);
                    next.push({ lo: left.lo, hi: right.hi });
                }
                push(
                    mergeStates,
                    `Funnel pass merged ${runs.length} runs into ${next.length} with a two-way buffer at each node.`,
                    3,
                    { phase: "merge", runCount: next.length, mergedFrom: runs.length },
                );
                runs = next;
            }
        };

        sortRange(0, arr.length);
    }

    const finalStates = new Map<number, EntityState>();
    markRange(finalStates, 0, arr.length, "sorted");
    push(finalStates, "All runs merged; the array is in nondecreasing order.", 5, { phase: "done", runCount: 1 });

    for (const frame of frames) {
        yield frame;
    }
}

/** The cache-oblivious sort module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A cache-oblivious algorithm never mentions the cache size, yet it uses the cache well at every level. This sort repeatedly divides the array into about sqrt(n) runs, sorts each run, and merges the runs through a tree of small buffers. Because the split factor shrinks with the problem, some buffer eventually fits each level of cache without the algorithm knowing the sizes.",
        invariants: [
            "Each recursive call sorts exactly one contiguous range of the array.",
            "Before a funnel pass, every run in that pass is already internally sorted.",
            "A two-way merge of two adjacent sorted runs produces one larger sorted run.",
        ],
        correctness:
            "By induction, sorting each sqrt-size run yields sorted runs. The binary funnel merges adjacent sorted runs pairwise; a standard two-way merge of two sorted sequences is sorted and preserves their combined multiset, so after log(r) passes the single remaining run is a sorted permutation of the original range. Applying this bottom-up from the base case gives a fully sorted array.",
        complexityRationale:
            "At a level with runs of size m, each merge pass touches each item once and there are log(sqrt(n)) passes per recursion level, giving O(n log n) total comparisons on the RAM model. The merge buffers hold at most one run, so extra space is O(n).",
        uses: [
            "External-memory sorting where the block and cache sizes vary by machine",
            "Foundations of cache-oblivious data structures such as the funnel heap",
            "Teaching the difference between cache-aware and cache-oblivious design",
        ],
        references: [
            "Frigo, Leiserson, Prokop and Ramachandran, Cache-Oblivious Algorithms (1999)",
            "CLRS, Introduction to Algorithms, 3rd ed., Chapter 28 (Sorting Networks) and merge-sort discussion",
        ],
        workedExample:
            "For eight items the algorithm splits into r = 3 runs of at most three items, recursively sorts them, then merges run one with run two, and finally merges that result with run three. Each merge keeps the smaller leading item first, so the final run is sorted and contains exactly the original eight values.",
    },
    id: "cache-oblivious-sort",
    name: "Cache-Oblivious Sort (Funnel Sort)",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { array: [8, 3, 5, 1, 9, 2, 6, 4, 7, 0, 5, 3, 8, 1, 2, 6] },
    visualType: "array",
    run,
    pseudocode: [
        "if the range has at most one item, return it",
        "let r be the ceiling of the square root of the range size",
        "split the range into r runs and sort each run recursively",
        "merge adjacent sorted runs pairwise through a binary funnel",
        "repeat the merge passes until one sorted run remains",
        "return the single sorted run as the result",
    ],
};

export default module;
