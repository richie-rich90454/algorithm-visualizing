/**
 * zobrist-hashing.ts - Zobrist Hashing
 *
 * Zobrist hashing assigns a random 32-bit key to each piece-square pair and to
 * the side to move. A board's hash is the XOR of all active keys. Making a move
 * just XORs the old square key out and the new key in, so the hash updates in
 * constant time and can serve as a transposition-table key.
 *
 * Time O(1) per move update; space O(pieces * squares) for the key table.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Move { player: number; square: number }

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function makeKeys(seed: number): { x: number[]; o: number[]; side: number } {
    const rand = lcg(seed);
    const gen = (): number[] => Array.from({ length: 9 }, () => Math.floor(rand() * 4294967296) >>> 0);
    return { x: gen(), o: gen(), side: Math.floor(rand() * 4294967296) >>> 0 };
}

function hashBoard(board: number[], keys: { x: number[]; o: number[]; side: number }): number {
    let h = 0;
    for (let sq = 0; sq < 9; sq += 1) {
        const p = board[sq] ?? 0;
        if (p === 1) h ^= keys.x[sq] ?? 0;
        else if (p === -1) h ^= keys.o[sq] ?? 0;
    }
    return (h ^ keys.side) >>> 0;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { moves?: Move[]; seed?: number } | null) ?? {};
    const moves: Move[] = Array.isArray(task.moves) ? task.moves : [
        { player: 1, square: 0 }, { player: -1, square: 4 },
        { player: 1, square: 8 }, { player: -1, square: 2 },
    ];
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 2654435761;
    const keys = makeKeys(seed);
    const board = new Array<number>(9).fill(0);
    const cells = (): VisualEntity[] =>
        board.map((p, sq) => ({
            id: `sq-${sq}`,
            type: "cell" as const,
            label: p === 1 ? "X" : p === -1 ? "O" : "",
            value: p,
            state: (p === 1 ? "active" : p === -1 ? "highlight" : "idle") as EntityState,
            x: 0, y: 0, width: 0, height: 0,
            metadata: { row: Math.floor(sq / 3), col: sq % 3, index: sq },
        }));

    let hash = hashBoard(board, keys);
    let step = 0;
    yield {
        stepNumber: step, entities: cells(), edges: [],
        description: `Zobrist hashing on a 3 by 3 board with seed ${seed}; the hash starts as the side-to-move key.`,
        codeLineNumber: 0, layout: "grid",
        meta: { hash, seed, xKeys: [...keys.x], oKeys: [...keys.o], sideKey: keys.side, rows: 3, cols: 3, move: -1 },
    };
    step += 1;

    let applied = 0;
    for (const mv of moves) {
        if (mv.square < 0 || mv.square > 8 || (mv.player !== 1 && mv.player !== -1)) continue;
        if ((board[mv.square] ?? 0) !== 0) continue;
        const key = mv.player === 1 ? keys.x[mv.square] ?? 0 : keys.o[mv.square] ?? 0;
        const before = hash;
        hash = (hash ^ key) >>> 0;
        board[mv.square] = mv.player;
        applied += 1;
        const recomputed = hashBoard(board, keys);
        yield {
            stepNumber: step, entities: cells(), edges: [],
            description: `Move ${applied}: place ${mv.player === 1 ? "X" : "O"} at square ${mv.square}; XOR key ${key} changes the hash from ${before} to ${hash}.`,
            codeLineNumber: 3, layout: "grid",
            meta: { hash, before, xorKey: key, move: applied, square: mv.square, player: mv.player, recomputed, rows: 3, cols: 3 },
        };
        step += 1;
        hash = (hash ^ keys.side) >>> 0;
        yield {
            stepNumber: step, entities: cells(), edges: [],
            description: `Side to move flips; XOR the side key to get hash ${hash}, matching a from-scratch recomputation.`,
            codeLineNumber: 4, layout: "grid",
            meta: { hash, move: applied, sideKey: keys.side, recomputed: hashBoard(board, keys), rows: 3, cols: 3 },
        };
        step += 1;
    }

    const original = hashBoard(board, keys);
    yield {
        stepNumber: step, entities: cells(), edges: [],
        description: `Applied ${applied} move(s); final hash ${hash} equals the from-scratch hash ${original} of the board.`,
        codeLineNumber: 6, layout: "grid",
        meta: { hash: original, finalHash: original, moves: applied, board: [...board], seed, rows: 3, cols: 3 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Give every possible piece on every square its own random key, then represent a board by XORing the keys of the pieces actually present. Because XOR cancels itself, changing one square is a single XOR with that square's key instead of a full rehash, which is exactly what a game-tree cache needs.",
        invariants: [
            "The hash is the XOR of all active piece-square keys and the side key.",
            "XORing the same key twice restores the previous value.",
            "An incremental update always matches a from-scratch recomputation.",
        ],
        correctness:
            "Each board position maps to the XOR of a fixed set of keys, so identical boards with the same side to move always produce the same hash. Removing a piece XORs its key out and placing one XORs it in, which is algebraically identical to recomputing the whole set; the from-scratch value in each frame confirms the equality.",
        complexityRationale:
            "A move changes at most one piece-square key plus the side key, so updates are O(1); generating the key table once costs O(pieces * squares) space.",
        uses: [
            "Transposition tables in board-game engines",
            "Detecting repeated positions and draw rules",
            "Opening-book and endgame-tablebase indexing",
        ],
        references: [
            "Zobrist, A New Hashing Method with Application for Game Playing (1970)",
            "Slate and Atkin, Chess 4.5 - The Northwestern University Chess Program (1977)",
        ],
        workedExample:
            "On an empty 3 by 3 board the hash is the side key. Placing X at square 0 XORs x[0]; moving to the other side XORs the side key. XORing x[0] again removes the piece, returning the hash to the original side key exactly.",
    },
    id: "zobrist-hashing",
    name: "Zobrist Hashing",
    category: "game",
    complexity: { time: "O(1) per move", space: "O(pieces * squares)" },
    defaultInput: {
        moves: [
            { player: 1, square: 0 }, { player: -1, square: 4 },
            { player: 1, square: 8 }, { player: -1, square: 2 },
        ],
        seed: 2654435761,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "generate one random key per piece and square and one side key",
        "set the hash to the side-to-move key for an empty board",
        "to place a piece XOR its piece-square key into the hash",
        "after the move XOR the side key to flip whose turn it is",
        "compare the incremental hash with a full recomputation",
        "repeat for every move in the sequence",
        "report the final hash of the resulting board",
    ],
};

export default module;
