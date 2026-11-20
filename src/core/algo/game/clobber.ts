/**
 * clobber.ts - Clobber (memoized impartial game solver)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Clobber is a two-player game on a grid of black and white stones. On a turn a
 * player moves one of their stones onto an orthogonally adjacent opponent stone,
 * capturing it; the origin becomes empty and the captured square changes color.
 * A player with no legal move loses. A memoized minimax search classifies the
 * position and extracts one optimal line of play.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is the standard orthogonal-grid game on boards with at most nine cells.
 * Diagonal captures, toroidal boards, and misere variants are not modeled. The
 * search is exhaustive over reachable board states under the given size limit.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(states * cells * 4) with memoization over (board, player) states
 *   Space: O(states) for the memo table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show black stones, white stones, and empty squares.
 *   - Each frame highlights the origin and captured square of one move.
 *   - The final frame reports which player wins under optimal play.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface ClobberInput {
    rows?: number;
    cols?: number;
    board?: string;
}

const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

function parseBoard(board: string, cells: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < cells; i += 1) {
        const ch = board[i];
        out.push(ch === "B" ? BLACK : ch === "W" ? WHITE : EMPTY);
    }
    return out;
}

/** All legal moves for a player: [origin, captured] cell pairs. */
function legalMoves(board: number[], rows: number, cols: number, player: number): number[][] {
    const foe = player === BLACK ? WHITE : BLACK;
    const out: number[][] = [];
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            const from = r * cols + c;
            if (board[from] !== player) {
                continue;
            }
            const steps: number[][] = [
                [r - 1, c],
                [r + 1, c],
                [r, c - 1],
                [r, c + 1],
            ];
            for (const [nr, nc] of steps) {
                if (nr === undefined || nc === undefined || nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                    continue;
                }
                const to = nr * cols + nc;
                if (board[to] === foe) {
                    out.push([from, to]);
                }
            }
        }
    }
    return out;
}

function applyMove(board: number[], from: number, to: number, player: number): number[] {
    const next = [...board];
    next[from] = EMPTY;
    next[to] = player;
    return next;
}

function key(board: number[], player: number): string {
    return `${player}:${board.join("")}`;
}

function solveWithMemo(
    board: number[],
    player: number,
    rows: number,
    cols: number,
    memo: Map<string, boolean>,
): boolean {
    const k = key(board, player);
    const cached = memo.get(k);
    if (cached !== undefined) {
        return cached;
    }
    let winning = false;
    for (const [from, to] of legalMoves(board, rows, cols, player)) {
        if (from === undefined || to === undefined) {
            continue;
        }
        const next = applyMove(board, from, to, player);
        if (!solveWithMemo(next, player === BLACK ? WHITE : BLACK, rows, cols, memo)) {
            winning = true;
            break;
        }
    }
    memo.set(k, winning);
    return winning;
}

function cells(board: number[], rows: number, cols: number, from: number, to: number): VisualEntity[] {
    return board.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: value === BLACK ? "B" : value === WHITE ? "W" : "",
        value,
        state: (index === to ? "active" : index === from ? "comparing" : value === EMPTY ? "idle" : "visited") as VisualEntity["state"],
        x: index % cols,
        y: Math.floor(index / cols),
        width: 0,
        height: 0,
        metadata: { row: Math.floor(index / cols), col: index % cols, occupant: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ClobberInput | null) ?? {};
    const rows = Math.max(1, Math.min(3, typeof task.rows === "number" ? task.rows : 2));
    const cols = Math.max(1, Math.min(3, typeof task.cols === "number" ? task.cols : 3));
    const cellCount = rows * cols;
    let board = parseBoard(task.board ?? "BWBWBW", cellCount);

    const memo = new Map<string, boolean>();
    const blackWins = solveWithMemo(board, BLACK, rows, cols, memo);

    const moves: Array<{ from: number; to: number; player: number }> = [];
    let player = BLACK;
    for (let ply = 0; ply < 40; ply += 1) {
        const options = legalMoves(board, rows, cols, player);
        if (options.length === 0) {
            break;
        }
        let chosen = options[0] ?? [];
        const from = chosen[0];
        const to = chosen[1];
        for (const option of options) {
            const f = option[0];
            const t = option[1];
            if (f === undefined || t === undefined) {
                continue;
            }
            const next = applyMove(board, f, t, player);
            if (!solveWithMemo(next, player === BLACK ? WHITE : BLACK, rows, cols, memo)) {
                chosen = option;
                break;
            }
        }
        const f = chosen[0];
        const t = chosen[1];
        if (f === undefined || t === undefined) {
            break;
        }
        moves.push({ from: f, to: t, player });
        board = applyMove(board, f, t, player);
        player = player === BLACK ? WHITE : BLACK;
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(parseBoard(task.board ?? "BWBWBW", cellCount), rows, cols, -1, -1),
        edges: [],
        description: `Clobber on a ${rows} by ${cols} board: capture an adjacent opponent stone by moving onto it; the player with no move loses.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, blackWins, states: memo.size, plies: moves.length },
    };
    step += 1;

    let shown = parseBoard(task.board ?? "BWBWBW", cellCount);
    for (let ply = 0; ply < moves.length; ply += 1) {
        const move = moves[ply];
        if (!move) {
            continue;
        }
        shown = applyMove(shown, move.from, move.to, move.player);
        yield {
            stepNumber: step,
            entities: cells(shown, rows, cols, move.from, move.to),
            edges: [],
            description: `Ply ${ply + 1}: ${move.player === BLACK ? "Black" : "White"} moves from cell ${move.from} onto cell ${move.to}, capturing the stone there.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows, cols, ply: ply + 1, from: move.from, to: move.to, player: move.player },
        };
        step += 1;
    }

    const winner = blackWins ? "Black" : "White";
    yield {
        stepNumber: step,
        entities: cells(shown, rows, cols, -1, -1),
        edges: [],
        description: `Under optimal play ${winner} wins; the memoized search classified ${memo.size} board states.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows, cols, winner: blackWins ? 1 : 2, states: memo.size, plies: moves.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Each move trades one of your stones for one of your opponent's stones and leaves an empty square behind, so the board slowly empties. A player is lost when none of their stones touches an enemy stone. The solver looks ahead from every reachable position, marking it winning if there is a capture that hands the opponent a losing position.",
        invariants: [
            "A legal move always captures exactly one orthogonally adjacent opponent stone.",
            "Each capture reduces the total number of stones on the board by one.",
            "A position is winning precisely when some move leaves the opponent in a losing position.",
        ],
        correctness:
            "The recursion follows the normal-play definition directly. A player with no legal capture loses, so the empty-move case returns false. Otherwise the position is winning if and only if at least one successor is losing for the opponent. Because every move removes a stone, the game strictly decreases a well-founded measure, so induction on remaining stones proves each memoized value correct, and the extracted variation always follows a move to a losing successor for the opponent.",
        complexityRationale:
            "Each (board, player) state has at most cells times four candidate captures, and memoization evaluates each state once, giving O(states * cells * 4) time and O(states) space. With a nine-cell cap the reachable state space is small enough for exhaustive solving.",
        uses: [
            "Teaching memoized minimax and normal-play game classification",
            "A compact benchmark for game-tree search and transposition tables",
            "Studying partizan games in combinatorial game theory",
        ],
        references: [
            "Berlekamp, Conway and Guy, Winning Ways for Your Mathematical Plays (1982)",
            "Wikipedia, Clobber (game)",
        ],
        workedExample:
            "On a single row BWB, Black may capture the white stone from either end, leaving WB or BW, and White then has no adjacent black stone to capture. Black wins immediately after one capture, so the initial position is winning for Black.",
    },
    id: "clobber",
    name: "Clobber Solver",
    category: "game",
    complexity: { time: "O(states * cells * 4)", space: "O(states)" },
    defaultInput: { rows: 2, cols: 3, board: "BWBWBW" },
    visualType: "grid",
    run,
    pseudocode: [
        "parse the board into black, white, and empty cells",
        "list all captures where a stone meets an adjacent opponent stone",
        "apply a capture by emptying the origin and recoloring the target",
        "mark a position losing when the player to move has no capture",
        "mark it winning when some capture leaves the opponent losing",
        "memoize each board and player pair",
        "extract one optimal line of captures",
        "report which player wins under optimal play",
    ],
};

export default module;
