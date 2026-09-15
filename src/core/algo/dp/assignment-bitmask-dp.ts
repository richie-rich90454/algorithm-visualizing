/**
 * assignment-bitmask-dp.ts - Assignment (Bitmask DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[mask] <- min over j in mask of dp[mask ^ (1<<j)] + cost[k-1][j].
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n\u00b2\u00b72^n)
 *   Space: O(2^n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
   - The cell being computed is YELLOW (comparing).
   - Source cells for the transition are BLUE (active).
   - The optimal value and path are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - States build in dependency order so every transition reads final values.
 *   - The recurrence above is the single idea to memorize.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const r = matrix[row];
        if (!r) continue;
        for (let col = 0; col < r.length; col += 1) {
            const value = r[col];
            if (value === undefined) continue;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: states.get(`${row},${col}`) ?? "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { cost?: number[][] } | null) ?? {};
    const cost = task.cost ?? [
        [9, 2, 7],
        [6, 4, 3],
        [5, 8, 1],
    ];
    let step = 0;
    if (cost.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty cost matrix \u2013 cost 0.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const n = cost.length;
    const size = 1 << n;
    const INF = 1e9;
    const dp: number[] = new Array<number>(size).fill(INF);
    dp[0] = 0;
    const show = () => [dp.map((v) => (v >= INF ? -1 : v))];
    const popcount = (x: number): number => {
        let c = 0;
        while (x > 0) {
            c += x & 1;
            x >>= 1;
        }
        return c;
    };
    yield {
        stepNumber: step,
        entities: makeCells(show()),
        edges: [],
        description: `Assign ${n} workers to ${n} jobs. dp[0] = 0.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let k = 1; k <= n; k += 1) {
        for (let mask = 0; mask < size; mask += 1) {
            if (popcount(mask) !== k) continue;
            let best = INF;
            for (let j = 0; j < n; j += 1) {
                if ((mask & (1 << j)) !== 0) {
                    const cand = (dp[mask ^ (1 << j)] ?? INF) + (cost[k - 1]?.[j] ?? 0);
                    if (cand < best) best = cand;
                }
            }
            dp[mask] = best;
        }
        const states = new Map<string, EntityState>([[`0,${size - 1}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(show(), states),
            edges: [],
            description: `Worker ${k - 1} placed: dp[${size - 1}] = ${dp[size - 1] >= INF ? "inf" : dp[size - 1]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    const answer = dp[size - 1] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(show(), new Map([[`0,${size - 1}`, "sorted"]])),
        edges: [],
        description: `Traceback: min assignment cost = ${answer}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer },
    };
}

const module: AlgorithmModule = {
    id: "assignment-bitmask-dp",
    name: "Assignment (Bitmask DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b2\u00b72^n)", space: "O(2^n)" },
    defaultInput: {
        cost: [
            [9, 2, 7],
            [6, 4, 3],
            [5, 8, 1],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "set up n x n cost matrix, dp[mask] <- infinity, dp[0] <- 0",
        "mask over jobs holds which jobs are taken so far",
        "dp[mask] <- min over j in mask of dp[mask ^ (1<<j)] + cost[k-1][j]",
        "iterate masks grouped by popcount k = worker index",
        "fill dp for all masks with k bits before moving to k+1",
        "track best cost per mask across worker assignments",
        "answer <- dp[(1<<n)-1] with assignment reconstructed via parent",
    ],};

export default module;
