/**
 * minimum-cost-merge-stones.ts - Minimum Cost to Merge Stones (Interval DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a row of stone piles, merge exactly K consecutive piles at a time into
 * one pile whose weight is the sum of the merged piles, paying that sum as the
 * cost. An interval DP finds the cheapest sequence of merges. A solution can
 * only exist when (n-1) is divisible by (K-1), because every merge reduces the
 * pile count by K-1.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3 * K) for the interval DP with K-way splits
 *   Space: O(n^2) for the table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The cells form the dp table, one per stone interval.
 *   - The interval currently being filled is highlighted yellow.
 *   - The final cell holds the minimum total merge cost in green.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    table: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < table.length; row += 1) {
        const line = table[row] ?? [];
        for (let col = 0; col < line.length; col += 1) {
            const value = line[col] ?? 0;
            const finite = Number.isFinite(value);
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: finite ? String(value) : "-",
                value: finite ? value : 0,
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
    const task = (input as { stones?: number[]; arr?: number[]; k?: number } | null) ?? {};
    const stones = (task.stones ?? task.arr ?? [4, 3, 3, 4])
        .map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0))
        .slice();
    const k = Math.max(2, Math.min(stones.length || 2, Math.floor(task.k ?? 2)));
    const n = stones.length;
    let step = 0;

    if (n === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "No stones - the merge cost is zero.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { stones: 0, k, answer: 0, feasible: true },
        };
        return;
    }

    const emptyTable = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    if ((n - 1) % (k - 1) !== 0) {
        yield {
            stepNumber: step,
            entities: makeCells(emptyTable, new Map([[`0,${n - 1}`, "error"]])),
            edges: [],
            description: `Cannot merge ${n} piles ${k} at a time: each merge removes ${k - 1} piles, so (n-1) must be divisible by (k-1).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { stones: n, k, answer: 0, feasible: false },
        };
        return;
    }

    yield {
        stepNumber: step,
        entities: makeCells(emptyTable),
        edges: [],
        description: `Set up the ${n} by ${n} interval table for ${n} piles merged ${k} at a time.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { stones: n, k, answer: 0, feasible: true },
    };
    step += 1;

    const prefix = [0];
    for (const stone of stones) {
        prefix.push((prefix[prefix.length - 1] ?? 0) + stone);
    }
    const sum = (i: number, j: number): number => (prefix[j + 1] ?? 0) - (prefix[i] ?? 0);
    const table = Array.from({ length: n }, () => new Array<number>(n).fill(Number.POSITIVE_INFINITY));
    for (let i = 0; i < n; i += 1) {
        table[i]![i] = 0;
    }

    const splitMemo = new Map<string, number>();
    const splitCost = (i: number, j: number, parts: number): number => {
        if (parts === 1) {
            return table[i]?.[j] ?? Number.POSITIVE_INFINITY;
        }
        const key = `${i},${j},${parts}`;
        const cached = splitMemo.get(key);
        if (cached !== undefined) {
            return cached;
        }
        let best = Number.POSITIVE_INFINITY;
        for (let t = i; t < j; t += k - 1) {
            const left = table[i]?.[t] ?? Number.POSITIVE_INFINITY;
            const right = splitCost(t + 1, j, parts - 1);
            if (left < Number.POSITIVE_INFINITY && right < Number.POSITIVE_INFINITY) {
                best = Math.min(best, left + right);
            }
        }
        splitMemo.set(key, best);
        return best;
    };

    for (let length = 1; length <= n; length += 1) {
        for (let i = 0; i + length <= n; i += 1) {
            const j = i + length - 1;
            if (length > 1 && (length - 1) % (k - 1) === 0) {
                const best = splitCost(i, j, k);
                table[i]![j] = best + sum(i, j);
            }
            const states = new Map<string, EntityState>([[`${i},${j}`, "comparing"]]);
            yield {
                stepNumber: step,
                entities: makeCells(table, states),
                edges: [],
                description: `Interval ${i}..${j}: cost ${Number.isFinite(table[i]?.[j] ?? Infinity) ? table[i]?.[j] : "impossible"}.`,
                codeLineNumber: length === 1 ? 1 : 3,
                layout: "grid",
                meta: { stones: n, k, interval: [i, j], answer: table[i]?.[j] ?? 0 },
            };
            step += 1;
        }
    }

    const answer = table[0]?.[n - 1] ?? 0;
    const finalStates = new Map<string, EntityState>([[`0,${n - 1}`, "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeCells(table, finalStates),
        edges: [],
        description: `Done: the minimum cost to merge all ${n} piles is ${answer}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { stones: n, k, answer, feasible: true, stonesInput: stones },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of the final merge as the last operation that joins K already-merged blocks. Each block occupies a consecutive interval of the original row, and its own cheapest cost is a smaller version of the same question. Filling the table by increasing interval length makes every smaller answer available before it is needed.",
        invariants: [
            "Every dp entry merges exactly one consecutive interval into a single pile.",
            "An interval of length m is mergeable only when (m-1) is a multiple of (K-1).",
            "The added term in each recurrence is the total weight of the interval being merged.",
        ],
        correctness:
            "The last merge of any optimal solution splits the row into exactly K consecutive mergeable subintervals. By induction each subinterval value in the table is optimal, so minimizing their sum plus the interval weight gives the optimal cost for the whole interval. The base case of a single pile costs zero, so the table entry for the full row is the global optimum.",
        complexityRationale:
            "There are O(n^2) intervals and each explores K-way splits with total O(nK) work through the recursion, giving about O(n^3*K) time and O(n^2) table space.",
        uses: [
            "Optimal file and tape merging with a fixed fan-in",
            "Stone-merging puzzles in competitive programming",
            "Matrix-chain-style problems with a fixed merge arity",
        ],
        references: [
            "Cormen et al., Introduction to Algorithms, Chapter 15 (dynamic programming)",
            "Knuth, The Art of Computer Programming, Vol. 3, optimal merge patterns",
        ],
        workedExample:
            "With stones 4, 3, 3, 4 and K=2, merging the outer pairs first costs 7 + 7 = 14 and the last merge costs another 14, for 28 total. Merging the middle pair first costs 6, then 10, then 14, for 30, so the interval DP returns 28.",
    },
    id: "minimum-cost-merge-stones",
    name: "Minimum Cost to Merge Stones",
    category: "dynamic-programming",
    complexity: { time: "O(n^3 * K)", space: "O(n^2)" },
    defaultInput: { stones: [4, 3, 3, 4], k: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "reject inputs where (n-1) is not divisible by (k-1)",
        "build prefix sums of the stone weights",
        "initialize dp[i][i] to zero for every pile",
        "for each interval length from two up to n",
        "split the interval into k mergeable consecutive parts",
        "dp[i][j] is the best split cost plus the interval weight",
        "done: dp[0][n-1] is the minimum merge cost",
    ],
};

export default module;
