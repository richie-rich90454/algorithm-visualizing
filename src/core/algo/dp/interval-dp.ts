/**
 * interval-dp.ts - Minimum Cost to Merge Stones (interval DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a row of stone piles, repeatedly merge two adjacent piles into one.
 * The cost of a merge is the total weight of the new pile. The goal is the
 * cheapest sequence of merges that reduces the whole row to a single pile.
 *
 * The interval recurrence is
 *
 *   dp[i][j] = min over k in [i, j-1] of
 *              dp[i][k] + dp[k+1][j] + sum(stones[i..j])
 *
 * with dp[i][i] = 0. Intervals grow by length, so every smaller interval is
 * final before a larger one reads it. This is the classic interval-DP shape
 * distinct from matrix-chain multiplication (whose merge cost is a triple
 * product) and from the optimal binary search tree solved by Knuth's
 * optimization.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) - n^2 intervals, each scanning up to n split points
 *   Space: O(n^2) - the dp table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The interval currently being solved is YELLOW (comparing).
 *   - The two subintervals joined by the trial split are PINK (highlight).
 *   - A finalized interval is GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const current = matrix[row];
        if (!current) {
            continue;
        }
        for (let col = 0; col < current.length; col += 1) {
            const value = current[col];
            if (value === undefined) {
                continue;
            }
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: value === Infinity ? "-" : String(value),
                value,
                state: states.get(`${row},${col}`) ?? "unvisited",
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

/** Minimum merge cost by brute-force enumeration over every binary merge order. */
function bruteMerge(stones: number[], lo: number, hi: number): number {
    if (lo >= hi) {
        return 0;
    }
    let total = 0;
    for (let i = lo; i <= hi; i += 1) {
        total += stones[i] ?? 0;
    }
    let best = Infinity;
    for (let k = lo; k < hi; k += 1) {
        const cost = bruteMerge(stones, lo, k) + bruteMerge(stones, k + 1, hi) + total;
        if (cost < best) {
            best = cost;
        }
    }
    return best;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { stones?: number[] } | null) ?? {};
    const stones = (task.stones ?? [4, 3, 3, 4]).slice();
    const n = stones.length;
    let step = 0;

    if (n <= 1) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: `Fewer than two piles: ${n} pile needs no merges, cost 0.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: 1, cols: 1, answer: 0 },
        };
        return;
    }

    const prefix: number[] = [0];
    for (const weight of stones) {
        prefix.push((prefix[prefix.length - 1] ?? 0) + weight);
    }

    const dp: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(Infinity));
    for (let i = 0; i < n; i += 1) {
        dp[i][i] = 0;
    }

    yield {
        stepNumber: step,
        entities: makeCells(dp),
        edges: [],
        description: `Interval DP over ${n} piles: diagonal intervals have cost zero.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n },
    };
    step += 1;

    for (let length = 2; length <= n; length += 1) {
        for (let i = 0; i + length - 1 < n; i += 1) {
            const j = i + length - 1;
            const intervalSum = (prefix[j + 1] ?? 0) - (prefix[i] ?? 0);
            let best = Infinity;
            let bestSplit = -1;

            for (let k = i; k < j; k += 1) {
                const candidate = (dp[i][k] ?? Infinity) + (dp[k + 1][j] ?? Infinity) + intervalSum;
                if (candidate < best) {
                    best = candidate;
                    bestSplit = k;
                }
                const states = new Map<string, EntityState>([
                    [`${i},${j}`, "comparing"],
                    [`${i},${k}`, "highlight"],
                    [`${k + 1},${j}`, "highlight"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeCells(dp, states),
                    edges: [],
                    description: `Interval [${i}, ${j}] split at ${k}: cost ${candidate} with pile sum ${intervalSum}.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: { rows: n, cols: n },
                };
                step += 1;
            }

            dp[i][j] = best;
            yield {
                stepNumber: step,
                entities: makeCells(dp, new Map([[`${i},${j}`, "sorted"]])),
                edges: [],
                description: `dp[${i}][${j}] = ${best} with best split ${bestSplit}.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { rows: n, cols: n },
            };
            step += 1;
        }
    }

    const answer = dp[0][n - 1] ?? 0;
    yield {
        stepNumber: step,
        entities: makeCells(dp, new Map([[`0,${n - 1}`, "sorted"]])),
        edges: [],
        description: `Minimum cost to merge all ${n} piles into one is ${answer}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: n, cols: n, answer, bruteForce: bruteMerge(stones, 0, n - 1) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of every contiguous run of piles as a subproblem. To merge a whole run you make one last merge that joins two smaller adjacent runs, so the cost of the run is the cheapest pair of sub-runs plus the weight of the combined pile. Filling in shorter runs first means the answer to every sub-run is ready when a longer run needs it.",
        invariants: [
            "dp[i][j] is the minimum cost to merge piles i through j into one pile.",
            "dp[i][i] is zero because a single pile needs no merges.",
            "The cost of the final merge of a run is the sum of every pile in that run.",
            "Intervals are solved in increasing length, so each split reads only finalized subintervals.",
        ],
        correctness:
            "Any merge sequence for interval [i, j] has a last merge that joins [i, k] and [k+1, j] for some k. The cost is the optimal cost of each side plus the sum of the whole interval, which is independent of k. Trying every k and taking the minimum therefore finds the best possible last merge, and induction on interval length shows dp[i][j] is optimal. The full row answer dp[0][n-1] follows.",
        complexityRationale:
            "There are O(n^2) intervals and each scans up to n split points, for O(n^3) time. The triangular table of intervals uses O(n^2) space; the prefix sums need only O(n).",
        uses: [
            "Optimal merge patterns for sequential file and tape concatenation",
            "Huffman-style combining where adjacency constraints apply",
            "A teaching example for the interval-DP recurrence family",
        ],
        references: [
            "Cormen et al., Introduction to Algorithms, Chapter 15 (dynamic programming)",
            "Kleinberg and Tardos, Algorithm Design, Chapter 6 (dynamic programming)",
        ],
        workedExample:
            "With piles [4, 3, 3, 4], the two length-two intervals (4,3) and (3,4) each cost 7. Merging those two piles of 7 costs another 14, so the total is 28. Starting with (3,3) instead costs 6 then 10 then 14, which totals 30, so 28 is optimal.",
    },
    id: "interval-dp",
    name: "Interval DP (Merge Stones)",
    category: "dynamic-programming",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: { stones: [4, 3, 3, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "build prefix sums of the pile weights",
        "set dp[i][i] <- 0 for every single pile",
        "for each interval length from 2 up to n",
        "for each start i, let j <- i + length - 1",
        "for each split k from i to j-1",
        "candidate <- dp[i][k] + dp[k+1][j] + sum(stones[i..j])",
        "keep the smallest candidate as dp[i][j]",
        "answer <- dp[0][n-1] after all intervals are filled",
    ],
};

export default module;
