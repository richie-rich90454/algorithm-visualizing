/**
 * notakto.ts - Notakto (single-board misere tic-tac-toe solver)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Notakto is misere tic-tac-toe: both players place the same mark, and the
 * player who completes a three-in-a-row loses immediately. There are no X and
 * O roles, so the strategy is purely about forcing the opponent to close a
 * line. A memoized minimax search over bitmask board states decides whether the
 * player to move can force a win and extracts one line of optimal play.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is the classic single-board game on a 3 by 3 grid. Multiple boards,
 * where a completed board is removed and play continues, are not modeled. The
 * search is exact and exhaustive for the 512 reachable board masks.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(2^9 * 9) with memoization over board masks
 *   Space: O(2^9) for the memo table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nine grid cells show the board along one optimal line of play.
 *   - The cell just placed is highlighted in each frame.
 *   - The final frame marks the winner and whether the last move closed a line.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const LINES: number[][] = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];

function hasLine(mask: number): boolean {
    return LINES.some((line) => line.every((bit) => (mask & (1 << bit)) !== 0));
}

function emptyCells(mask: number): number[] {
    const out: number[] = [];
    for (let bit = 0; bit < 9; bit += 1) {
        if ((mask & (1 << bit)) === 0) {
            out.push(bit);
        }
    }
    return out;
}

/** memo[mask] = true when the player to move can force a win. */
function buildMemo(): Map<number, boolean> {
    const memo = new Map<number, boolean>();
    const solve = (mask: number): boolean => {
        const cached = memo.get(mask);
        if (cached !== undefined) {
            return cached;
        }
        const empties = emptyCells(mask);
        let winning = false;
        for (const bit of empties) {
            const next = mask | (1 << bit);
            if (hasLine(next)) {
                continue; // Closing a line loses immediately for the mover.
            }
            if (!solve(next)) {
                winning = true;
                break;
            }
        }
        memo.set(mask, winning);
        return winning;
    };
    solve(0);
    return memo;
}

/** Extract one line of play, preferring moves that hand a loss to the opponent. */
function principalVariation(start: number, memo: Map<number, boolean>): number[] {
    const moves: number[] = [];
    let mask = start;
    for (let ply = 0; ply < 9; ply += 1) {
        const empties = emptyCells(mask);
        if (empties.length === 0) {
            break;
        }
        let chosen = -1;
        for (const bit of empties) {
            const next = mask | (1 << bit);
            if (!hasLine(next) && memo.get(next) === false) {
                chosen = bit;
                break;
            }
        }
        if (chosen === -1) {
            chosen = empties.find((bit) => !hasLine(mask | (1 << bit))) ?? -1;
        }
        if (chosen === -1) {
            // Every remaining cell closes a line; show the forced losing move.
            chosen = empties[0] ?? -1;
        }
        if (chosen === -1) {
            break;
        }
        moves.push(chosen);
        mask |= 1 << chosen;
        if (hasLine(mask)) {
            break;
        }
    }
    return moves;
}

function boardCells(mask: number, highlight: number): VisualEntity[] {
    return Array.from({ length: 9 }, (_, bit) => ({
        id: `cell-${bit}`,
        type: "cell" as const,
        label: (mask & (1 << bit)) !== 0 ? "X" : "",
        value: (mask & (1 << bit)) !== 0 ? 1 : 0,
        state: (bit === highlight ? "active" : (mask & (1 << bit)) !== 0 ? "visited" : "idle") as VisualEntity["state"],
        x: bit % 3,
        y: Math.floor(bit / 3),
        width: 0,
        height: 0,
        metadata: { row: Math.floor(bit / 3), col: bit % 3, filled: (mask & (1 << bit)) !== 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { board?: string } | null) ?? {};
    const description = task.board ?? ".........";
    let mask = 0;
    for (let bit = 0; bit < 9 && bit < description.length; bit += 1) {
        if (description[bit] === "X" || description[bit] === "x") {
            mask |= 1 << bit;
        }
    }
    if (hasLine(mask)) {
        mask = 0; // Restart from a clean board if the supplied board is terminal.
    }

    const memo = buildMemo();
    const moves = principalVariation(mask, memo);
    const firstWins = memo.get(mask) ?? false;

    let step = 0;
    yield {
        stepNumber: step,
        entities: boardCells(mask, -1),
        edges: [],
        description: `Notakto: both players place X and the player who completes a line loses. Player to move ${firstWins ? "can force a win" : "is in a losing position"}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3, cols: 3, playerToMoveWins: firstWins, plies: moves.length },
    };
    step += 1;

    let current = mask;
    for (let ply = 0; ply < moves.length; ply += 1) {
        const bit = moves[ply] ?? 0;
        current |= 1 << bit;
        const closed = hasLine(current);
        yield {
            stepNumber: step,
            entities: boardCells(current, bit),
            edges: [],
            description: `Ply ${ply + 1}: place X at cell ${bit}${closed ? ", completing a line and losing" : ", leaving no line"}.`,
            codeLineNumber: closed ? 4 : 2,
            layout: "grid",
            meta: { rows: 3, cols: 3, ply: ply + 1, cell: bit, closedLine: closed },
        };
        step += 1;
        if (closed) {
            break;
        }
    }

    const winner = firstWins ? "first player" : "second player";
    yield {
        stepNumber: step,
        entities: boardCells(current, -1),
        edges: [],
        description: `Under optimal play the ${winner} wins; the search covered ${memo.size} distinct board states.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 3, cols: 3, winner: firstWins ? 1 : 2, states: memo.size, plies: moves.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Both players write the same mark, so there is no defense by blocking an opponent's symbol. The only weapon is the threat: a cell that would complete a line is poison, and each move tries to leave the opponent with nothing but poisoned cells. Solving the game means looking ahead until every possible reply has been classified as winning or losing.",
        invariants: [
            "A move that completes any of the eight lines loses immediately for the player who made it.",
            "A position is winning exactly when some safe move leaves the opponent a losing position.",
            "Memoization assigns each board mask one fixed win or loss value, so revisiting a position is free.",
        ],
        correctness:
            "The minimax recursion follows the definition of a winning position. A move that closes a line is discarded because it loses at once. Among safe moves, the player to move wins if and only if at least one successor is losing for the opponent; if no safe move exists or every successor is winning for the opponent, the position is losing. Induction on the number of empty cells proves the memoized values correct, and the principal variation follows a successor labeled losing for the opponent whenever one exists.",
        complexityRationale:
            "There are two to the ninth power board masks, each with at most nine outgoing moves and a constant eight-line check, so the memoized search takes O(2^9 * 9) time and O(2^9) space for the memo table.",
        uses: [
            "Teaching misere play and the Sprague-Grundy style outcome recursion",
            "A compact example of memoized minimax on a tiny game tree",
            "A test case for game-solving and position-classification code",
        ],
        references: [
            "Berlekamp, Conway and Guy, Winning Ways for Your Mathematical Plays (1982)",
            "Wikipedia, Notakto and Misere Tic-Tac-Toe",
        ],
        workedExample:
            "On an empty board the first player has a winning strategy. Opening at a corner, the first player can answer each reply by leaving the second player only cells that would close a line, so the second player is eventually forced to complete a row, column, or diagonal and lose.",
    },
    id: "notakto",
    name: "Notakto Solver",
    category: "game",
    complexity: { time: "O(2^9 * 9)", space: "O(2^9)" },
    defaultInput: { board: "........." },
    visualType: "grid",
    run,
    pseudocode: [
        "represent the board as a nine-bit mask",
        "define a predicate for whether a mask contains any winning line",
        "for each empty cell try placing a mark and check for a line",
        "discard moves that complete a line because they lose at once",
        "mark a position winning if some safe move leaves the opponent losing",
        "memoize the result for each board mask",
        "follow a losing successor to extract one line of play",
        "report which player wins under optimal play",
    ],
};

export default module;
