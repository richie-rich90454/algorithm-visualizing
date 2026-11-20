/**
 * bifid-cipher.ts - Bifid Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Bifid cipher is a fractionating cipher built on a 5 by 5 Polybius square
 * that merges I and J. Plaintext letters are replaced by row and column
 * coordinates; within a block of period letters, all row coordinates are
 * written first and all column coordinates second. Regrouping that coordinate
 * stream into pairs mixes the row of one letter with the column of another,
 * which spreads each plaintext letter across two ciphertext letters.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n letters
 *   Space: O(n) for the coordinate stream and output
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The 5 by 5 grid is the Polybius square.
 *   - The cell used for the current letter pair is highlighted.
 *   - The final frame reports the complete ciphertext or plaintext.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mode = "encrypt" | "decrypt";
type Coord = [number, number];

const SQUARE = [
    "A", "B", "C", "D", "E",
    "F", "G", "H", "I", "K",
    "L", "M", "N", "O", "P",
    "Q", "R", "S", "T", "U",
    "V", "W", "X", "Y", "Z",
];

/** Locate a letter in the square, folding J into I. */
function locate(ch: string): Coord | null {
    const normalized = ch === "J" ? "I" : ch;
    const index = SQUARE.indexOf(normalized);
    if (index < 0) return null;
    return [Math.floor(index / 5), index % 5];
}

/** Convert a block of plaintext coordinates into ciphertext coordinates. */
function encryptBlock(coords: Coord[]): Coord[] {
    const stream = [...coords.map((c) => c[0]), ...coords.map((c) => c[1])];
    const out: Coord[] = [];
    for (let k = 0; k + 1 < stream.length; k += 2) {
        out.push([stream[k] as number, stream[k + 1] as number]);
    }
    return out;
}

/** Invert the coordinate regrouping of one ciphertext block. */
function decryptBlock(coords: Coord[]): Coord[] {
    const stream: number[] = [];
    for (const [row, col] of coords) stream.push(row, col);
    const half = stream.length / 2;
    const rows = stream.slice(0, half);
    const cols = stream.slice(half);
    return rows.map((row, i) => [row, cols[i] as number] as Coord);
}

/** The Bifid cipher module. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; period?: number; mode?: Mode } | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "ATTACKATDAWN";
    const period = Math.max(2, Math.min(12, Math.floor(task.period ?? 5)));
    const mode: Mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const chars = [...text].map((ch) => ch.toUpperCase());
    const letterIndices: number[] = [];
    chars.forEach((ch, i) => {
        if (locate(ch)) letterIndices.push(i);
    });

    const output = new Array<string>(chars.length).fill("");
    for (let i = 0; i < chars.length; i += 1) {
        if (!locate(chars[i] as string)) output[i] = chars[i];
    }

    const cells = (highlight: Coord | null): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        for (let row = 0; row < 5; row += 1) {
            for (let col = 0; col < 5; col += 1) {
                const on = highlight !== null && highlight[0] === row && highlight[1] === col;
                entities.push({
                    id: `cell-${row}-${col}`,
                    type: "cell" as const,
                    label: SQUARE[row * 5 + col] as string,
                    value: SQUARE[row * 5 + col] as string,
                    state: (on ? "active" : "visited") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col, letter: SQUARE[row * 5 + col] as string },
                });
            }
        }
        return entities;
    };

    yield {
        stepNumber: 0,
        entities: cells(null),
        edges: [],
        description: `${mode === "encrypt" ? "Encrypting" : "Decrypting"} ${letterIndices.length} letter(s) with a Bifid square of period ${period}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 5, cols: 5, period, mode, output: output.join(""), square: SQUARE.slice(), blocks: [] },
    };
    let step = 1;

    const blocks: string[][] = [];
    for (let start = 0; start < letterIndices.length; start += period) {
        const positions = letterIndices.slice(start, start + period);
        const sourceCoords = positions.map((i) => locate(chars[i] as string) as Coord);
        const resultCoords = mode === "encrypt" ? encryptBlock(sourceCoords) : decryptBlock(sourceCoords);
        const sourceLetters = sourceCoords.map(([r, c]) => SQUARE[r * 5 + c] as string);
        blocks.push(sourceLetters);
        for (let k = 0; k < resultCoords.length; k += 1) {
            const [r, c] = resultCoords[k] as Coord;
            output[positions[k] as number] = SQUARE[r * 5 + c] as string;
            yield {
                stepNumber: step,
                entities: cells([r, c]),
                edges: [],
                description: `Block starting at letter ${start}: mapped ${sourceLetters[k]} through square cell (${r}, ${c}) to ${SQUARE[r * 5 + c]}.`,
                codeLineNumber: mode === "encrypt" ? 4 : 6,
                layout: "grid",
                meta: {
                    rows: 5,
                    cols: 5,
                    period,
                    mode,
                    output: output.join(""),
                    square: SQUARE.slice(),
                    blocks: blocks.slice(),
                    index: positions[k],
                },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: cells(null),
        edges: [],
        description: `Bifid ${mode} complete: "${output.join("")}".`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: 5, cols: 5, period, mode, output: output.join(""), square: SQUARE.slice(), blocks: blocks.slice() },
    };
}

/** The Bifid cipher module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Substitution ciphers hide a letter by replacing it with one symbol. Bifid goes further: it splits each letter into two coordinates, pools the coordinates across a block, and recombines them into new letters. A single plaintext letter therefore influences two ciphertext letters, which breaks the direct letter-to-letter frequency pattern that simple substitution leaves behind.",
        invariants: [
            "The square holds 25 letters with I and J sharing one cell.",
            "Within a block the coordinate stream has twice as many entries as letters.",
            "Non-letters are copied unchanged and never enter the square.",
        ],
        correctness:
            "Encryption writes each block's row coordinates followed by its column coordinates and then reads consecutive pairs as square coordinates. Decryption reverses this: it expands each ciphertext letter back into its two coordinates, takes the first half of the stream as rows and the second half as columns, and recombines them in order. Because the halves have equal length exactly when the block length is preserved, the two transformations are inverse permutations of the coordinate stream and recover the plaintext.",
        complexityRationale:
            "Locating a letter is a constant-time table lookup, and each block processes twice as many coordinates as it has letters, so both directions run in O(n). The square is fixed and the coordinate stream is O(n), giving O(n) working space.",
        uses: [
            "Classical cryptography and fractionation cipher study",
            "Understanding diffusion before modern block ciphers",
            "Historical military telegraph encryption",
        ],
        references: [
            "Delastelle, Traité élémentaire de cryptographie, 1902",
            "Wikipedia, Bifid cipher",
        ],
        workedExample:
            "With a two-letter block, plaintext letters at coordinates (a, b) and (c, d) produce the coordinate stream a, c, b, d. Reading pairs gives (a, c) and (b, d) as the ciphertext letters. Decryption expands those back to a, c, b, d, takes rows a, c and columns b, d, and rebuilds the original letters.",
    },
    id: "bifid-cipher",
    name: "Bifid Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "ATTACKATDAWN", period: 5, mode: "encrypt" },
    visualType: "grid",
    run,
    pseudocode: [
        "build the five by five Polybius square",
        "split the letters into blocks of the chosen period",
        "replace each letter by its row and column",
        "write all row coordinates then all column coordinates",
        "read consecutive pairs as new square coordinates",
        "for decryption rebuild the two coordinate halves",
        "pair row and column halves to restore plaintext",
        "done: return the transformed message",
    ],
};

export default module;
