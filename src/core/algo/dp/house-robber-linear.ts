/**
 * House Robber (linear): dp[i] = max(dp[i-1], dp[i-2] + nums[i]).
 * Time O(n), Space O(n). Default [2,7,9,3,1] -> 12.
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
            meta: {},
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
        codeLineNumber: 4,
        layout: "array",
        meta: { answer },
    };
}

const module: AlgorithmModule = {
    id: "house-robber-linear",
    name: "House Robber (Linear)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { nums: [2, 7, 9, 3, 1] },
    visualType: "array",
    run,
};

export default module;
