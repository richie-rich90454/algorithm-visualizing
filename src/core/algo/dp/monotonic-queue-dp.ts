/**
 * monotonic-queue-dp.ts – Monotonic Queue DP optimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The monotonic queue optimizes DPs with a sliding-window max/min:
 *
 *   dp[i] = cost(i) + min/max over j in [i-k, i-1] of dp[j]
 *
 * A deque holds candidates with strictly increasing dp values, so the best is
 * always at the front and stale indices fall off the back. This turns an O(nk)
 * recurrence into O(n). The classic example is jumping-game style DPs; here we
 * use the classic "best dp in the last k positions" template.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) – each index enters/leaves the deque once
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The dp cell being computed is YELLOW (comparing).
 *   - The deque contents are narrated.
 *   - The answer is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The "amortized O(1) per element" deque is the heart to teach.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cell entities for the dp array.
 *
 * @param values The dp values.
 * @param states Optional index → state overrides.
 * @returns Cell entities in a single row.
 */
function makeCells(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: value === Infinity ? "∞" : String(value),
        value,
        state: states.get(index) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Monotonic Queue DP generator.
 *
 * @param input `{ costs, window }` – per-position costs and the window k.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { costs?: number[]; window?: number } | null) ?? {};
    const costs = task.costs ?? [0, 3, 1, 2, 5, 1, 2, 1];
    // A window below 1 leaves every position unreachable; fall back instead
    // of silently treating an empty deque as dp 0.
    const rawWindow = typeof task.window === "number" ? task.window : 3;
    const k = Number.isInteger(rawWindow) && rawWindow >= 1 ? rawWindow : 3;

    const n = costs.length;
    let step = 0;

    // Edge case: no positions to reach.
    if (n === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "No positions – the minimum cost is 0.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { n, k, answer: 0 },
        };
        return;
    }

    // dp[i] = min cost to reach position i.
    const dp = new Array<number>(n).fill(Infinity);
    dp[0] = costs[0] ?? 0;

    // The deque holds indices with increasing dp values.
    const deque: number[] = [0];

    // Frame 0: the initialized dp array.
    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Monotonic queue DP – min cost to reach the end, window ${k}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, k },
    };
    step += 1;

    for (let i = 1; i < n; i += 1) {
        // Remove indices outside the window from the front.
        while (deque.length > 0 && (deque[0] ?? 0) < i - k) {
            deque.shift();
        }

        // The best predecessor is the deque front.
        const best = deque[0] ?? 0;
        dp[i] = (dp[best] ?? 0) + (costs[i] ?? 0);

        // Maintain monotonicity: pop from the back while dp[i] ≤ dp[back].
        while (
            deque.length > 0 &&
            (dp[deque[deque.length - 1] ?? 0] ?? Infinity) >= (dp[i] ?? Infinity)
        ) {
            deque.pop();
        }
        deque.push(i);

        const states = new Map<number, EntityState>([
            [i, "comparing"],
            [best, "highlight"],
        ]);
        yield {
            stepNumber: step,
            entities: makeCells(dp, states),
            edges: [],
            description: `dp[${i}] = dp[${best}] + ${costs[i]} = ${dp[i]} (deque [${deque.join(", ")}]).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n, k },
        };
        step += 1;
    }

    const finalStates = new Map<number, EntityState>([[n - 1, "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeCells(dp, finalStates),
        edges: [],
        description: `Minimum cost to reach the end = ${dp[n - 1]}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { n, k, answer: dp[n - 1] },
    };
}

/** The Monotonic Queue DP module, registered with the engine. */
const module: AlgorithmModule = {
    id: "monotonic-queue-dp",
    name: "Monotonic Queue DP",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    // A jumping-cost array with a window of 3.
    defaultInput: { costs: [0, 3, 1, 2, 5, 1, 2, 1], window: 3 },
    visualType: "grid",
    run,
};

export default module;
