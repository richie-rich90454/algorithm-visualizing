/**
 * Domino + Tromino tiling: dp[n] = 2*dp[n-1] + dp[n-3].
 * Time O(n), Space O(n). Default n = 3 -> 5.
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
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? task.n : 3;
    let step = 0;
    if (n < 0) {
        yield {
            stepNumber: step,
            entities: makeBars([0]),
            edges: [],
            description: "Negative n \u2013 nothing to tile.",
            codeLineNumber: 0,
            layout: "array",
            meta: {},
        };
        return;
    }
    const dp: number[] = new Array<number>(n + 1).fill(0);
    dp[0] = 1;
    if (n >= 1) dp[1] = 1;
    if (n >= 2) dp[2] = 2;
    yield {
        stepNumber: step,
        entities: makeBars(dp),
        edges: [],
        description: `Tile 2x${n} with dominoes + trominoes. dp[0] = 1.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n },
    };
    step += 1;
    for (let i = 1; i <= n; i += 1) {
        if (i >= 3) dp[i] = 2 * (dp[i - 1] ?? 0) + (dp[i - 3] ?? 0);
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        const how = i < 3 ? "base" : `2*${dp[i - 1]} + ${dp[i - 3]} = ${dp[i]}`;
        yield {
            stepNumber: step,
            entities: makeBars(dp, states),
            edges: [],
            description: `dp[${i}] = ${how}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n },
        };
        step += 1;
    }
    const done = new Map<number, EntityState>([[n, "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeBars(dp, done),
        edges: [],
        description: `Traceback: ${dp[n]} tilings of 2x${n}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { answer: dp[n] },
    };
}

const module: AlgorithmModule = {
    id: "tiling-dp-domino-tromino",
    name: "Tiling (Domino + Tromino)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { n: 3 },
    visualType: "array",
    run,
};

export default module;
