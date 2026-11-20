/**
 * house-robber-linear.ts - House Robber (Linear)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[i] <- max(dp[i-1], dp[i-2] + nums[i]).
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
   - The cell being computed is YELLOW (comparing).
   - Updated entries flash BLUE (active).
   - The optimal choices are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - States build in dependency order so every transition reads final values.
 *   - The recurrence above is the single idea to memorize.
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
    const task = (input as { nums?: number[] } | null) ?? {};
    const nums = task.nums ?? [2, 7, 9, 3, 1];
    let step = 0;
    if (nums.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars([0]),
            edges: [],
            description: "No houses \u2013 loot 0.",
            codeLineNumber: 0,
            layout: "array",
            meta: { step },
        };
        return;
    }
    const dp: number[] = [...nums];
    if (nums.length > 1) dp[1] = Math.max(nums[0] ?? 0, nums[1] ?? 0);
    yield {
        stepNumber: step,
        entities: makeBars(nums),
        edges: [],
        description: `Rob houses [${nums.join(", ")}]; never rob adjacent. dp[0] = ${nums[0]}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: nums.length },
    };
    step += 1;
    for (let i = 1; i < nums.length; i += 1) {
        if (i > 1) dp[i] = Math.max(dp[i - 1] ?? 0, (dp[i - 2] ?? 0) + (nums[i] ?? 0));
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeBars(dp, states),
            edges: [],
            description: `dp[${i}] = max(${dp[i - 1]}, ${i > 1 ? (dp[i - 2] ?? 0) : 0} + ${nums[i]}) = ${dp[i]}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n: nums.length },
        };
        step += 1;
    }
    const answer = dp[nums.length - 1] ?? 0;
    const done = new Map<number, EntityState>();
    for (let k = 0; k < nums.length; k += 1) done.set(k, "sorted");
    yield {
        stepNumber: step,
        entities: makeBars(dp, done),
        edges: [],
        description: `Traceback: max loot = ${answer}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { answer },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "House robber on a linear street chooses non-adjacent houses to maximize loot. For each house the choice is to skip it and keep dp[i-1], or take it and add its value to dp[i-2]. The recurrence dp[i] = max(dp[i-1], dp[i-2] + nums[i]) captures that decision with only the two previous results needed.",
        "invariants": [
            "dp[i] is the maximum loot obtainable from houses 0 through i.",
            "Taking house i forbids house i-1, hence the dp[i-2] dependency.",
            "dp values are nondecreasing."
        ],
        "correctness": "An optimal solution for houses up to i either leaves house i unrobbed, giving dp[i-1], or robs it, forcing house i-1 to be skipped and giving dp[i-2] plus its value. These cases are exhaustive, so the max is optimal, and induction over i proves correctness.",
        "complexityRationale": "Each house is processed once with constant work, giving O(n) time. Only two prior loot totals are needed, so space is O(1) though the visualization stores O(n) for display.",
        "uses": [
            "Selecting non-adjacent jobs for maximum profit",
            "Resource allocation with adjacency conflicts",
            "A minimal example of one-dimensional DP"
        ],
        "references": [
            "LeetCode problem 198, House Robber",
            "Cormen et al., Introduction to Algorithms, Chapter 15"
        ],
        "workedExample": "For [2,7,9,3,1], dp becomes 2, 7, 11, 11, 12. Robbing houses 0, 2, and 4 gives 2+9+1 = 12, the maximum."
    },
    id: "house-robber-linear",
    name: "House Robber (Linear)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { nums: [2, 7, 9, 3, 1] },
    visualType: "array",
    run,
    pseudocode: [
        "set up dp[0] <- nums[0] for the single-house base",
        "dp[i] holds max loot over houses 0..i",
        "dp[i] <- max(dp[i-1], dp[i-2] + nums[i])",
        "iterate houses left to right honoring adjacency",
        "each house picks skip versus take with neighbor guard",
        "carry the better loot total forward each step",
        "answer <- dp[n-1] with robbed houses reconstructed",
    ],
};

export default module;
