/**
 * toads-and-frogs.ts - Toads and Frogs
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Toads and Frogs is a partizan combinatorial game on a one-dimensional strip.
 * Left owns toads that step or jump to the right, and Right owns frogs that
 * step or jump to the left. A jump passes over a single opposing piece into an
 * empty square. Solving the game classifies a position into one of four
 * outcomes: Left wins, Right wins, next player wins, or previous player wins.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * Positions are finite strings over T, F, and dot. Both players always have
 * the same board, only different legal directions. This is the normal-play,
 * partizan analysis of the strip game; no scoring variant or infinite board is
 * modeled.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(number of reachable positions); Space: O(number of positions)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Characters on a strip show toads, frogs, and empty squares.
 *   - The pieces moved in the latest turn are highlighted.
 *   - The last frame reports the outcome class of the start position.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Outcome = "L" | "R" | "N" | "P";

function leftMoves(board: string): string[] {
    const out: string[] = [];
    for (let i = 0; i < board.length - 1; i += 1) {
        if (board[i] === "T" && board[i + 1] === ".") {
            out.push(board.slice(0, i) + ".T" + board.slice(i + 2));
        }
    }
    for (let i = 0; i < board.length - 2; i += 1) {
        if (board[i] === "T" && board[i + 1] === "F" && board[i + 2] === ".") {
            out.push(board.slice(0, i) + ".FT" + board.slice(i + 3));
        }
    }
    return out;
}

function rightMoves(board: string): string[] {
    const out: string[] = [];
    for (let i = 0; i < board.length - 1; i += 1) {
        if (board[i] === "." && board[i + 1] === "F") {
            out.push(board.slice(0, i) + "F." + board.slice(i + 2));
        }
    }
    for (let i = 0; i < board.length - 2; i += 1) {
        if (board[i] === "." && board[i + 1] === "F" && board[i + 2] === "T") {
            out.push(board.slice(0, i) + "TF." + board.slice(i + 3));
        }
    }
    return out;
}

interface Solver {
    leftWinStart: (board: string) => boolean;
    leftWinReply: (board: string) => boolean;
    outcome: (board: string) => Outcome;
}

function makeSolver(): Solver {
    const memoStart = new Map<string, boolean>();
    const memoReply = new Map<string, boolean>();

    const leftWinStart = (board: string): boolean => {
        const cached = memoStart.get(board);
        if (cached !== undefined) {
            return cached;
        }
        memoStart.set(board, false);
        let value = false;
        for (const next of leftMoves(board)) {
            if (leftWinReply(next)) {
                value = true;
                break;
            }
        }
        memoStart.set(board, value);
        return value;
    };

    const leftWinReply = (board: string): boolean => {
        const cached = memoReply.get(board);
        if (cached !== undefined) {
            return cached;
        }
        memoReply.set(board, true);
        const moves = rightMoves(board);
        if (moves.length === 0) {
            memoReply.set(board, true);
            return true;
        }
        let value = true;
        for (const next of moves) {
            if (!leftWinStart(next)) {
                value = false;
                break;
            }
        }
        memoReply.set(board, value);
        return value;
    };

    const outcome = (board: string): Outcome => {
        const startWin = leftWinStart(board);
        const replyWin = leftWinReply(board);
        if (startWin && replyWin) {
            return "L";
        }
        if (!startWin && !replyWin) {
            return "R";
        }
        if (startWin) {
            return "N";
        }
        return "P";
    };

    return { leftWinStart, leftWinReply, outcome };
}

function principalVariation(start: string, solver: Solver): Array<{ board: string; side: "L" | "R" }> {
    const line: Array<{ board: string; side: "L" | "R" }> = [{ board: start, side: "L" }];
    let board = start;
    let side: "L" | "R" = "L";
    for (let turn = 0; turn < 24; turn += 1) {
        const moves = side === "L" ? leftMoves(board) : rightMoves(board);
        if (moves.length === 0) {
            break;
        }
        let chosen = moves[0] ?? board;
        for (const next of moves) {
            const prefers = side === "L" ? solver.leftWinReply(next) : !solver.leftWinStart(next);
            if (prefers) {
                chosen = next;
                break;
            }
        }
        board = chosen;
        side = side === "L" ? "R" : "L";
        line.push({ board, side });
    }
    return line;
}

function chars(board: string, changed: number[]): VisualEntity[] {
    return board.split("").map((char, index) => ({
        id: `cell-${index}`,
        type: "character" as const,
        label: char === "." ? "_" : char,
        value: char,
        state: (changed.includes(index) ? "active" : char === "T" ? "path" : char === "F" ? "visited" : "idle") as VisualEntity["state"],
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, char },
    }));
}

function changedIndices(before: string, after: string): number[] {
    const out: number[] = [];
    for (let i = 0; i < Math.min(before.length, after.length); i += 1) {
        if (before[i] !== after[i]) {
            out.push(i);
        }
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { board?: string } | null) ?? {};
    const raw = typeof task.board === "string" ? task.board.replace(/[^TF.]/g, "") : "";
    const board = raw.length >= 3 ? raw.slice(0, 12) : "T..F";
    const solver = makeSolver();
    const outcomeValue = solver.outcome(board);
    const line = principalVariation(board, solver);

    let step = 0;
    yield {
        stepNumber: step,
        entities: chars(board, []),
        edges: [],
        description: `Start from ${board}; toads move right, frogs move left, and a move may jump over one opponent.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { board, outcome: outcomeValue, turns: 0 },
    };
    step += 1;

    for (let i = 1; i < line.length; i += 1) {
        const state = line[i];
        const previous = line[i - 1];
        if (!state || !previous) {
            continue;
        }
        const side = i % 2 === 1 ? "Left" : "Right";
        yield {
            stepNumber: step,
            entities: chars(state.board, changedIndices(previous.board, state.board)),
            edges: [],
            description: `${side} moves to ${state.board} by stepping or jumping a piece into an empty square.`,
            codeLineNumber: 2,
            layout: "text",
            meta: { board: state.board, outcome: outcomeValue, turns: i, side: state.side },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: chars(line[line.length - 1]?.board ?? board, []),
        edges: [],
        description: `Outcome ${outcomeValue}: ${outcomeValue === "L" ? "Left wins whoever starts" : outcomeValue === "R" ? "Right wins whoever starts" : outcomeValue === "N" ? "the next player wins" : "the previous player wins"}.`,
        codeLineNumber: 5,
        layout: "text",
        meta: {
            board: line[line.length - 1]?.board ?? board,
            outcome: outcomeValue,
            turns: line.length - 1,
            start: board,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Toads can only advance rightward and frogs only leftward, so a position eventually freezes. To solve it, ask two questions: can Left force a win when she moves first, and can Left force a win when Right moves first? Combining the answers yields one of four outcomes. A jump over a single opponent is often the move that turns a losing shape into a winning one.",
        invariants: [
            "Left moves only toads to the right and Right moves only frogs to the left.",
            "Every move brings at least one piece closer to the far end, so play terminates.",
            "Left wins a position with Right to move only if Left wins every position Right could choose.",
        ],
        correctness:
            "Let LW-start mean Left wins moving first and LW-reply mean Left wins when Right moves first. A position satisfies LW-start exactly when some left move reaches a position with LW-reply true. It satisfies LW-reply exactly when every right move reaches a position with LW-start true, and a position with no right move gives Right no legal play so LW-reply is true. Because every move reduces the total remaining travel, the recursion is well founded. The four combinations of the two booleans match the standard outcome classes L, R, N, and P.",
        complexityRationale:
            "The solver visits each reachable board string once in each of the two recursion modes, giving time proportional to the number of reachable positions and the same order of memoized space. Each position has at most a few legal moves.",
        uses: [
            "Teaching partizan game outcome classification",
            "Demonstrating the four combinatorial game outcomes",
            "Testing game-tree solvers on a small finite state space",
        ],
        references: [
            "Conway, On Numbers and Games (1976)",
            "Berlekamp, Conway and Guy, Winning Ways for Your Mathematical Plays (1982)",
        ],
        workedExample:
            "From the strip T..F, Left can move the toad one square right to .T.F, after which Right's frog cannot move left because the square immediately left is empty only after further play. Working through the recursion shows the next player has a winning strategy, so the outcome is N.",
    },
    id: "toads-and-frogs",
    name: "Toads and Frogs",
    category: "game",
    complexity: { time: "O(reachable positions)", space: "O(reachable positions)" },
    defaultInput: { board: "T..F" },
    visualType: "text",
    run,
    pseudocode: [
        "read the starting strip of toads, frogs, and empty squares",
        "define left moves as toad steps or jumps to the right",
        "define right moves as frog steps or jumps to the left",
        "compute Left wins when Left starts by trying each left move",
        "compute Left wins when Right starts by checking every right move",
        "combine the two booleans into an outcome class",
        "play a principal variation and report the outcome",
    ],
};

export default module;
