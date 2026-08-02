/**
 * lis.ts – Longest Increasing Subsequence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The longest increasing subsequence (LIS) of an array is the longest
 * subsequence whose elements are strictly increasing. The classic O(n²)
 * dynamic program computes `dp[i]` = length of the LIS ending at index i:
 *
 *   dp[i] = 1 + max(dp[j]) over all j < i with a[j] < a[i].
 *
 * The answer is the maximum dp value.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n²)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The element being processed is YELLOW (comparing).
 *   - The predecessors that can extend it are PINK (highlight).
 *   - The chosen LIS elements are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The "best chain ending here" formulation is a DP template.
 *   - An O(n log n) version exists using patience-sorting tails.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a set of bar entities for the array.
 *
 * @param arr The array values.
 * @param states Optional index → state overrides.
 * @returns Bar entities.
 */
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

/**
 * The LIS generator.
 *
 * @param input `{ array }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[] } | null) ?? {};
    const arr = task.array ?? [3, 1, 4, 1, 5, 9, 2, 6];

    const n = arr.length;
    let step = 0;

    // Frame 0: the untouched array.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Longest increasing subsequence – DP over ending positions.",
        codeLineNumber: 0,
        layout: "array",
        meta: {},
    };
    step += 1;

    // dp[i] = LIS length ending at i.
    const dp = new Array<number>(n).fill(1);

    for (let i = 0; i < n; i += 1) {
        // Look for the best predecessor.
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        for (let j = 0; j < i; j += 1) {
            if ((arr[j] ?? 0) < (arr[i] ?? 0)) {
                states.set(j, "highlight");
            }
        }

        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Processing index ${i} (value ${arr[i]}).`,
            codeLineNumber: 2,
            layout: "array",
            meta: { dp: [...dp] },
        };
        step += 1;

        // dp[i] = 1 + max dp[j] over smaller predecessors.
        for (let j = 0; j < i; j += 1) {
            if ((arr[j] ?? 0) < (arr[i] ?? 0)) {
                dp[i] = Math.max(dp[i] ?? 0, (dp[j] ?? 0) + 1);
            }
        }

        const doneStates = new Map<number, EntityState>([[i, "sorted"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, doneStates),
            edges: [],
            description: `dp[${i}] = ${dp[i]}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { dp: [...dp] },
        };
        step += 1;
    }

    // The LIS length is the max dp value.
    const lisLen = Math.max(...dp);
    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < n; i += 1) {
        if ((dp[i] ?? 0) === lisLen) {
            finalStates.set(i, "sorted");
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(arr, finalStates),
        edges: [],
        description: `LIS length = ${lisLen}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { lisLen, dp: [...dp] },
    };
}

/** The LIS module, registered with the engine. */
const module: AlgorithmModule = {
    id: "lis",
    name: "Longest Increasing Subsequence",
    category: "dynamic-programming",
    complexity: { time: "O(n²)", space: "O(n)" },
    // The LIS of this array is 1, 4, 5, 9 (length 4).
    defaultInput: { array: [3, 1, 4, 1, 5, 9, 2, 6] },
    visualType: "array",
    run,
};

export default module;
