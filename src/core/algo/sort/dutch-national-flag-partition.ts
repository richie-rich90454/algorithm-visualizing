/**
 * dutch-national-flag-partition.ts - Dutch National Flag Partition
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given an array whose elements take three values (0, 1 and 2), Dijkstra's
 * Dutch national flag algorithm groups all 0s first, then all 1s, then all
 * 2s in a single left-to-right pass. Three pointers maintain the boundaries
 * between the four regions: zeros, ones, unseen values and twos.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) - every element is examined at most once
 *   Space: O(1) - only three pointers are used
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Zeros in their final region are green (sorted).
 *   - Ones in their final region are yellow (highlight).
 *   - Twos in their final region are pink (visited).
 *   - The element under the scan pointer is orange (comparing).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FlagTask {
    values?: number[];
}

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
    const task = (Array.isArray(input) ? { values: input as number[] } : (input as FlagTask | null)) ?? {};
    const src = Array.isArray(task.values) ? (task.values as number[]) : [2, 0, 2, 1, 0, 1, 2, 0];
    const arr: number[] = src.map((value) => (value === 1 ? 1 : value === 2 ? 2 : 0));

    let step = 0;
    let swaps = 0;

    const regions = (low: number, mid: number, high: number, scan: number): Map<number, EntityState> => {
        const states = new Map<number, EntityState>();
        for (let k = 0; k < low; k += 1) states.set(k, "sorted");
        for (let k = low; k < mid; k += 1) states.set(k, "highlight");
        for (let k = high + 1; k < arr.length; k += 1) states.set(k, "visited");
        if (scan >= mid && scan <= high) states.set(scan, "comparing");
        return states;
    };

    const frame = (states: Map<number, EntityState>, description: string, codeLineNumber: number): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(arr, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { swaps, low: 0, mid: 0, high: arr.length - 1, size: arr.length },
    });

    yield frame(new Map(), `Dutch flag partition of ${arr.length} ternary values.`, 0);
    step += 1;

    let low = 0;
    let mid = 0;
    let high = arr.length - 1;

    while (mid <= high) {
        const current = arr[mid] as number;
        const states = regions(low, mid, high, mid);
        states.set(mid, "comparing");
        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Scan bar ${mid}: value ${current}; zones are 0:[0..${low - 1}], 1:[${low}..${mid - 1}], ?:[${mid}..${high}], 2:[${high + 1}..${arr.length - 1}].`,
            codeLineNumber: 1,
            layout: "array",
            meta: { swaps, low, mid, high, size: arr.length },
        };
        step += 1;

        if (current === 0) {
            const atLow = arr[low] as number;
            arr[low] = 0;
            arr[mid] = atLow;
            swaps += 1;
            low += 1;
            mid += 1;
        } else if (current === 1) {
            mid += 1;
        } else {
            const atHigh = arr[high] as number;
            arr[mid] = atHigh;
            arr[high] = 2;
            swaps += 1;
            high -= 1;
        }

        yield {
            stepNumber: step,
            entities: makeBars(arr, regions(low, mid, high, Math.min(mid, high))),
            edges: [],
            description: `After handling ${current}: 0s end at ${low - 1}, 1s end at ${mid - 1}, 2s start at ${high + 1}.`,
            codeLineNumber: current === 0 ? 2 : current === 1 ? 3 : 4,
            layout: "array",
            meta: { swaps, low, mid, high, size: arr.length },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(arr, new Map(arr.map((_, index) => [index, "sorted" as EntityState]))),
        edges: [],
        description: `Partitioned in ${swaps} swap(s): all 0s, then 1s, then 2s.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { swaps, low, mid, high, size: arr.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine the three colors of the Dutch flag as 0, 1 and 2. Keep four regions in the array: zeros on the left, ones next, an unknown middle, and twos on the right. Look at the first unknown value: a zero is swapped to the zero region, a two is swapped to the two region, and a one is simply left in place as the one region grows.",
        invariants: [
            "Every position before low holds 0, and every position from low to mid-1 holds 1.",
            "Every position after high holds 2, and positions from mid to high are still unknown.",
            "The number of 0s, 1s and 2s never changes.",
        ],
        correctness:
            "Each step moves one boundary by one position and shrinks the unknown region. When mid passes high the unknown region is empty, so the four regions cover the whole array in the order 0, 1, 2. Because values are only swapped, their multiset is preserved.",
        complexityRationale:
            "The scan pointer advances on a 0 or 1 and the high pointer retreats on a 2, so each of the n positions is handled once: O(n) time with three integer pointers, hence O(1) extra space.",
        uses: [
            "Grouping records by a three-valued key in one pass",
            "The sort-colors problem and ternary partitioning",
            "A partition primitive used by three-way quicksort",
        ],
        references: [
            "Dijkstra, A Discipline of Programming, Prentice Hall, 1976",
            "Sedgewick and Wayne, Algorithms, Section 2.3 (3-way partitioning)",
        ],
        workedExample:
            "For [2,0,2,1,0,1,2,0], mid starts on 2 so it swaps with the last element and high drops to 6. Zeros are swapped left and ones are skipped. The scan ends with [0,0,0,1,1,1,2,2] after five swaps.",
    },
    id: "dutch-national-flag-partition",
    name: "Dutch National Flag Partition",
    category: "sorting",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { values: [2, 0, 2, 1, 0, 1, 2, 0] },
    visualType: "array",
    run,
    pseudocode: [
        "set low, mid to 0 and high to n-1",
        "while mid is at most high: inspect A[mid]",
        "if A[mid] is 0: swap A[low] and A[mid], increment both",
        "if A[mid] is 1: increment mid",
        "if A[mid] is 2: swap A[mid] and A[high], decrement high",
        "repeat until the unknown region is empty",
        "done: zeros, then ones, then twos",
    ],
};

export default module;
