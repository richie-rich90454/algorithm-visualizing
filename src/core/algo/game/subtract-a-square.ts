/**
 * subtract-a-square.ts - Subtract-a-Square
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Subtract-a-square is an impartial combinatorial game played on a heap of n
 * tokens. A move removes a positive perfect square from the heap, and the
 * player who takes the last token wins. Dynamic programming classifies each
 * heap size as winning or losing: a position wins exactly when some legal
 * square leaves the opponent a losing position.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * Play is normal (the player unable to move loses), both players have the same
 * moves, and squares are positive integers k squared. The analysis is finite
 * up to the requested heap size; no Sprague-Grundy generalization to multiple
 * heaps is performed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(n sqrt(n)); Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the win or lose verdict for each heap size up to n.
 *   - The bar being classified is highlighted during the sweep.
 *   - The final frame marks the target heap and its winning moves.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function squaresUpTo(n: number): number[] {
    const out: number[] = [];
    for (let k = 1; k * k <= n; k += 1) {
        out.push(k * k);
    }
    return out;
}

function bars(win: boolean[], active: number, target: number): VisualEntity[] {
    return win.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${index}:${value ? "W" : "L"}`,
        value: value ? 1 : 0,
        state: (index === target ? "sorted" : index === active ? "comparing" : value ? "visited" : "idle") as VisualEntity["state"],
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, win: value ? 1 : 0, outcome: value ? "W" : "L" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = Math.max(1, Math.min(60, typeof task.n === "number" ? Math.floor(task.n) : 12));
    const squares = squaresUpTo(n);
    const win = new Array<boolean>(n + 1).fill(false);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(win, -1, n),
        edges: [],
        description: `Classify heap sizes from 0 to ${n}; the empty heap is a losing position because no move exists.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, squares: [...squares], win: win.map((w) => (w ? 1 : 0)) },
    };
    step += 1;

    for (let size = 1; size <= n; size += 1) {
        let isWin = false;
        for (const square of squares) {
            if (square > size) {
                break;
            }
            if (!win[size - square]) {
                isWin = true;
                break;
            }
        }
        win[size] = isWin;
        yield {
            stepNumber: step,
            entities: bars(win, size, n),
            edges: [],
            description: `Heap ${size} is ${isWin ? "winning" : "losing"} because ${isWin ? "some square leaves a losing heap" : "every square leaves a winning heap"}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, size, win: win.map((w) => (w ? 1 : 0)), verdict: isWin ? 1 : 0 },
        };
        step += 1;
    }

    const bestMoves = squares.filter((square) => square <= n && !win[n - square]);
    yield {
        stepNumber: step,
        entities: bars(win, -1, n),
        edges: [],
        description: `Heap ${n} is ${win[n] ? "winning" : "losing"}; winning first moves remove ${bestMoves.length > 0 ? bestMoves.join(", ") : "no square"}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            n,
            win: win.map((w) => (w ? 1 : 0)),
            bestMoves: [...bestMoves],
            outcome: win[n] ? "W" : "L",
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A heap is losing only if every legal move hands the opponent a winning heap. Start at zero, which is losing because there is no move, then build upward. For each size, look at the positions reached by removing a square: if any of them is losing, the current player can move there and win.",
        invariants: [
            "The empty heap has verdict losing.",
            "A heap is marked winning if and only if at least one square leads to a losing heap.",
            "The verdict for a heap depends only on smaller heaps, so the sweep is well founded.",
        ],
        correctness:
            "The proof is induction on the heap size. At size zero there is no legal move, so losing is correct. Assume all smaller heaps are classified correctly. Removing a square from size s leads only to smaller heaps, whose verdicts are already correct by the induction hypothesis. If any resulting heap is losing, the current player moves there and wins; if all are winning, every move hands the opponent a winning position, so s is losing. Thus the update rule marks exactly the winning positions.",
        complexityRationale:
            "For each of the n heap sizes the scan considers at most sqrt(n) squares, giving O(n sqrt(n)) time. Storing one boolean per heap size uses O(n) space.",
        uses: [
            "Computing winning positions in subtraction games",
            "Teaching impartial games and normal-play conventions",
            "Checking a strategy table for a one-heap take-away puzzle",
        ],
        references: [
            "Berlekamp, Conway and Guy, Winning Ways for Your Mathematical Plays (1982)",
            "Conway, On Numbers and Games (1976)",
        ],
        workedExample:
            "Heap 0 is losing. Heap 1 is winning because removing 1 reaches 0. Heap 2 is losing because removing 1 reaches the winning heap 1. Heap 3 is winning by removing 1 to heap 2. Heap 4 is winning because removing 4 reaches 0. The winning moves from heap 4 are squares that land on a losing heap, namely removing 4.",
    },
    id: "subtract-a-square",
    name: "Subtract-a-Square",
    category: "game",
    complexity: { time: "O(n sqrt(n))", space: "O(n)" },
    defaultInput: { n: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "mark heap zero as losing",
        "list the positive squares up to n",
        "for each heap size from one to n",
        "for each square at most that size",
        "if removing it leaves a losing heap mark this heap winning",
        "collect the squares that leave a losing heap from n",
        "report the verdict and winning first moves",
    ],
};

export default module;
