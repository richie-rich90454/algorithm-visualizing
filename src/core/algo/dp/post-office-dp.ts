/**
 * post-office-dp.ts - Post Office Problem on a Line
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Villages sit at positions on a straight line and k of them are chosen as
 * post offices. Every village walks to its nearest office, and the goal is to
 * minimize the total walking distance. For a fixed consecutive block of
 * villages, the best single office sits at a median. Dynamic programming
 * partitions the sorted villages into k consecutive blocks, each served by
 * one median office.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * V^3) with the direct block-cost formula
 *   Space: O(k * V) for the DP table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The DP cell being filled is YELLOW (comparing).
 *   - Finished cells are GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";

interface Task {
    positions?: number[];
    k?: number;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const positions = [...(task.positions ?? [1, 2, 4, 7, 10, 14])].sort((a, b) => a - b);
    const n = positions.length;
    if (n === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "No villages: the minimum total distance is zero.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { optimalCost: 0, offices: 0 },
        };
        return;
    }
    const offices = Math.max(1, Math.min(n, Math.floor(task.k ?? 2)));
    const cols = offices + 1;

    // blockCost[i][j] = cost of serving villages i..j with one median office.
    const blockCost: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let j = i; j < n; j += 1) {
            const median = positions[(i + j) >> 1] as number;
            let total = 0;
            for (let t = i; t <= j; t += 1) total += Math.abs((positions[t] as number) - median);
            (blockCost[i] as number[])[j] = total;
        }
    }
    const dp: number[][] = Array.from({ length: n + 1 }, () =>
        new Array<number>(cols).fill(Infinity),
    );
    (dp[0] as number[])[0] = 0;
    const choice: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(cols).fill(-1));

    let step = 0;
    const cellId = (row: number, col: number): string => `cell-${row}-${col}`;
    const snap = (
        description: string,
        codeLineNumber: number,
        current: [number, number] | null = null,
    ): VisualFrame => {
        const entities = [];
        for (let row = 0; row <= n; row += 1) {
            for (let col = 0; col < cols; col += 1) {
                const value = (dp[row] as number[])[col] as number;
                const active = current !== null && current[0] === row && current[1] === col;
                entities.push({
                    id: cellId(row, col),
                    type: "cell" as const,
                    label: Number.isFinite(value) ? String(value) : "-",
                    value: Number.isFinite(value) ? value : 0,
                    state: active ? ("comparing" as EntityState) : Number.isFinite(value) ? ("sorted" as EntityState) : ("idle" as EntityState),
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col },
                });
            }
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description,
            codeLineNumber,
            layout: "grid",
            meta: { rows: n + 1, cols, villages: n, offices },
        };
    };

    yield snap(
        `${n} villages and ${offices} office(s): filling a ${n + 1} by ${cols} DP table.`,
        0,
    );
    step += 1;
    for (let used = 1; used < cols; used += 1) {
        for (let m = used; m <= n; m += 1) {
            let best = Infinity;
            let bestSplit = -1;
            for (let i = used - 1; i < m; i += 1) {
                const prior = (dp[i] as number[])[used - 1] as number;
                if (!Number.isFinite(prior)) continue;
                const candidate = prior + ((blockCost[i] as number[])[m - 1] as number);
                if (candidate < best) {
                    best = candidate;
                    bestSplit = i;
                }
            }
            (dp[m] as number[])[used] = best;
            (choice[m] as number[])[used] = bestSplit;
            yield snap(
                `dp[${m}][${used}] = ${best} using a block that starts after village ${bestSplit}.`,
                3,
                [m, used],
            );
            step += 1;
        }
    }

    const optimal = (dp[n] as number[])[offices] as number;
    yield {
        stepNumber: step,
        entities: snap("", 6).entities.map((entity) => ({ ...entity, state: "sorted" as EntityState })),
        edges: [],
        description: `Minimum total walking distance is ${optimal} with ${offices} post office(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { optimalCost: optimal, offices, villages: n, rows: n + 1, cols },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Sort the villages along the line. If one office must serve a consecutive block, the best place for it is a median of that block. Dynamic programming then decides where to split the sorted list into k blocks, combining the best solution for a prefix with the cost of the last block.",
        invariants: [
            "Villages served by one office form a consecutive block in sorted order.",
            "The median of a block minimizes the sum of absolute distances to its members.",
            "dp[m][j] is the minimum cost for the first m villages using j offices.",
        ],
        correctness:
            "An optimal solution assigns each office a consecutive group, because crossing assignments can be uncrossed without increasing distance. For a fixed last group the median gives its minimum cost, and trying every possible split boundary makes the recurrence consider all optimal partitions; induction over the number of villages and offices proves dp[n][k] equals the optimum.",
        complexityRationale:
            "There are O(kV) table entries and each tries up to V split points, giving O(k V^3) time with the direct block cost. The DP table and block-cost matrix use O(kV) and O(V^2) space respectively.",
        uses: [
            " locating service centers along a highway",
            " clustering one-dimensional sensor readings",
            " placing facilities to minimize travel in a corridor",
        ],
        references: [
            "Bellman, Dynamic Programming (1957)",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, dynamic programming chapter",
        ],
        workedExample:
            "Villages at 1, 2, 4, 7 with two offices can be split as {1, 2} and {4, 7}. The medians are 1 and 4, so the distances are 1 and 3, for a total of 4. Any other split, such as {1} and {2, 4, 7}, costs at least as much.",
    },
    id: "post-office-dp",
    name: "Post Office Problem (Line DP)",
    category: "dynamic-programming",
    complexity: { time: "O(k * V^3)", space: "O(k * V + V^2)" },
    defaultInput: { positions: [1, 2, 4, 7, 10, 14], k: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "sort the village positions along the line",
        "precompute the median cost of every consecutive block",
        "set dp zero for zero villages and zero offices",
        "for each office count and village prefix in increasing order",
        "try every split point and add the cost of the final block",
        "store the minimum and the split that achieved it",
        "done: dp at all villages with all offices is the optimum",
    ],
};

export default module;
