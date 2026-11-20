/**
 * tic-tac-toe-solver.ts - Tic-Tac-Toe Solver (Minimax)
 *
 * Solves the 3 by 3 game exactly by minimax: X maximizes and O minimizes the
 * outcome, with wins scored relative to depth so quicker wins and slower losses
 * are preferred. The root view shows the value of every legal first move.
 *
 * Time: O(9!) worst case, about 5.5 x 10^5 nodes for an empty board.
 * Space: O(depth) for the recursion stack plus a constant-size board.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mark = "X" | "O" | "";

const LINES: number[][] = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
];

/** Return the winner mark, a draw flag, and whether cells remain. */
function status(board: Mark[]): { winner: Mark; full: boolean } {
    for (const line of LINES) {
        const [a, b, c] = line;
        const first = board[a] ?? "";
        if (first !== "" && first === board[b] && first === board[c]) return { winner: first, full: false };
    }
    return { winner: "", full: board.every((cell) => cell !== "") };
}

/** Exact minimax value of a position with the given player to move. */
function minimax(board: Mark[], turn: Mark, depth: number): number {
    const { winner, full } = status(board);
    if (winner === "X") return 10 - depth;
    if (winner === "O") return depth - 10;
    if (full) return 0;
    let best = turn === "X" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
    for (let i = 0; i < 9; i += 1) {
        if ((board[i] ?? "") !== "") continue;
        const next = [...board];
        next[i] = turn;
        const value = minimax(next, turn === "X" ? "O" : "X", depth + 1);
        best = turn === "X" ? Math.max(best, value) : Math.min(best, value);
    }
    return best;
}

function makeCells(board: Mark[], highlighted: Set<number>, final: boolean): VisualEntity[] {
    return board.map((mark, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: mark === "" ? "-" : mark,
        value: mark,
        state: final && highlighted.has(index) ? "sorted" : highlighted.has(index) ? "comparing" : mark === "" ? "idle" : "visited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor(index / 3), col: index % 3, index, mark },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { board?: Mark[]; turn?: Mark } | null) ?? {};
    const supplied = Array.isArray(task.board) && task.board.length === 9
        ? task.board.map((m) => (m === "X" || m === "O" ? m : ("" as Mark)))
        : (["", "", "", "", "", "", "", "", ""] as Mark[]);
    const board: Mark[] = [...supplied];
    const turn: Mark = task.turn === "O" ? "O" : "X";
    const rootStatus = status(board);
    const candidates: Array<{ index: number; value: number }> = [];
    if (rootStatus.winner === "" && !rootStatus.full) {
        for (let i = 0; i < 9; i += 1) {
            if ((board[i] ?? "") !== "") continue;
            const next = [...board];
            next[i] = turn;
            candidates.push({ index: i, value: minimax(next, turn === "X" ? "O" : "X", 1) });
        }
    }
    const extreme = candidates.length > 0
        ? (turn === "X" ? Math.max(...candidates.map((c) => c.value)) : Math.min(...candidates.map((c) => c.value)))
        : minimax(board, turn, 0);
    const bestMoves = candidates.filter((c) => c.value === extreme).map((c) => c.index);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(board, new Set(), false),
        edges: [],
        description: `Solving tic-tac-toe with ${turn} to move; minimax assigns plus for an X win and minus for an O win.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3, cols: 3, turn, value: extreme, bestMoves: [], candidates: [] },
    };
    step += 1;

    for (const candidate of candidates) {
        const next = [...board];
        next[candidate.index] = turn;
        yield {
            stepNumber: step,
            entities: makeCells(next, new Set([candidate.index]), false),
            edges: [],
            description: `Playing ${turn} at cell ${candidate.index} has minimax value ${candidate.value} for ${turn}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                rows: 3,
                cols: 3,
                turn,
                value: extreme,
                bestMoves: [],
                candidates: candidates.map((c) => `${c.index}:${c.value}`),
                considering: candidate.index,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(board, new Set(bestMoves), true),
        edges: [],
        description: `Game value ${extreme} for ${turn}; optimal move${bestMoves.length === 1 ? "" : "s"}: ${bestMoves.join(", ")}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 3,
            cols: 3,
            turn,
            value: extreme,
            bestMoves,
            candidates: candidates.map((c) => `${c.index}:${c.value}`),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Tic-tac-toe is small enough to search completely. At each position the current player tries every empty cell; X keeps the largest resulting value and O keeps the smallest. Terminal scoring rewards wins and punishes losses, and subtracting the search depth makes a quick win better than a slow one.",
        invariants: [
            "Every recursive call places exactly one mark in an empty cell.",
            "The value returned is the best outcome the player to move can force with perfect play.",
            "A terminal board returns a fixed score without further recursion.",
        ],
        correctness:
            "The base cases check all eight winning lines and the full board, returning the correct terminal scores. For nonterminal positions the recurrence considers every legal move and takes the maximum for X or minimum for O; by induction on the number of empty cells each child value is the correct value of its subtree, so the chosen extremum is the game-theoretic value. The best root moves are exactly those attaining that value.",
        complexityRationale:
            "The search tree has at most 9 factorial leaf orderings, roughly five hundred fifty thousand leaves for an empty board, and each node scans nine cells, so the worst case is O(9!). The board is copied per branch and the recursion is nine deep, so working space is O(depth) aside from the visited candidate list.",
        uses: [
            "A complete solved game used to teach adversarial search",
            "Verifying alpha-beta and other pruning techniques against exact values",
            "A baseline for game-playing agent demonstrations",
        ],
        references: [
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, Chapter 5",
            "Knuth, The Art of Computer Programming, Volume 1, section 1.2.6",
        ],
        workedExample:
            "From an empty board every first move leads to a draw against best play, so the game value is zero and all nine cells are optimal. If X already owns a line with one cell empty, playing that cell returns 10 minus the depth and is the unique best move.",
    },
    id: "tic-tac-toe-solver",
    name: "Tic-Tac-Toe Solver (Minimax)",
    category: "game",
    complexity: { time: "O(9!)", space: "O(depth)" },
    defaultInput: { board: ["", "", "", "", "", "", "", "", ""], turn: "X" },
    visualType: "grid",
    run,
    pseudocode: [
        "read the nine-cell board and the player to move",
        "check the eight winning lines and the full-board draw",
        "if X has a line return ten minus the current depth",
        "if O has a line return the current depth minus ten",
        "otherwise try every empty cell and recurse with the other player",
        "take the maximum value for X and the minimum for O",
        "report the root value and every move attaining it",
    ],
};

export default module;
