/**
 * uniform-binary-search.ts - Uniform Binary Search
 *
 * Instead of computing a midpoint as (low + high) / 2 on every probe, uniform
 * binary search precomputes a table of power-of-two strides. Each probe adds
 * the next stride to the index of the last element known to be at most the
 * target. The table never changes, so the inner loop is a fixed sequence of
 * table lookups and one comparison.
 *
 * Time: O(log n)
 * Space: O(log n) for the stride table
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SearchInput {
    array: number[];
    target: number;
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

/** Build the decreasing power-of-two stride table for an array of length n. */
function buildStrides(n: number): number[] {
    if (n <= 0) {
        return [];
    }
    let power = 1;
    while (power < n) {
        power *= 2;
    }
    const strides: number[] = [];
    for (let value = power; value >= 1; value /= 2) {
        strides.push(value);
    }
    return strides;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<SearchInput> | null) ?? {};
    const arr = Array.isArray(task.array) ? [...task.array] : [1, 3, 5, 7, 9, 11, 13, 15, 17];
    const target = typeof task.target === "number" ? task.target : 9;
    const strides = buildStrides(arr.length);
    let step = 0;
    let probes = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Uniform binary search for ${target} with stride table [${strides.join(", ")}].`,
        codeLineNumber: 0,
        layout: "array",
        meta: { target, probes, strides },
    };
    step += 1;

    let last = -1;
    for (let k = 0; k < strides.length; k += 1) {
        const stride = strides[k] as number;
        const j = last + stride;
        const inRange = j >= 0 && j < arr.length;
        const states = new Map<number, EntityState>();
        if (last >= 0) {
            states.set(last, "sorted");
        }
        if (inRange) {
            states.set(j, "comparing");
        }
        probes += 1;
        const accepted = inRange && (arr[j] as number) <= target;
        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description:
                `Probe ${k + 1}: last index ${last}, stride ${stride} gives index ${j}` +
                `${inRange ? ` with value ${arr[j]}` : " outside the array"}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { target, probes, last, stride, probe: j, accepted },
        };
        step += 1;
        if (accepted) {
            last = j;
        }
    }

    const found = last >= 0 && arr[last] === target;
    const states = new Map<number, EntityState>();
    if (found) {
        states.set(last, "path");
    }
    yield {
        stepNumber: step,
        entities: makeBars(arr, states),
        edges: [],
        description:
            found
                ? `Found ${target} at index ${last} after ${probes} probe(s).`
                : `${target} is not in the array after ${probes} probe(s).`,
        codeLineNumber: 4,
        layout: "array",
        meta: { target, probes, found, index: found ? last : -1 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Regular binary search recomputes a midpoint from two moving bounds. Uniform binary search replaces that arithmetic with a fixed table of power-of-two strides. Starting just before the array, it tries the largest stride, then half that stride, and so on, keeping an index only when the value there is small enough.",
        invariants: [
            "Before each probe, the last kept index holds a value at most the target.",
            "Every value after the last kept index that has been tested is larger than the target.",
            "The stride table is halved each round, so the gap to the answer shrinks predictably.",
        ],
        correctness:
            "Each probe either keeps the current lower boundary or raises it to the probed index, exactly as a binary search over the same interval would. Because the stride sequence halves, the probes cover every residual interval size, so the final index is the largest position whose value is at most the target. It is a match precisely when that value equals the target.",
        complexityRationale:
            "A power-of-two stride table has one entry per bit of the array length, so the loop runs O(log n) times with constant work per probe. The table itself also costs O(log n) space.",
        uses: [
            "Lookup in large sorted tables where midpoint arithmetic is costly",
            "Embedded systems that benefit from branch-free, fixed-step probing",
            "Teaching the connection between binary search and bit representation",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 3, Algorithm 6.2.1 U",
            "Wikipedia: Binary search, uniform binary search variant",
        ],
        workedExample:
            "For the sorted array [1, 3, 5, 7, 9, 11, 13, 15] the strides are [8, 4, 2, 1]. Searching for 14: index 7 (value 15) is too big, index 1 (value 3) is kept, index 3 (value 7) is kept, index 5 (value 11) is kept, so the last position at most 14 is 5 and 14 is absent.",
    },
    id: "uniform-binary-search",
    name: "Uniform Binary Search",
    category: "searching",
    complexity: { time: "O(log n)", space: "O(log n)" },
    defaultInput: { array: [1, 3, 5, 7, 9, 11, 13, 15, 17], target: 9 },
    visualType: "array",
    run,
    pseudocode: [
        "build the power-of-two stride table for the array length",
        "set the last kept index to minus one",
        "for each stride: probe last index plus stride",
        "if the probe is in range and its value is at most the target, keep it",
        "after all strides, compare the kept value with the target",
        "done: report the matching index or absence",
    ],
};

export default module;
