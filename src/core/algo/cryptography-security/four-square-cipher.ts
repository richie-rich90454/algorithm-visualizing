/**
 * four-square-cipher.ts - Four-Square Cipher
 *
 * A classical digraph cipher that uses four five-by-five squares. Two squares
 * hold the plaintext alphabet and two hold the ciphertext alphabet. Each pair
 * of letters is enciphered by reading across the rectangle the pair defines in
 * the two plaintext squares. Decryption reads the rectangle back. This is a
 * real, fully implemented cipher; it is historically significant but not
 * secure by modern standards.
 *
 * Complexity:
 *   Time:  O(n) for n plaintext letters
 *   Space: O(n) for the ciphertext
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const ALPHABET = "ABCDEFGHIKLMNOPQRSTUVWXYZ";

type Squares = [string[], string[], string[], string[]];

function clean(text: string): string {
    return text.toUpperCase().replace(/J/g, "I").replace(/[^A-Z]/g, "");
}

function square(keyword: string): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const letter of clean(keyword) + ALPHABET) {
        if (!seen.has(letter)) {
            seen.add(letter);
            result.push(letter);
        }
    }
    return result;
}

function locate(sq: string[], letter: string): [number, number] {
    const at = sq.indexOf(letter);
    return [Math.floor(at / 5), at % 5];
}

function buildSquares(keys: string[]): Squares {
    return [
        square(keys[0] ?? "EXAMPLE"),
        square(keys[1] ?? "PLAYFAIR"),
        square(keys[2] ?? "KEYWORD"),
        square(keys[3] ?? "MONARCHY"),
    ];
}

/** Encipher one digraph; TL and BR are plaintext squares, TR and BL ciphertext. */
function encipherPair(sq: Squares, pair: string): [string, string, number, number, number, number] {
    const [r1, c1] = locate(sq[0], pair[0] ?? "A");
    const [r2, c2] = locate(sq[1], pair[1] ?? "A");
    return [sq[2][r1 * 5 + c2] ?? "A", sq[3][r2 * 5 + c1] ?? "A", r1, c1, r2, c2];
}

function decipherPair(sq: Squares, pair: string): string {
    const [r1, c2] = locate(sq[2], pair[0] ?? "A");
    const [r2, c1] = locate(sq[3], pair[1] ?? "A");
    return (sq[0][r1 * 5 + c1] ?? "A") + (sq[1][r2 * 5 + c2] ?? "A");
}

function makeCells(sq: Squares, active: Set<string>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const quadrants: Array<[number, number, string[]]> = [
        [0, 0, sq[0]],
        [5, 5, sq[1]],
        [0, 5, sq[2]],
        [5, 0, sq[3]],
    ];
    for (const [baseRow, baseCol, letters] of quadrants) {
        for (let row = 0; row < 5; row += 1) {
            for (let col = 0; col < 5; col += 1) {
                const id = `cell-${baseRow + row}-${baseCol + col}`;
                const letter = letters[row * 5 + col] ?? "A";
                const state: EntityState = active.has(id) ? "active" : "sorted";
                entities.push({
                    id,
                    type: "cell",
                    label: letter,
                    value: letter.charCodeAt(0) - 65,
                    state,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: baseRow + row, col: baseCol + col },
                });
            }
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { plaintext?: string; keys?: string[] } | null) ?? {};
    const plain = clean(String(task.plaintext ?? "ATTACKATDAWN"));
    const padded = plain.length % 2 === 1 ? `${plain}X` : plain;
    const sq = buildSquares(Array.isArray(task.keys) ? task.keys : []);
    const base = { rows: 10, cols: 10, digraphs: padded.length / 2 };

    yield {
        stepNumber: 0,
        entities: makeCells(sq, new Set()),
        edges: [],
        description: "Four five-by-five squares: plaintext on the diagonal, ciphertext off it.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "squares", ciphertext: "" },
    };

    const cipherPairs: string[] = [];
    for (let i = 0; i < padded.length; i += 2) {
        const pair = (padded[i] ?? "A") + (padded[i + 1] ?? "A");
        const [x, y, r1, c1, r2, c2] = encipherPair(sq, pair);
        cipherPairs.push(x + y);
        const active = new Set([
            `cell-${r1}-${c1}`,
            `cell-${5 + r2}-${5 + c2}`,
            `cell-${r1}-${5 + c2}`,
            `cell-${5 + r2}-${c1}`,
        ]);
        yield {
            stepNumber: i / 2 + 1,
            entities: makeCells(sq, active),
            edges: [],
            description: `Pair ${i / 2}: ${pair} maps through the rectangle to ${x}${y}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { ...base, phase: "encrypt", digraph: i / 2, ciphertext: cipherPairs.join("") },
        };
    }

    const ciphertext = cipherPairs.join("");
    const recovered = cipherPairs.map((pair) => decipherPair(sq, pair)).join("");
    yield {
        stepNumber: padded.length / 2 + 1,
        entities: makeCells(sq, new Set()),
        edges: [],
        description: `Ciphertext ${ciphertext}; reading each rectangle back restores ${recovered}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, phase: "done", ciphertext, plaintext: recovered },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Four-square encrypts two letters at a time using four alphabet squares arranged in a block. The first letters of a pair are found in the two diagonal squares, and the ciphertext letters are read from the other two squares at the corners of the rectangle they form. Because it works on pairs, it hides single-letter frequencies better than a simple substitution.",
        invariants: [
            "Each of the four squares contains the 25 merged alphabet letters exactly once.",
            "The two plaintext squares sit on the diagonal and the two ciphertext squares off it.",
            "The rectangle corners always yield two ciphertext letters for the two plaintext letters.",
        ],
        correctness:
            "For a pair, enciphering reads ciphertext letters from the off-diagonal squares using the row of the first plaintext letter and the column of the second, and vice versa. Deciphering locates those ciphertext letters in the same off-diagonal squares, which recovers the original row and column indices, then reads the plaintext letters from the diagonal squares. The two maps are inverse bijections, so decrypting the ciphertext returns the padded plaintext.",
        complexityRationale:
            "Building each square scans the keyword and alphabet once, a constant cost. Each of the n over two digraphs needs four constant-time square lookups, so the time is O(n). The four squares are constant size and the ciphertext is O(n) space.",
        uses: [
            "Historical military digraphic encryption",
            "Teaching polygraphic substitution and rectangle transforms",
            "A classroom exercise in composing two letter squares",
        ],
        references: [
            "Kahn, The Codebreakers, Chapter 4",
            "Delistre, Cryptography and Cryptanalysis, 1955",
        ],
        workedExample:
            "With plaintext diagonal squares keyed by EXAMPLE and PLAYFAIR and ciphertext squares keyed by KEYWORD and MONARCHY, the pair AT is located in the two diagonal squares and its rectangle corners in the off-diagonal squares give the ciphertext pair. Locating those two letters again recovers AT.",
    },
    id: "four-square-cipher",
    name: "Four-Square Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        plaintext: "ATTACKATDAWN",
        keys: ["EXAMPLE", "PLAYFAIR", "KEYWORD", "MONARCHY"],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "merge I and J and build four five-by-five key squares",
        "pad the plaintext to an even length with X",
        "for each pair find both letters in the diagonal squares",
        "read the first ciphertext letter from the top-right square",
        "read the second from the bottom-left square",
        "join all pairs to form the ciphertext",
        "done: reverse the rectangle reads to decrypt",
    ],
};

export default module;
