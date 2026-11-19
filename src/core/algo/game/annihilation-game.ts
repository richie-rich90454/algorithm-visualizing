/**
 * annihilation-game.ts - Annihilation Game (Adjacent Pair Removal)
 *
 * Tokens of two colors sit in a row. A move removes two adjacent tokens of the
 * same color; they annihilate each other and the gap splits the row into two
 * independent subgames. This is an impartial normal-play game, so the Sprague
 * Grundy number of a row is the minimum excluded value of the xor of the
 * Grundy numbers of the two pieces left after each possible removal. A position
 * is winning for the player to move exactly when its Grundy number is nonzero.
 *
 * Time O(m^2) over all substrings of a row of length m; space O(m).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MoveInfo {
    index: number;
    leftSG: number;
    rightSG: number;
    xor: number;
}

function mex(values: number[]): number {
    let g = 0;
    while (values.includes(g)) g += 1;
    return g;
}

function analyze(tokens: string[]): { sg: Map<string, number>; rootSG: number; moves: MoveInfo[] } {
    const sg = new Map<string, number>();
    const grundy = (s: string): number => {
        const cached = sg.get(s);
        if (cached !== undefined) return cached;
        const options: number[] = [];
        for (let i = 0; i + 1 < s.length; i += 1) {
            if (s[i] === s[i + 1]) {
                const x = grundy(s.slice(0, i)) ^ grundy(s.slice(i + 2));
                options.push(x);
            }
        }
        const value = mex(options);
        sg.set(s, value);
        return value;
    };

    const key = tokens.join("");
    const moves: MoveInfo[] = [];
    for (let i = 0; i + 1 < tokens.length; i += 1) {
        if (tokens[i] !== tokens[i + 1]) continue;
        const leftSG = grundy(key.slice(0, i));
        const rightSG = grundy(key.slice(i + 2));
        moves.push({ index: i, leftSG, rightSG, xor: leftSG ^ rightSG });
    }
    return { sg, rootSG: grundy(key), moves };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { tokens?: string[] } | null) ?? {};
    const supplied = Array.isArray(task.tokens) && task.tokens.length >= 2 && task.tokens.length <= 12
        ? task.tokens.map((t) => String(t))
        : ["R", "R", "B", "B", "R", "B"];
    const key = supplied.join("");
    const { moves, rootSG } = analyze(supplied);
    const winning = rootSG !== 0;
    const firstWinningMove = moves.find((m) => m.xor === 0) ?? null;

    const chars = (highlight: number): VisualEntity[] =>
        supplied.map((t, i) => ({
            id: `char-${i}`,
            type: "character" as const,
            label: t,
            value: t,
            state: (i === highlight || i === highlight + 1 ? "comparing" : "idle") as EntityState,
            x: 0, y: 0, width: 0, height: 0,
            metadata: { index: i, color: t },
        }));

    let step = 0;
    yield {
        stepNumber: step,
        entities: chars(-1),
        edges: [],
        description: `Annihilation game on the row ${key}; a move removes two adjacent matching tokens.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { tokens: [...supplied], length: supplied.length, rootSG, winning, moves: moves.length },
    };
    step += 1;

    for (const m of moves) {
        yield {
            stepNumber: step,
            entities: chars(m.index),
            edges: [],
            description: `Removing tokens ${m.index} and ${m.index + 1} leaves Grundy numbers ${m.leftSG} and ${m.rightSG}, whose xor is ${m.xor}.`,
            codeLineNumber: 3,
            layout: "text",
            meta: { index: m.index, leftSG: m.leftSG, rightSG: m.rightSG, xor: m.xor, rootSG, winning },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: chars(-1),
        edges: [],
        description: `Grundy number ${rootSG} makes this position ${winning ? "winning for the first player" : "losing for the first player"}.`,
        codeLineNumber: 6,
        layout: "text",
        meta: {
            tokens: [...supplied], rootSG, winning,
            firstWinningMove: firstWinningMove ? firstWinningMove.index : -1,
            moveIndices: moves.map((m) => m.index),
            moveXors: moves.map((m) => m.xor),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When two identical tokens stand side by side, a player may annihilate them, which cuts the row into two smaller independent rows. Because the two pieces no longer interact, their values combine with exclusive or, and the value of a row is the smallest Grundy number not produced by any available annihilation. A nonzero value means the first player can force a win.",
        invariants: [
            "Only adjacent tokens of the same color may be removed.",
            "Removing a pair splits the row into two disjoint subgames whose Grundy values combine by xor.",
            "A position is losing exactly when its Grundy number is zero.",
        ],
        correctness:
            "The game is impartial and normal play, so the Sprague Grundy theorem applies. Every move leaves the disjoint union of a left and a right row, whose Grundy number is the xor of the parts by the disjoint-sum rule. Taking the minimum excluded value of all option values assigns the correct Grundy number by induction on row length, and a position is a previous-player win exactly when that number is zero.",
        complexityRationale:
            "A row of length m has at most m-1 moves, and the recursion only visits substrings, of which there are O(m^2); computing each mex scans at most m options, so the direct implementation is O(m^3) in the worst case with O(m^2) cached substrings, though typical rows are tiny.",
        uses: [
            "Analyzing impartial token-removal puzzles",
            "Teaching Sprague Grundy theory and the xor disjoint-sum rule",
            "Modeling cancellation of adjacent matching symbols in rewrite systems",
        ],
        references: [
            "Berlekamp, Conway, and Guy, Winning Ways for Your Mathematical Plays (1982)",
            "Conway, On Numbers and Games (1976)",
        ],
        workedExample:
            "The row RRBB has the removal at positions zero and one leaving the row BB with Grundy value one, so that option has value one. The removal at positions two and three leaves RR with the same value. The smallest excluded value is zero, so RRBB is a losing position for the player to move.",
    },
    id: "annihilation-game",
    name: "Annihilation Game",
    category: "game",
    complexity: { time: "O(m^3)", space: "O(m^2)" },
    defaultInput: { tokens: ["R", "R", "B", "B", "R", "B"] },
    visualType: "text",
    run,
    pseudocode: [
        "read the row of colored tokens",
        "for every adjacent matching pair record the removal",
        "compute the Grundy number of the left remainder",
        "compute the Grundy number of the right remainder",
        "combine the two numbers with exclusive or",
        "take the minimum excluded value over all moves",
        "report the Grundy number and the winning verdict",
    ],
};

export default module;
