/**
 * adfgvx-cipher.ts - ADFGVX Cipher
 *
 * A World War I field cipher that combines fractionation with columnar
 * transposition. Each plaintext letter or digit is replaced by a pair drawn
 * from the six letters A, D, F, G, V, X using a six-by-six Polybius square;
 * the resulting string is then permuted by a keyword columnar transposition.
 * Decryption undoes the transposition and then the substitution. The core is
 * fully implemented; it is historically important but insecure today.
 *
 * Complexity:
 *   Time:  O(n log k) for n characters and a key of length k
 *   Space: O(n) for the intermediate and final strings
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const COORDS = "ADFGVX";
const SQUARE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function clean(text: string): string {
    return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function buildSquare(keyword: string): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const ch of clean(keyword) + SQUARE_CHARS) {
        if (!seen.has(ch)) {
            seen.add(ch);
            result.push(ch);
        }
    }
    return result.slice(0, 36);
}

function orderOf(keyword: string): number[] {
    const key = keyword.toUpperCase().replace(/[^A-Z]/g, "");
    return Array.from({ length: key.length }, (_, i) => i).sort((i, j) => {
        const a = key[i] ?? "";
        const b = key[j] ?? "";
        return a === b ? i - j : a.charCodeAt(0) - b.charCodeAt(0);
    });
}

function columnLengths(length: number, cols: number): number[] {
    const rows = Math.ceil(length / cols);
    const deficit = rows * cols - length;
    return Array.from({ length: cols }, (_, col) => rows - (col >= cols - deficit ? 1 : 0));
}

function transpose(substituted: string, order: number[]): string {
    const cols = order.length;
    const lengths = columnLengths(substituted.length, cols);
    const out: string[] = [];
    let cursor = 0;
    for (const col of order) {
        const count = lengths[col] ?? 0;
        for (let r = 0; r < count; r += 1) {
            const index = r * cols + col;
            out.push(substituted[index] ?? "A");
        }
        cursor += count;
    }
    void cursor;
    return out.join("");
}

function inverseTranspose(cipher: string, order: number[]): string {
    const cols = order.length;
    const lengths = columnLengths(cipher.length, cols);
    const rows = Math.ceil(cipher.length / cols);
    const grid: string[][] = Array.from({ length: rows }, () => Array<string>(cols).fill(""));
    let at = 0;
    for (const col of order) {
        const count = lengths[col] ?? 0;
        for (let r = 0; r < count; r += 1) {
            const cell = grid[r];
            if (cell) {
                cell[col] = cipher[at] ?? "A";
            }
            at += 1;
        }
    }
    return grid.map((row) => row.join("")).join("");
}

function substitute(square: string[], text: string): string {
    const out: string[] = [];
    for (const ch of text) {
        const index = square.indexOf(ch);
        if (index < 0) {
            continue;
        }
        out.push(COORDS[Math.floor(index / 6)] ?? "A", COORDS[index % 6] ?? "A");
    }
    return out.join("");
}

function restore(square: string[], codes: string): string {
    const out: string[] = [];
    for (let i = 0; i + 1 < codes.length; i += 2) {
        const row = COORDS.indexOf(codes[i] ?? "A");
        const col = COORDS.indexOf(codes[i + 1] ?? "A");
        if (row >= 0 && col >= 0) {
            out.push(square[row * 6 + col] ?? "A");
        }
    }
    return out.join("");
}

function makeCells(square: string[], active: Set<string>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < 6; row += 1) {
        for (let col = 0; col < 6; col += 1) {
            const id = `cell-${row}-${col}`;
            const letter = square[row * 6 + col] ?? "A";
            const state: EntityState = active.has(id) ? "active" : "sorted";
            entities.push({
                id,
                type: "cell",
                label: letter,
                value: letter,
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
    const task = (input as { plaintext?: string; squareKey?: string; columnKey?: string } | null) ?? {};
    const plain = clean(String(task.plaintext ?? "ATTACKATDAWN"));
    const square = buildSquare(String(task.squareKey ?? "KEYWORD"));
    const order = orderOf(String(task.columnKey ?? "PRIVACY"));
    const substituted = substitute(square, plain);
    const ciphertext = transpose(substituted, order);
    const recovered = restore(square, inverseTranspose(ciphertext, order));
    const base = { rows: 6, cols: 6, chars: plain.length, columns: order.length };

    yield {
        stepNumber: 0,
        entities: makeCells(square, new Set()),
        edges: [],
        description: "Six-by-six square keyed for fractionation; column key permutes the codes.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "square", ciphertext: "" },
    };

    for (let i = 0; i < plain.length; i += 1) {
        const index = square.indexOf(plain[i] ?? "A");
        const active = new Set<string>([
            `cell-${Math.floor(index / 6)}-${index % 6}`,
        ]);
        yield {
            stepNumber: i + 1,
            entities: makeCells(square, active),
            edges: [],
            description: `Letter ${i}: ${plain[i]} becomes the code pair ${substituted.slice(i * 2, i * 2 + 2)}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { ...base, phase: "fractionate", index: i, ciphertext: "" },
        };
    }

    yield {
        stepNumber: plain.length + 1,
        entities: makeCells(square, new Set()),
        edges: [],
        description: `Columnar transposition with key order ${order.join(",")} gives ${ciphertext}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...base, phase: "transpose", ciphertext },
    };
    yield {
        stepNumber: plain.length + 2,
        entities: makeCells(square, new Set()),
        edges: [],
        description: `Undoing the transposition and substitution restores ${recovered}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { ...base, phase: "done", ciphertext, plaintext: recovered },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "ADFGVX breaks the alphabet into two stages. First each character is replaced by the row and column labels of its cell in a six-by-six square, producing a stream of only six possible letters. Then a keyword columnar transposition scrambles that stream. The combination hides both letter identities and their positions.",
        invariants: [
            "The square holds all 26 letters and 10 digits exactly once.",
            "Every plaintext character becomes exactly two coordinate letters.",
            "The transposition only permutes positions; it never changes code letters.",
        ],
        correctness:
            "Substitution is a bijection from the 36 square cells to ordered pairs of coordinate letters. The columnar transposition writes the code stream into a grid by rows and reads it out by columns in keyword order; its inverse refills the columns in the same order and reads rows back, which restores the exact code stream. Applying the inverse substitution to those pairs maps each pair back to its unique cell, so decryption recovers the input.",
        complexityRationale:
            "Building the square is constant work. Substitution scans n characters once, and the transposition fills and reads an n by k grid, costing O(n log k) to sort the key order and O(n) for the permutation; the stored strings use O(n) space.",
        uses: [
            "World War I trench and artillery message encryption",
            "Teaching fractionation combined with transposition",
            "A historical case study in layered ciphers",
        ],
        references: [
            "Kahn, The Codebreakers, Chapter 5",
            "Singh, The Code Book, Chapter 3",
        ],
        workedExample:
            "With a square keyed by KEYWORD, the letter A sits at some row and column whose labels form a two-letter code. Repeating this for a short message yields a code stream that the column key PRIVACY then rearranges; reversing the column order and reading the codes back recovers the original letters.",
    },
    id: "adfgvx-cipher",
    name: "ADFGVX Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n log k)", space: "O(n)" },
    defaultInput: { plaintext: "ATTACKATDAWN", squareKey: "KEYWORD", columnKey: "PRIVACY" },
    visualType: "grid",
    run,
    pseudocode: [
        "build a six-by-six square from the square key",
        "replace each character by its row and column coordinate letters",
        "write the code stream into rows under the column key",
        "read columns in alphabetical key order to form ciphertext",
        "to decrypt refill columns in that same order",
        "read rows back to recover the code stream",
        "map each coordinate pair to its square cell",
        "done: output the recovered plaintext",
    ],
};

export default module;
