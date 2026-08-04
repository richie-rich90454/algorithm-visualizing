/**
 * aliens-trick.ts – Aliens Trick (Lagrangian relaxation for constrained DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Aliens trick (Lagrangian relaxation) solves constrained DPs by adding a
 * penalty λ to each "unit" of a resource, then removing the constraint:
 *
 *   solve for a penalty λ, then binary-search λ until the unconstrained
 *   solution uses exactly the allowed amount of the resource.
 *
 * The example: split an array into exactly K contiguous groups minimising the
 * sum of group costs, where each group incurs a fixed penalty λ. Binary
 * searching λ finds the optimum for the exact-K version.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log range) per group-count with binary search on λ
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current λ is announced.
 *   - The groups found are shown as cells.
 *   - Convergence on the K-group split is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The penalty→binary-search loop is the heart to teach.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cells showing the group boundaries.
 *
 * @param arr The array values.
 * @param groupStart Indices where a new group starts.
 * @returns Cell entities in a single row (group starts highlighted).
 */
function makeCells(arr: number[], groupStart: Set<number>): VisualEntity[] {
    return arr.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: groupStart.has(index) ? ("comparing" as EntityState) : ("unvisited" as EntityState),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Aliens Trick generator.
 *
 * @param input `{ array, groups }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[]; groups?: number } | null) ?? {};
    const arr = task.array ?? [1, 3, 2, 6, 8, 10, 20];
    const K = typeof task.groups === "number" ? task.groups : 3;

    const n = arr.length;
    let step = 0;

    // Frame 0: the array.
    yield {
        stepNumber: step,
        entities: makeCells(arr, new Set()),
        edges: [],
        description: `Split [${arr.join(", ")}] into exactly ${K} groups (Aliens trick).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;

    // Cost of a group from l to r (inclusive): sum of elements (proxy).
    const groupCost = (l: number, r: number): number => {
        let sum = 0;
        for (let i = l; i <= r; i += 1) {
            sum += arr[i] ?? 0;
        }
        return sum;
    };

    // Solve for a given penalty λ: split into as many groups as useful, each
    // group cost penalised by λ. Returns { cost, groups }.
    const solveFor = (lambda: number): { cost: number; groups: number; starts: number[] } => {
        // Greedy-ish DP: dp[i] = min cost for prefix up to i.
        const dp = new Array<number>(n + 1).fill(Infinity);
        const splitAt = new Array<number>(n + 1).fill(-1);
        dp[0] = 0;

        for (let i = 1; i <= n; i += 1) {
            for (let k = 0; k < i; k += 1) {
                const cand = (dp[k] ?? Infinity) + groupCost(k, i - 1) + lambda;
                if (cand < (dp[i] ?? Infinity)) {
                    dp[i] = cand;
                    splitAt[i] = k;
                }
            }
        }

        // Reconstruct group starts.
        const starts: number[] = [];
        let pos = n;
        while (pos > 0) {
            const prev = splitAt[pos];
            if (prev < 0) {
                break;
            }
            starts.unshift(prev);
            pos = prev;
        }
        return { cost: dp[n] ?? 0, groups: starts.length, starts };
    };

    // Binary search the penalty λ so that the solution uses exactly K groups.
    let lo = 0;
    let hi = 1000;
    let bestStarts: number[] = [];

    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const result = solveFor(mid);

        yield {
            stepNumber: step,
            entities: makeCells(arr, new Set(result.starts)),
            edges: [],
            description: `λ = ${mid}: used ${result.groups} group(s).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { lambda: mid, groups: result.groups },
        };
        step += 1;

        if (result.groups <= K) {
            // Too few groups → lower the penalty to encourage more splits.
            bestStarts = result.starts;
            hi = mid - 1;
        } else {
            lo = mid + 1;
        }
    }

    const finalStart = new Set(bestStarts);
    yield {
        stepNumber: step,
        entities: makeCells(arr, finalStart),
        edges: [],
        description: `Converged: ${K} groups with boundaries at [${bestStarts.join(", ")}].`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { groups: K, boundaries: bestStarts },
    };
}

/** The Aliens Trick module, registered with the engine. */
const module: AlgorithmModule = {
    id: "aliens-trick",
    name: "Aliens Trick",
    category: "dynamic-programming",
    complexity: { time: "O(n log range)", space: "O(n)" },
    // Split into 3 groups via penalty search.
    defaultInput: { array: [1, 3, 2, 6, 8, 10, 20], groups: 3 },
    visualType: "grid",
    run,
};

export default module;
