/**
 * guess-number-higher-lower-dp.ts - Guess Number Higher or Lower (Minimax DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A hidden number lies in the range 1 through n. Guessing k costs a known fee
 * and the answer says only "higher" or "lower". For every interval dp[i][j]
 * stores the smallest possible worst-case cost, obtained by picking the guess
 * that minimizes the fee plus the larger of the two remaining subproblems.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3)
 *   Space: O(n^2) for the interval table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cell (i, j) shows the minimax cost for the inclusive range i through j.
 *   - The cell being filled is YELLOW; finalized cells are GREEN.
 *   - The final frame reports the worst-case cost for the full range.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(dp: number[][], n: number, active: [number, number] | null): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const value = dp[i]?.[j] ?? 0;
            const known = i >= j;
            let state: EntityState = "unvisited";
            if (known) {
                state = active && active[0] === i && active[1] === j ? "comparing" : "visited";
            }
            cells.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, filled: known },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { costs?: number[] } | null) ?? {};
    const costs = Array.isArray(task.costs)
        ? task.costs.map((v) => Math.max(0, Number(v) || 0))
        : [1, 3, 2, 4];
    const n = costs.length;
    const dp: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const bestGuess: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    let step = 0;

    const frame = (
        active: [number, number] | null,
        final: boolean,
        description: string,
        line: number,
        answer: number | null,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(dp, n, active),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: n, cols: n, costs: [...costs], answer },
    });

    yield frame(null, false, `Minimizing worst-case cost to find a hidden number in 1 through ${n}.`, 0, null);
    if (n === 0) {
        const empty = frame(null, true, "No candidates, so the cost is zero.", 1, null);
        empty.meta["answer"] = 0;
        yield empty;
        return;
    }

    for (let i = 0; i < n; i += 1) dp[i]![i] = costs[i] ?? 0;
    yield frame(null, false, "A single candidate costs exactly that guess once.", 2, null);

    for (let len = 2; len <= n; len += 1) {
        for (let i = 0; i + len <= n; i += 1) {
            const j = i + len - 1;
            let best = Infinity;
            let chosen = i;
            for (let g = i; g <= j; g += 1) {
                const left = g === i ? 0 : (dp[i]?.[g - 1] ?? 0);
                const right = g === j ? 0 : (dp[g + 1]?.[j] ?? 0);
                const worst = (costs[g] ?? 0) + Math.max(left, right);
                if (worst < best) {
                    best = worst;
                    chosen = g;
                }
            }
            dp[i]![j] = best;
            bestGuess[i]![j] = chosen;
        }
        yield frame(
            [0, len - 1],
            false,
            `Range length ${len}: try every guess and keep the smallest worst-case fee.`,
            3,
            null,
        );
    }

    const answer = dp[0]?.[n - 1] ?? 0;
    const finalFrame = frame(null, true, `Minimum worst-case guessing cost is ${answer}.`, 7, null);
    finalFrame.meta["answer"] = answer;
    finalFrame.meta["firstGuess"] = bestGuess[0]?.[n - 1] ?? 0;
    yield finalFrame;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "For a range of candidates, choose a guess and consider the worse of the two answers you might receive. That worse branch becomes the cost you must plan for, so pick the guess that makes this worst case as small as possible. Solve short ranges first and build up to the full range.",
        invariants: [
            "dp[i][j] is the minimum achievable worst-case cost on candidates i through j.",
            "A guess splits the range into a lower and a higher subrange.",
            "The cost of a guess is paid once and added to the subsequent branch.",
        ],
        correctness:
            "With one candidate the only guess must be paid once. For a longer range, after guessing g the opponent chooses the answer that leads to the larger remaining cost, so the true cost of guessing g is its fee plus that maximum. Taking the minimum over all g gives an optimal first guess, and induction on range length proves every stored value optimal.",
        complexityRationale:
            "For each of O(n^2) intervals the algorithm tries up to n guesses, giving O(n^3) time. The interval table and the chosen-guess table each use O(n^2) space.",
        uses: [
            "Designing decision trees with nonuniform query costs",
            "Minimax planning under adversarial feedback",
            "A compact example of interval DP beyond simple recurrences",
        ],
        references: [
            "LeetCode, 375 Guess Number Higher or Lower II",
            "Cormen et al., Introduction to Algorithms, Chapter 15",
        ],
        workedExample:
            "With guess costs [1, 3, 2, 4], guessing candidate 3 first costs 2. If the answer is higher only candidate 4 remains, costing 4 more for a total of 6; if lower, the two-candidate range costs 4 more. The minimax value for the full range is 6.",
    },
    id: "guess-number-higher-lower-dp",
    name: "Guess Number Higher or Lower (Minimax DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: { costs: [1, 3, 2, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the guess fee for each candidate one through n",
        "if n is zero the cost is zero and stop",
        "set dp[i][i] to the fee of candidate i",
        "for range length from two to n",
        "for every start i and end j of that length",
        "for each guess g between i and j",
        "set worst to fee[g] plus the larger of dp[i][g-1] and dp[g+1][j]",
        "set dp[i][j] to the smallest worst value and remember g",
        "report dp[0][n-1] and the optimal first guess",
    ],
};

export default module;
