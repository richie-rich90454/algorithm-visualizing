/**
 * playfair-cipher.ts - Playfair Cipher
 *
 * A classical digraph substitution cipher. A five by five key square merges
 * I and J into one cell. Each plaintext pair is encrypted by a row shift, a
 * column shift, or a rectangle swap depending on where the two letters sit in
 * the square. Decryption applies the opposite shifts. This is a real, fully
 * implemented cipher, useful for teaching polygraphic substitution.
 *
 * Complexity:
 *   Time:  O(n) for n plaintext letters
 *   Space: O(n) for the ciphertext
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const ALPHABET = "ABCDEFGHIKLMNOPQRSTUVWXYZ";

type Cell = string | null;

function clean(text: string): string {
    return text
        .toUpperCase()
        .replace(/J/g, "I")
        .replace(/[^A-Z]/g, "");
}

/** Build the 25-letter key square from a keyword plus the unused alphabet letters. */
function keySquare(keyword: string): string[] {
    const seen = new Set<string>();
    const square: string[] = [];
    for (const letter of clean(keyword)) {
        if (!seen.has(letter)) {
            seen.add(letter);
            square.push(letter);
        }
    }
    for (const letter of ALPHABET) {
        if (!seen.has(letter)) {
            seen.add(letter);
            square.push(letter);
        }
    }
    return square;
}

function position(square: string[], letter: string): [number, number] {
    const index = square.indexOf(letter);
    return [Math.floor(index / 5), index % 5];
}

function digraphs(text: string): string[] {
    const padded = text.length % 2 === 1 ? `${text}X` : text;
    const pairs: string[] = [];
    for (let i = 0; i < padded.length; i += 2) {
        pairs.push((padded[i] ?? "?") + (padded[i + 1] ?? "?"));
    }
    return pairs;
}

/** Encrypt one pair; `decrypt` reverses the row and column shifts. */
function transformPair(square: string[], pair: string, decrypt: boolean): string {
    const [r1, c1] = position(square, pair[0] ?? "A");
    const [r2, c2] = position(square, pair[1] ?? "A");
    const step = decrypt ? 4 : 1;
    if (r1 === r2) {
        return square[r1 * 5 + ((c1 + step) % 5)]! + square[r2 * 5 + ((c2 + step) % 5)]!;
    }
    if (c1 === c2) {
        return square[((r1 + step) % 5) * 5 + c1]! + square[((r2 + step) % 5) * 5 + c2]!;
    }
    return square[r1 * 5 + c2]! + square[r2 * 5 + c1]!;
}

function makeCells(
    matrix: Cell[][],
    revealedRows: number,
    active: Set<string>,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const cells = matrix[row] ?? [];
        for (let col = 0; col < cells.length; col += 1) {
            const value = cells[col] ?? null;
            const id = `cell-${row}-${col}`;
            const hidden = row >= revealedRows || value === null;
            const state: EntityState = hidden
                ? "unvisited"
                : active.has(id)
                  ? "active"
                  : "sorted";
            entities.push({
                id,
                type: "cell",
                label: hidden ? "?" : value,
                value: value === null ? -1 : value.charCodeAt(0) - 65,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { plaintext?: string; keyword?: string } | null) ?? {};
    const plain = clean(String(task.plaintext ?? "ATTACKATDAWN"));
    const square = keySquare(String(task.keyword ?? "PLAYFAIR"));
    const pairs = digraphs(plain);
    const cipherPairs = pairs.map((pair) => transformPair(square, pair, false));
    const ciphertext = cipherPairs.join("");

    const matrix: Cell[][] = [];
    for (let r = 0; r < 5; r += 1) {
        matrix.push(square.slice(r * 5, r * 5 + 5));
    }
    for (let i = 0; i < pairs.length; i += 1) {
        const pair = pairs[i] ?? "??";
        const cipher = cipherPairs[i] ?? "??";
        matrix.push([pair[0] ?? "?", pair[1] ?? "?", cipher[0] ?? "?", cipher[1] ?? "?", null]);
    }
    const base = { rows: matrix.length, cols: 5, squareRows: 5, digraphs: pairs.length };

    yield {
        stepNumber: 0,
        entities: makeCells(matrix, 5, new Set()),
        edges: [],
        description: `Key square from keyword (I and J share a cell); ${pairs.length} digraph(s) to encrypt.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "square", ciphertext: "", square: square.join("") },
    };
    for (let i = 0; i < pairs.length; i += 1) {
        const pair = pairs[i] ?? "??";
        const cipher = cipherPairs[i] ?? "??";
        const active = new Set<string>();
        for (const letter of [pair[0], pair[1], cipher[0], cipher[1]]) {
            const index = square.indexOf(letter ?? "");
            if (index >= 0) {
                active.add(`cell-${Math.floor(index / 5)}-${index % 5}`);
            }
        }
        yield {
            stepNumber: i + 1,
            entities: makeCells(matrix, 5 + i + 1, active),
            edges: [],
            description: `Pair ${i}: ${pair} becomes ${cipher} by the row, column, or rectangle rule.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                ...base,
                phase: "encrypt",
                digraph: i,
                ciphertext: cipherPairs.slice(0, i + 1).join(""),
            },
        };
    }
    yield {
        stepNumber: pairs.length + 1,
        entities: makeCells(matrix, matrix.length, new Set()),
        edges: [],
        description: `Ciphertext is ${ciphertext}; decrypting each pair with the reverse shift restores the plaintext.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            ...base,
            phase: "done",
            ciphertext,
            plaintext: cipherPairs
                .map((pair) => transformPair(square, pair, true))
                .join(""),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The Playfair cipher encrypts two letters at a time instead of one, which hides single-letter frequencies. A key square arranges the alphabet in a five by five grid with I and J merged. The position of a pair in that grid decides whether you slide both letters along their row, down their column, or swap their columns.",
        invariants: [
            "The key square contains each of the 25 merged alphabet letters exactly once.",
            "Letters in the same row shift horizontally; letters in the same column shift vertically.",
            "Letters in different rows and columns swap their columns and keep their rows.",
        ],
        correctness:
            "Encryption and decryption are inverse maps on the same square. A right shift of one is undone by a shift of four modulo five, which is the left shift; the same holds vertically. A rectangle swap is its own inverse because applying it twice restores each letter's original column. Since every pair transformation is a bijection and the pairs partition the padded message, decrypting the ciphertext returns the original plaintext.",
        complexityRationale:
            "The square is built once from the keyword in constant time, and each of the n over two digraphs needs a constant number of lookups, so the time is O(n). The square and the output string use O(n) space.",
        uses: [
            "Historical military and diplomatic message encryption",
            "Teaching polygraphic substitution and frequency analysis",
            "A classroom exercise in modular positioning",
        ],
        references: [
            "Kahn, The Codebreakers, Chapter 4",
            "Singh, The Code Book, Chapter 2",
        ],
        workedExample:
            "With the keyword PLAYFAIR, the pair AT may lie in different rows and columns, so their columns are swapped while their rows stay fixed. Decrypting the resulting pair swaps those columns back, recovering AT.",
    },
    id: "playfair-cipher",
    name: "Playfair Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { plaintext: "ATTACKATDAWN", keyword: "PLAYFAIR" },
    visualType: "grid",
    run,
    pseudocode: [
        "build a five by five square from the keyword and the remaining letters",
        "merge I and J into one cell and split the text into pairs",
        "for each pair locate both letters in the square",
        "shift both letters one step right in the same row",
        "shift both letters one step down in the same column",
        "otherwise swap the two column positions",
        "done: join the encrypted pairs into the ciphertext",
    ],
};

export default module;
