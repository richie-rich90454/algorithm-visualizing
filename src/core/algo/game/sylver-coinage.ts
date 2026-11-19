/**
 * sylver-coinage.ts - Sylver Coinage Winning Openings
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In Sylver coinage two players alternately name positive integers that are
 * not expressible as a nonnegative combination of the numbers already named.
 * Once a number is named it can never be named again, and a player who has no
 * legal number loses. This module solves the game by retrograde reasoning: a
 * position is winning exactly when some legal move leaves the opponent in a
 * losing position. It reports the winning and losing opening moves.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * Legal moves are limited to the range 2 through a configurable maximum.
 * Naming one is a traditional instant win, so it is banned by default to make
 * the opening interesting; set allowOne to true to include it. Representability
 * and the search are exact within the range, with memoization by the sorted set
 * of named numbers. Positions are finite because each move adds a new number.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(S * B * max) where S is the number of reachable positions and B
 *          the branching factor; Space: O(S * max) for the memo table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars represent the candidate opening moves within the range.
 *   - A winning move is green, a losing move red, the examined one yellow.
 *   - The final frame marks the smallest winning opening as the recommendation.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CoinageResult {
    moves: number[];
    winning: Set<number>;
    losing: Set<number>;
    best: number;
}

/** Numbers up to max that a nonnegative combination of coins can form. */
function representable(coins: number[], max: number): boolean[] {
    const reachable = new Array<boolean>(max + 1).fill(false);
    reachable[0] = true;
    for (const coin of coins) {
        for (let value = coin; value <= max; value += 1) {
            if (reachable[value - coin]) {
                reachable[value] = true;
            }
        }
    }
    return reachable;
}

function legalMoves(coins: number[], max: number, allowOne: boolean): number[] {
    const reachable = representable(coins, max);
    const start = allowOne ? 1 : 2;
    const moves: number[] = [];
    for (let value = start; value <= max; value += 1) {
        if (!reachable[value]) {
            moves.push(value);
        }
    }
    return moves;
}

function solve(max: number, allowOne: boolean): CoinageResult {
    const memo = new Map<string, boolean>();
    const winning = (coins: number[]): boolean => {
        const key = [...coins].sort((a, b) => a - b).join(",");
        const cached = memo.get(key);
        if (cached !== undefined) {
            return cached;
        }
        let result = false;
        for (const move of legalMoves(coins, max, allowOne)) {
            if (!winning([...coins, move])) {
                result = true;
                break;
            }
        }
        memo.set(key, result);
        return result;
    };

    const moves = legalMoves([], max, allowOne);
    const winningSet = new Set<number>();
    const losingSet = new Set<number>();
    for (const move of moves) {
        if (winning([move])) {
            losingSet.add(move);
        } else {
            winningSet.add(move);
        }
    }
    const best = moves.find((move) => winningSet.has(move)) ?? -1;
    return { moves, winning: winningSet, losing: losingSet, best };
}

function bars(
    result: CoinageResult,
    examined: number,
    final: boolean,
): VisualEntity[] {
    return result.moves.map((move, index) => {
        let state: EntityState = "idle";
        if (final) {
            state = move === result.best ? "sorted" : result.winning.has(move) ? "visited" : "error";
        } else if (index === examined) {
            state = "comparing";
        } else if (index < examined) {
            state = result.winning.has(move) ? "visited" : "error";
        }
        return {
            id: `bar-${move}`,
            type: "bar" as const,
            label: String(move),
            value: move,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { move, winning: result.winning.has(move), index },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { max?: number; allowOne?: boolean } | null) ?? {};
    const max = Math.max(4, Math.min(18, typeof task.max === "number" ? Math.floor(task.max) : 14));
    const allowOne = task.allowOne === true;
    const result = solve(max, allowOne);
    const winning = [...result.winning];
    const losing = [...result.losing];

    let step = 0;
    yield {
        stepNumber: step++,
        entities: bars(result, -1, false),
        edges: [],
        description: `Solving Sylver coinage for opening moves from ${allowOne ? 1 : 2} to ${max}; a winning move leaves the opponent with no winning reply.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { max, allowOne, moves: [...result.moves], winning, losing, best: result.best },
    };

    for (let index = 0; index < result.moves.length; index += 1) {
        const move = result.moves[index] ?? 0;
        yield {
            stepNumber: step++,
            entities: bars(result, index, false),
            edges: [],
            description: `Opening ${move}: after naming it the opponent is in a ${result.winning.has(move) ? "winning" : "losing"} position, so the move is ${result.winning.has(move) ? "bad" : "good"}.`,
            codeLineNumber: result.winning.has(move) ? 5 : 6,
            layout: "array",
            meta: { max, allowOne, examined: move, winning, losing, best: result.best },
        };
    }

    yield {
        stepNumber: step,
        entities: bars(result, -1, true),
        edges: [],
        description: result.best < 0
            ? "No winning opening exists in this range; every legal name lets the opponent win."
            : `Smallest winning opening is ${result.best}; there are ${winning.length} winning and ${losing.length} losing openings.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { max, allowOne, winning, losing, best: result.best, count: result.moves.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Each number named in Sylver coinage permanently closes every number that can be built from the named ones. Think of a position as the set of numbers still sayable. A position is good for the player to move if there is some name that leaves the opponent a position with no good reply. Working backward from positions with no legal names gives the verdict of every opening.",
        invariants: [
            "A named number can never be named again because it is representable by itself.",
            "Adding a number only shrinks the set of future legal names.",
            "A position with no legal name is losing for the player to move.",
        ],
        correctness:
            "The representability sieve marks exactly the numbers expressible as nonnegative combinations of the named coins, so legalMoves returns precisely the playable names within the range. A terminal position has an empty move set and is losing by normal-play convention. The recurrence declares a position winning if and only if at least one move reaches a losing position, which is the definition of a win in a finite impartial game; memoization only caches these exact verdicts. Therefore an opening is winning for the first player exactly when the position after naming it is losing for the opponent.",
        complexityRationale:
            "The solver visits each reachable named set once. For each it runs a sieve over at most max numbers for the current coins, costing O(max * coins), and tries each legal move, so total time is O(S * B * max) for S states and branching factor B. The memo table stores one bit per state plus the coin sets, giving O(S * max) space; the small default range keeps S modest.",
        uses: [
            "A teaching example of retrograde analysis in impartial games",
            "Studying how closing numbers changes the outcome of a combinatorial game",
            "Demonstrating memoized game-tree search on a finite state space",
        ],
        references: [
            "Conway, On Numbers and Games (1976)",
            "Guy, Unsolved Problems in Number Theory, Problem C6 (2004)",
        ],
        workedExample:
            "With the range limited to small numbers and the opening one banned, the sieve says that after naming two the still sayable numbers are the odd numbers and a few others. Testing each such reply recursively determines whether the second player can force a win, and the smallest reply that leaves the second player losing is reported as the recommended opening.",
    },
    id: "sylver-coinage",
    name: "Sylver Coinage",
    category: "game",
    complexity: { time: "O(S * B * max)", space: "O(S * max)" },
    defaultInput: { max: 14, allowOne: false },
    visualType: "array",
    run,
    pseudocode: [
        "limit legal names to the range two through max",
        "sieve the numbers representable by the named coins",
        "collect the legal names absent from that sieve",
        "a position with no legal name is losing for the player to move",
        "name each legal move and solve the resulting position",
        "an opening wins if its resulting position is losing",
        "report every winning opening and the smallest one",
    ],
};

export default module;
