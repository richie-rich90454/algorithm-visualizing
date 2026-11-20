/**
 * cherry-pickup-dp.ts - Cherry Pickup (Two-Walker DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Two collectors start at the top-left of a square grid and must both reach
 * the bottom-right, moving only right or down at each step. A cell's cherries
 * are collected only once. The DP collapses the four coordinates to the two
 * row indices because both walkers always share the same antidiagonal.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) for an n by n grid
 *   Space: O(n^2) for the DP frontier
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Board cells show their cherry value.
 *   - The two cells occupied by the walkers are YELLOW.
 *   - Cells already collected on the best route are GREEN in the final frame.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    board: number[][],
    n: number,
    walkers: [number, number][],
    collected: Set<string>,
    final: boolean,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < n; r += 1) {
        for (let c = 0; c < n; c += 1) {
            const value = board[r]?.[c] ?? 0;
            const key = `${r},${c}`;
            let state: EntityState = "unvisited";
            const isWalker = walkers.some(([wr, wc]) => wr === r && wc === c);
            if (isWalker) {
                state = "comparing";
            } else if (final && collected.has(key)) {
                state = "sorted";
            }
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, value },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { board?: number[][] } | null) ?? {};
    const raw = Array.isArray(task.board)
        ? task.board
        : [[1, 0, 1], [0, 1, 0], [1, 0, 1]];
    const n = Math.min(raw.length, 8);
    const board: number[][] = Array.from({ length: n }, (_, r) =>
        Array.from({ length: n }, (_, c) => Number(raw[r]?.[c]) || 0),
    );
    const NEG = -1e9;
    let step = 0;

    const frame = (
        walkers: [number, number][],
        collected: Set<string>,
        final: boolean,
        description: string,
        line: number,
        answer: number | null,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(board, n, walkers, collected, final),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: n, cols: n, answer, board: board.map((row) => [...row]) },
    });

    yield frame([[0, 0]], new Set(), false, `Two collectors cross an ${n} by ${n} cherry grid.`, 0, null);
    if (n === 0) {
        const empty = frame([], new Set(), true, "Empty grid, so no cherries can be collected.", 1, null);
        empty.meta["answer"] = 0;
        yield empty;
        return;
    }

    let dp: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(NEG));
    const choices: number[][][] = Array.from({ length: 2 * n - 1 }, () =>
        Array.from({ length: n }, () => new Array<number>(n).fill(0)),
    );
    dp[0]![0] = board[0]![0] ?? 0;

    for (let k = 1; k <= 2 * n - 2; k += 1) {
        const next: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(NEG));
        for (let r1 = 0; r1 < n; r1 += 1) {
            const c1 = k - r1;
            if (c1 < 0 || c1 >= n) continue;
            for (let r2 = 0; r2 < n; r2 += 1) {
                const c2 = k - r2;
                if (c2 < 0 || c2 >= n) continue;
                const gain = (board[r1]?.[c1] ?? 0) + (r1 === r2 && c1 === c2 ? 0 : (board[r2]?.[c2] ?? 0));
                let best = NEG;
                let bestR1 = r1;
                let bestR2 = r2;
                for (let p1 = r1 - 1; p1 <= r1; p1 += 1) {
                    for (let p2 = r2 - 1; p2 <= r2; p2 += 1) {
                        const prev = dp[p1]?.[p2] ?? NEG;
                        if (prev > best) {
                            best = prev;
                            bestR1 = p1;
                            bestR2 = p2;
                        }
                    }
                }
                next[r1]![r2] = best + gain;
                choices[k]![r1]![r2] = bestR1 * n + bestR2;
            }
        }
        dp = next;
        let bestRow1 = 0;
        let bestRow2 = 0;
        let bestValue = -Infinity;
        for (let r1 = 0; r1 < n; r1 += 1) {
            for (let r2 = 0; r2 < n; r2 += 1) {
                const value = next[r1]?.[r2] ?? NEG;
                if (value > bestValue) {
                    bestValue = value;
                    bestRow1 = r1;
                    bestRow2 = r2;
                }
            }
        }
        yield frame(
            [
                [bestRow1, k - bestRow1],
                [bestRow2, k - bestRow2],
            ],
            new Set(),
            false,
            `Step ${k}: the best team occupies rows ${bestRow1} and ${bestRow2} on antidiagonal ${k}.`,
            3,
            null,
        );
    }

    const answer = dp[n - 1]?.[n - 1] ?? NEG;
    const pairs: [number, number][] = [];
    let r1 = n - 1;
    let r2 = n - 1;
    for (let k = 2 * n - 2; k >= 0; k -= 1) {
        pairs.push([r1, k - r1]);
        if (r1 !== r2) pairs.push([r2, k - r2]);
        if (k > 0) {
            const prev = choices[k]![r1]![r2]!;
            r1 = Math.floor(prev / n);
            r2 = prev % n;
        }
    }
    const collected = new Set(pairs.filter(([r, c]) => r >= 0 && c >= 0).map(([r, c]) => `${r},${c}`));
    const finalFrame = frame(
        [[n - 1, n - 1]],
        collected,
        true,
        `Maximum cherries collected by both walkers: ${answer}.`,
        6,
        null,
    );
    finalFrame.meta["answer"] = answer;
    yield finalFrame;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of the two walkers as a single team taking one step at a time. After k steps both are somewhere on the k-th antidiagonal, so knowing only their two row indices fixes both column indices. Combine the best earlier team positions that can move into the current pair, and count a shared cell only once.",
        invariants: [
            "After k steps a walker at row r is at column k-r.",
            "The value stored for a pair of rows is the best cherry total for that exact pair.",
            "A cell counted twice is credited once when both walkers land on it.",
        ],
        correctness:
            "At step k every valid position of the team is determined by the two row indices. The optimal total for a pair must come from one of the at most four preceding pairs that can move right or down into it, and adding the newly reached cell values (once if shared) gives the recurrence. The base case is the starting cell, so induction over k proves the final value is optimal.",
        complexityRationale:
            "There are O(n) antidiagonals, O(n^2) row pairs per antidiagonal, and four predecessor checks, so the time is O(n^3). Storing one layer of row pairs uses O(n^2) space apart from the replay frames.",
        uses: [
            "Robotic coordination with two agents collecting shared rewards",
            "Routing two paths that may merge without double counting",
            "A classic reduction of a four-dimensional DP to three dimensions",
        ],
        references: [
            "LeetCode, 1463 Cherry Pickup II",
            "Cormen et al., Introduction to Algorithms, Chapter 15",
        ],
        workedExample:
            "On a 3 by 3 board with cherries on the anti-diagonal corners, the team can send one walker down the left edge and one across the top, then meet at the center. The DP records the shared center once and reports the best achievable total.",
    },
    id: "cherry-pickup-dp",
    name: "Cherry Pickup (Two-Walker DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: { board: [[1, 0, 1], [0, 1, 0], [1, 0, 1]] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the n by n cherry board",
        "set dp for the start pair to the value of the top-left cell",
        "for each antidiagonal k from one to two n minus two",
        "for every pair of reachable rows r1 and r2",
        "look at the four predecessor row pairs and take the best total",
        "add the values of the two reached cells, counting a shared cell once",
        "store that total and remember the predecessor for backtracking",
        "backtrack the best pair to mark the collected cells",
        "report the maximum cherry total at the destination",
    ],
};

export default module;
