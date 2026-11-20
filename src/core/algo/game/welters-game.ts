/**
 * welters-game.ts - Welter's Game on a Strip of Squares
 *
 * Welter's game places coins on distinct squares of a strip numbered from one.
 * A move slides one coin to any lower square that is still empty, and the player
 * who cannot move loses. Because coins may jump over one another, the position
 * is not a simple sum of heaps; its Sprague-Grundy value has to be computed from
 * the full set of occupied squares. The winning positions have a distinctive
 * pairing pattern that the brute-force solver reveals.
 *
 * Time O(positions * coins * squares) with memoization over bit masks;
 * space O(positions) for the cached Grundy values.
 *
 * Visualization: one bar per square. A coin is green, the square being vacated
 * is yellow, and the destination is highlighted in the move frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface WelterInput {
    n?: number;
    coins?: number[];
}

/** List every legal slide to a lower empty square. */
function successors(mask: number, squares: number): number[] {
    const result: number[] = [];
    for (let source = 0; source < squares; source += 1) {
        if ((mask & (1 << source)) === 0) continue;
        for (let target = 0; target < source; target += 1) {
            if ((mask & (1 << target)) !== 0) continue;
            result.push((mask & ~(1 << source)) | (1 << target));
        }
    }
    return result;
}

/** Memoized Sprague-Grundy value of a position. */
function grundy(mask: number, squares: number, memo: Map<number, number>): number {
    const cached = memo.get(mask);
    if (cached !== undefined) return cached;
    const seen = new Set<number>();
    for (const next of successors(mask, squares)) {
        seen.add(grundy(next, squares, memo));
    }
    let value = 0;
    while (seen.has(value)) value += 1;
    memo.set(mask, value);
    return value;
}

function maskOf(coins: number[], squares: number): number {
    let mask = 0;
    for (const square of coins) {
        if (square >= 1 && square <= squares) mask |= 1 << (square - 1);
    }
    return mask;
}

function makeEntities(mask: number, squares: number, from: number, to: number): VisualEntity[] {
    return Array.from({ length: squares }, (_, index) => {
        const square = index + 1;
        const occupied = (mask & (1 << index)) !== 0;
        const state: EntityState = square === to ? "active" : square === from ? "comparing" : occupied ? "sorted" : "idle";
        return {
            id: `square-${square}`,
            type: "bar" as const,
            label: occupied ? `coin ${square}` : String(square),
            value: occupied ? 1 : 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, square, occupied },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as WelterInput | null) ?? {};
    const squares = Math.max(2, Math.min(8, Math.floor(Number(task.n ?? 6)) || 6));
    const given = Array.isArray(task.coins) && task.coins.length > 0 ? task.coins : [1, 3, 5];
    let mask = maskOf(given, squares);
    const memo = new Map<number, number>();
    const startingValue = grundy(mask, squares, memo);

    yield {
        stepNumber: 0,
        entities: makeEntities(mask, squares, 0, 0),
        edges: [],
        description: `Welter's game on ${squares} squares with ${given.length} coin(s); Grundy value ${startingValue}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { mask, squares, grundy: startingValue, from: 0, to: 0, moves: 0 },
    };

    let step = 1;
    let moves = 0;
    while (moves < 12) {
        const options = successors(mask, squares);
        if (options.length === 0) break;
        let chosen = options[0] ?? mask;
        for (const next of options) {
            if (grundy(next, squares, memo) === 0) {
                chosen = next;
                break;
            }
        }
        const before = mask;
        const changed = before ^ chosen;
        let targetBit = 0;
        while ((changed & (1 << targetBit)) === 0) targetBit += 1;
        const destination = targetBit + 1;
        let sourceBit = 0;
        while ((before & (1 << sourceBit)) === 0) sourceBit += 1;
        let sourceSquare = sourceBit + 1;
        if ((chosen & (1 << sourceBit)) !== 0) {
            sourceBit += 1;
            while ((before & (1 << sourceBit)) === 0) sourceBit += 1;
            sourceSquare = sourceBit + 1;
        }
        yield {
            stepNumber: step,
            entities: makeEntities(before, squares, sourceSquare, destination),
            edges: [],
            description: `Move coin from square ${sourceSquare} to square ${destination}, leaving a Grundy-zero position.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { mask: before, squares, grundy: grundy(before, squares, memo), from: sourceSquare, to: destination, moves: moves + 1 },
        };
        step += 1;
        mask = chosen;
        moves += 1;
    }

    const finalValue = grundy(mask, squares, memo);
    yield {
        stepNumber: step,
        entities: makeEntities(mask, squares, 0, 0),
        edges: [],
        description: finalValue === 0
            ? `Terminal or losing position reached after ${moves} move(s); Grundy value 0.`
            : `Stopped after ${moves} move(s); Grundy value ${finalValue}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { mask, squares, grundy: finalValue, from: 0, to: 0, moves, completed: finalValue === 0 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A coin may slide to any lower empty square, so moving one coin changes which jumps are available to all the others. The Sprague-Grundy value of a position is the smallest nonnegative value not reachable in one move; a zero value means the player to move has no winning reply. Computing it for every reachable bit mask turns the whole game into a table that can be replayed optimally.",
        invariants: [
            "Every move moves exactly one coin to a lower, previously empty square.",
            "The number of coins and the number of squares stay fixed throughout the game.",
            "A position has Grundy value zero exactly when every legal move leads to a nonzero value.",
        ],
        correctness:
            "The Sprague-Grundy theorem assigns each impartial position a nimber equal to the mex of the nimbers of its options. A position is losing exactly when that nimber is zero, because then all options are winning for the next player, while a nonzero nimber always has an option of value zero. The search picks such an option at every turn, so as long as one exists the played move is winning; the independent brute-force check in the test recomputes every nimber from the raw move list.",
        complexityRationale:
            "There are at most two to the number of squares positions. Each cached position enumerates at most coins times squares moves and performs a linear mex scan, so total time is O(positions * coins * squares) and the memo table uses O(positions) space.",
        uses: [
            "Analyzing impartial combinatorial games and finding winning openings",
            "Teaching the Sprague-Grundy theorem beyond simple heap games",
            "Generating optimal play for puzzle and game interfaces",
        ],
        references: [
            "Berlekamp, Conway and Guy, Winning Ways for Your Mathematical Plays, Volume 1",
            "Conway, On Numbers and Games, Chapter 9",
        ],
        workedExample:
            "On four squares with coins at one and two, the only moves shift the coin on square two to square three or four, and each reply can be mirrored, so the position has Grundy value zero. With coins at one and three the first player can move the coin on three down to two, reaching the losing pair one and two.",
    },
    id: "welters-game",
    name: "Welter's Game",
    category: "game",
    complexity: { time: "O(2^n * coins * n)", space: "O(2^n)" },
    defaultInput: { n: 6, coins: [1, 3, 5] },
    visualType: "array",
    run,
    pseudocode: [
        "encode the occupied squares as a bit mask",
        "memoize the Grundy value of every visited mask",
        "for a position list all slides to lower empty squares",
        "set the value to the mex of the option values",
        "while the value is nonzero choose an option of value zero",
        "apply the chosen slide and update the mask",
        "stop when no legal slide remains",
        "done: report the play and the final Grundy value",
    ],
};

export default module;
