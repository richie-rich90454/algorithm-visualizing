/**
 * count-search.ts - Count Occurrences (Sorted Array)
 *
 * Counts how many times a target appears in a sorted array by running two
 * binary searches: one for the first position at or after the target and one
 * for the first position strictly after it. Their difference is the count, so
 * the work is O(log n) regardless of how many copies are present.
 *
 * Time O(log n), space O(1).
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
    const task = (input as { array?: number[]; target?: number } | null) ?? {};
    const arr = Array.isArray(task.array) ? [...task.array] : [1, 2, 2, 2, 3, 4, 4, 5];
    const target = typeof task.target === "number" ? task.target : 2;
    let step = 0;
    let comparisons = 0;

    const frame = (
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(arr, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { comparisons, target, ...extra },
    });

    yield frame(new Map(), `Counting occurrences of ${target} in a sorted array of ${arr.length} values.`, 0, {
        n: arr.length,
    });
    step += 1;

    // First binary search: leftmost index whose value is >= target.
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const value = arr[mid]!;
        comparisons += 1;
        const states = new Map<number, EntityState>([
            [mid, "comparing"],
            [lo, "active"],
        ]);
        yield frame(
            states,
            `Lower-bound probe at ${mid} (value ${value}) while searching for the first ${target}.`,
            2,
            { lo, hi, mid, phase: "lower" },
        );
        step += 1;
        if (value < target) lo = mid + 1;
        else hi = mid;
    }
    const lower = lo;
    yield frame(new Map(), `Lower bound is ${lower}: the first value >= ${target} sits there.`, 3, { lower });
    step += 1;

    // Second binary search: leftmost index whose value is > target.
    lo = lower;
    hi = arr.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const value = arr[mid]!;
        comparisons += 1;
        const states = new Map<number, EntityState>([
            [mid, "comparing"],
            [hi - 1, "active"],
        ]);
        yield frame(
            states,
            `Upper-bound probe at ${mid} (value ${value}) while searching past ${target}.`,
            5,
            { lo, hi, mid, phase: "upper" },
        );
        step += 1;
        if (value <= target) lo = mid + 1;
        else hi = mid;
    }
    const upper = lo;
    const count = upper - lower;

    const range = new Map<number, EntityState>();
    for (let k = 0; k < arr.length; k += 1) {
        if (k >= lower && k < upper) range.set(k, "sorted");
        else if (k === lower || k === upper) range.set(k, "pivot");
        else range.set(k, "idle");
    }
    yield frame(
        range,
        `Upper bound is ${upper}, so ${target} occurs ${count} time(s) at indices ${lower}..${upper - 1}.`,
        7,
        { lower, upper, count, comparisons },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single binary search tells you whether a target is present, but not how many copies there are. Find the first slot where the target could go by searching for the lower bound, then find the first slot after all copies by searching for the upper bound. The copies occupy the contiguous gap between the two bounds.",
        invariants: [
            "During the lower-bound search every index before lo holds a value below the target.",
            "During the upper-bound search every index before lo holds a value at most the target.",
            "Sorted input keeps all equal values contiguous, so the count equals upper minus lower.",
        ],
        correctness:
            "The lower-bound binary search returns the smallest index whose value is at least the target, or n when none exists. The upper-bound search returns the smallest index whose value is strictly greater than the target. Because the array is sorted, all copies of the target occupy exactly the half-open interval between these two indices, so its length is the true count.",
        complexityRationale:
            "Each binary search halves its interval, taking at most ceil(log2(n + 1)) comparisons, and the two searches are independent, so total time is O(log n). Only a handful of indices are stored, giving O(1) space.",
        uses: [
            "Counting duplicate keys in a sorted index or database column",
            "Implementing multiset rank and range queries",
            "Answering frequency questions in competitive programming",
        ],
        references: [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 2 and Chapter 12",
            "ISO C++ standard library, std::lower_bound and std::upper_bound",
        ],
        workedExample:
            "In [1, 2, 2, 2, 3, 4] the lower bound of 2 is index 1 and the upper bound is index 4. The difference 4 - 1 = 3 is the number of twos, which are exactly the values at indices 1, 2 and 3.",
    },
    id: "count-search",
    name: "Count Occurrences in Sorted Array",
    category: "searching",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { array: [1, 2, 2, 2, 3, 4, 4, 5], target: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "start with lo at zero and hi at the array length",
        "probe the middle and compare it with the target",
        "for the lower bound move hi left when the value is large",
        "the final lo is the first position with value >= target",
        "restart from that lo for the upper bound",
        "move lo right while the value is <= target",
        "the final lo is the first position with value > target",
        "done: count = upper bound minus lower bound",
    ],
};

export default module;
