/**
 * House Robber II (circular): max(rob(nums[0..n-2]), rob(nums[1..n-1])).
 * Time O(n), Space O(1). Default [2,3,2] -> 3.
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

function robRange(nums: number[], lo: number, hi: number): number {
    let prev2 = 0;
    let prev1 = 0;
    for (let i = lo; i <= hi; i += 1) {
        const cur = Math.max(prev1, prev2 + (nums[i] ?? 0));
        prev2 = prev1;
        prev1 = cur;
    }
    return prev1;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { nums?: number[] } | null) ?? {};
    const nums = task.nums ?? [2, 3, 2];
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
    if (nums.length === 1) {
        yield {
            stepNumber: step,
            entities: makeBars(nums, new Map([[0, "sorted"]])),
            edges: [],
            description: `Single house: loot ${nums[0]}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { answer: nums[0] },
        };
        return;
    }
    const n = nums.length;
    yield {
        stepNumber: step,
        entities: makeBars(nums),
        edges: [],
        description: `Circular street [${nums.join(", ")}]: first and last are adjacent.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n },
    };
    step += 1;
    const dpA: number[] = [...nums];
    for (let i = 1; i < n - 1; i += 1) {
        if (i === 1) dpA[i] = Math.max(nums[0] ?? 0, nums[1] ?? 0);
        else dpA[i] = Math.max(dpA[i - 1] ?? 0, (dpA[i - 2] ?? 0) + (nums[i] ?? 0));
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeBars(dpA, states),
            edges: [],
            description: `Case A (skip last): dp[${i}] = ${dpA[i]}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n },
        };
        step += 1;
    }
    const caseA = robRange(nums, 0, n - 2);
    const statesB = new Map<number, EntityState>();
    for (let k = 1; k < n; k += 1) statesB.set(k, "comparing");
    yield {
        stepNumber: step,
        entities: makeBars(nums, statesB),
        edges: [],
        description: `Case B (skip first): rob houses 1..${n - 1}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { n },
    };
    step += 1;
    const caseB = robRange(nums, 1, n - 1);
    yield {
        stepNumber: step,
        entities: makeBars(nums, statesB),
        edges: [],
        description: `Case B value = ${caseB}; case A = ${caseA}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { n },
    };
    step += 1;
    const answer = Math.max(caseA, caseB);
    const done = new Map<number, EntityState>();
    for (let k = 0; k < n; k += 1) done.set(k, "sorted");
    yield {
        stepNumber: step,
        entities: makeBars(nums, done),
        edges: [],
        description: `Traceback: max(${caseA} skipping last, ${caseB} skipping first) = ${answer}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { answer },
    };
}

const module: AlgorithmModule = {
    id: "house-robber-circular",
    name: "House Robber (Circular)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { nums: [2, 3, 2] },
    visualType: "array",
    run,
};

export default module;
