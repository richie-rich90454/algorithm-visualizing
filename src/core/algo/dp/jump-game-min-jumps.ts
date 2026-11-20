/**
 * jump-game-min-jumps.ts - Jump Game (Min Jumps)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: extend farthest <- max(farthest, i + nums[i]) per index.
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)
 *   Space: O(1)
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
            meta: { step },
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
        codeLineNumber: 6,
        layout: "array",
        meta: { answer: jumps },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Jump Game min jumps counts the fewest jumps to reach the end of an array where each entry is the maximum jump length. It greedily tracks the farthest index reachable within the current jump and the end of that jump's range. When the scan reaches the current end, a new jump is opened.",
        "invariants": [
            "farthest is the maximum index reachable with one more jump from indices scanned so far.",
            "currentEnd is the boundary of the current jump window.",
            "jumps equals the number of windows fully traversed."
        ],
        "correctness": "All positions up to currentEnd are reachable with the current number of jumps, and extending farthest over them discovers everything reachable with one more. When the scan hits currentEnd, taking another jump is necessary, so incrementing is forced. Therefore the final count is minimal.",
        "complexityRationale": "A single left-to-right scan visits each index once with constant work, giving O(n) time and O(1) space.",
        "uses": [
            "Computing minimum hop counts in network routing",
            "Game movement and reachability planning",
            "Greedy interval covering with unit steps counted"
        ],
        "references": [
            "LeetCode problem 45, Jump Game II",
            "Kleinberg and Tardos, Algorithm Design, Chapter 4"
        ],
        "workedExample": "For [2,3,1,1,4], from index 0 the farthest is 2, so the first jump window ends at 2. Scanning 1 and 2 extends farthest to 6, ending the game; two jumps suffice: 0 to 1, then 1 to 4."
    },
    id: "jump-game-min-jumps",
    name: "Jump Game (Min Jumps)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { nums: [2, 3, 1, 1, 4] },
    visualType: "array",
    run,
    pseudocode: [
        "set up jumps <- 0, currentEnd <- 0, farthest <- 0",
        "farthest holds reach of the current jump window",
        "extend farthest <- max(farthest, i + nums[i]) per index",
        "scan once, closing a jump when i reaches currentEnd",
        "each closure increments jumps and opens a new window",
        "track window bounds to count the fewest jumps used",
        "answer <- jumps to reach the end with jump points listed",
    ],
};

export default module;
