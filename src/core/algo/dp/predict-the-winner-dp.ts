/**
 * predict-the-winner-dp.ts - Predict the Winner (Interval DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Two players alternate taking a number from either end of a row. Both play
 * optimally. The DP value dp[i][j] is the largest score difference the player
 * to move can obtain over the opponent from the subarray i through j. A
 * nonnegative value at the full range means the first player wins or ties.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2)
 *   Space: O(n^2) for the interval table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cell (i, j) shows the score difference for that interval.
 *   - The cell being filled is YELLOW; finished intervals are GREEN.
 *   - The final frame states the winner and the winning margin.
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
    const task = (input as { scores?: number[] } | null) ?? {};
    const scores = Array.isArray(task.scores)
        ? task.scores.map((v) => Number(v) || 0)
        : [1, 5, 2];
    const n = scores.length;
    const dp: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    let step = 0;

    const frame = (
        active: [number, number] | null,
        final: boolean,
        description: string,
        line: number,
        answer: number | null,
    ): VisualFrame => {
        const f: VisualFrame = {
            stepNumber: step++,
            entities: makeCells(dp, n, active),
            edges: [],
            description,
            codeLineNumber: line,
            layout: "grid",
            meta: { rows: n, cols: n, scores: [...scores], answer },
        };
        return f;
    };

    yield frame(null, false, `Two players pick from either end of ${n} score(s).`, 0, null);
    if (n === 0) {
        const empty = frame(null, true, "No scores, so the game is a tie at zero.", 1, null);
        empty.meta["answer"] = 0;
        yield empty;
        return;
    }

    for (let i = 0; i < n; i += 1) dp[i]![i] = scores[i] ?? 0;
    yield frame(null, false, "A single-element interval gives that score to the player to move.", 2, null);

    for (let len = 2; len <= n; len += 1) {
        for (let i = 0; i + len <= n; i += 1) {
            const j = i + len - 1;
            const takeLeft = (scores[i] ?? 0) - (dp[i + 1]?.[j] ?? 0);
            const takeRight = (scores[j] ?? 0) - (dp[i]?.[j - 1] ?? 0);
            dp[i]![j] = Math.max(takeLeft, takeRight);
        }
        yield frame(
            [0, len - 1],
            false,
            `Intervals of length ${len}: compare taking the left end versus the right end.`,
            3,
            null,
        );
    }

    const answer = dp[0]?.[n - 1] ?? 0;
    const finalFrame = frame(
        null,
        true,
        answer > 0
            ? `First player wins by ${answer}.`
            : answer < 0
                ? `Second player wins by ${-answer}.`
                : "With optimal play the game is a tie.",
        6,
        null,
    );
    finalFrame.meta["answer"] = answer;
    finalFrame.meta["winner"] = answer > 0 ? "first" : answer < 0 ? "second" : "tie";
    yield finalFrame;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of tracking both players' totals, track only how much more than the opponent the current player can get from a remaining interval. Taking an end gives its value now but hands the opponent the rest, so subtract the best difference the opponent can then achieve.",
        invariants: [
            "dp[i][j] is the maximum score difference for the player to move on scores i through j.",
            "dp[i][i] equals the single remaining score.",
            "Only intervals shorter than the current one are consulted.",
        ],
        correctness:
            "For a one-element interval the player must take that element. For a longer interval the player takes either end; the opponent then faces the remaining interval and can secure dp of that remainder as an advantage. The resulting difference is the taken value minus that advantage, and the player chooses the larger of the two ends. By induction on interval length dp[0][n-1] is the optimal first-player advantage.",
        complexityRationale:
            "The nested loops fill one cell for each of the O(n^2) intervals with constant work, giving O(n^2) time. The triangular table stores O(n^2) integers.",
        uses: [
            "Optimal play analysis for two-player draft and picker games",
            "Game-tree reasoning compressed into interval DP",
            "A standard example of minimax optimization on subarrays",
        ],
        references: [
            "LeetCode, 486 Predict the Winner",
            "Cormen et al., Introduction to Algorithms, Chapter 15",
        ],
        workedExample:
            "With scores [1, 5, 2], the first player takes 2 from the right. The opponent then chooses between [1,5] and takes 5, leaving 1 for the first player. The totals are 3 versus 5, so the first player loses with a difference of -2.",
    },
    id: "predict-the-winner-dp",
    name: "Predict the Winner (Interval DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: { scores: [1, 5, 2] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the scores array of length n",
        "if n is zero the game is a tie at zero",
        "set every dp[i][i] to scores[i]",
        "for interval length from two to n",
        "for each start i with end j equal to i plus length minus one",
        "set left to scores[i] minus dp[i+1][j]",
        "set right to scores[j] minus dp[i][j-1]",
        "set dp[i][j] to the larger of left and right",
        "report dp[0][n-1] and the winner",
    ],
};

export default module;
