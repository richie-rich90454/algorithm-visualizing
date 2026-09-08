/**
 * Jump Game II (greedy): extend current reach; jump when passing its end.
 * Time O(n), Space O(1). Default [2,3,1,1,4] -> 2 jumps.
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
    const nums = task.nums ?? [2, 3, 1, 1, 4];
    let step = 0;
    if (nums.length <= 1) {
        yield {
            stepNumber: step,
            entities: makeBars(nums.length === 0 ? [0] : nums),
            edges: [],
            description: "Already at the end \u2013 0 jumps.",
            codeLineNumber: 0,
            layout: "array",
            meta: {},
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: makeBars(nums),
        edges: [],
        description: `Min jumps across [${nums.join(", ")}]. Reach from 0 = ${nums[0]}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: nums.length },
    };
    step += 1;
    let jumps = 0;
    let curEnd = 0;
    let farthest = 0;
    for (let i = 0; i < nums.length - 1; i += 1) {
        farthest = Math.max(farthest, i + (nums[i] ?? 0));
        if (i === curEnd) {
            jumps += 1;
            curEnd = farthest;
        }
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeBars(nums, states),
            edges: [],
            description: `i=${i}: farthest = ${farthest}, jumps = ${jumps}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n: nums.length },
        };
        step += 1;
    }
    const done = new Map<number, EntityState>([[nums.length - 1, "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeBars(nums, done),
        edges: [],
        description: `Traceback: reach the end in ${jumps} jumps.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { answer: jumps },
    };
}

const module: AlgorithmModule = {
    id: "jump-game-min-jumps",
    name: "Jump Game (Min Jumps)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { nums: [2, 3, 1, 1, 4] },
    visualType: "array",
    run,
};

export default module;
