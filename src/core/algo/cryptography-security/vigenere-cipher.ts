/**
 * vigenere-cipher.ts - Vigenere Shift Cipher
 *
 * The Vigenere cipher shifts each plaintext letter by a letter of a repeating
 * keyword: position i uses keyword[i mod m]. Decryption subtracts the same key
 * letter. It generalizes the Caesar cipher and is breakable by frequency
 * analysis once the key length is known, so it is a teaching example only.
 *
 * Time:  O(n) for a message of n letters
 * Space: O(n) for the ciphertext
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Keep only uppercase letters. */
function letters(text: string): string {
    return text.toUpperCase().replace(/[^A-Z]/g, "");
}

/** Reduce any integer shift into 0 through 25. */
function wrap(shift: number): number {
    return ((shift % 26) + 26) % 26;
}

/** Two grid rows: plaintext on top, ciphertext below. */
function makeCells(plain: string, cipher: string, current: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < plain.length; i += 1) {
        const state: EntityState = done || i < current ? "sorted" : i === current ? "comparing" : "idle";
        const cipherLabel = done || i < current ? cipher[i] ?? "?" : "?";
        entities.push({
            id: `cell-0-${i}`,
            type: "cell",
            label: plain[i] ?? "?",
            value: plain.charCodeAt(i) - 65,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        });
        entities.push({
            id: `cell-1-${i}`,
            type: "cell",
            label: cipherLabel,
            value: cipherLabel === "?" ? -1 : cipher.charCodeAt(i) - 65,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: i },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { plaintext?: string; keyword?: string } | null) ?? {};
    const plain = letters(String(task.plaintext ?? "ATTACKATDAWN"));
    const keyword = letters(String(task.keyword ?? "LEMON"));
    if (keyword.length === 0) {
        yield {
            stepNumber: 0,
            entities: makeCells(plain, "", -1, false),
            edges: [],
            description: "A nonempty keyword is required.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: 2, cols: plain.length, keyword: "", ciphertext: "", recovered: "" },
        };
        return;
    }

    const keyShifts = Array.from({ length: plain.length }, (_v, i) => keyword.charCodeAt(i % keyword.length) - 65);
    const cipher = plain
        .split("")
        .map((char, i) => String.fromCharCode(65 + wrap(char.charCodeAt(0) - 65 + (keyShifts[i] ?? 0))))
        .join("");

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(plain, cipher, -1, false),
        edges: [],
        description: `Encrypting ${plain.length} letters with repeating keyword "${keyword}".`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols: plain.length, keyword, ciphertext: cipher, processed: 0 },
    };
    step += 1;

    for (let i = 0; i < plain.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(plain, cipher, i, false),
            edges: [],
            description: `Letter ${i}: ${plain[i]} shifted by key ${keyword[i % keyword.length]} (${keyShifts[i]}) becomes ${cipher[i]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 2, cols: plain.length, keyword, ciphertext: cipher, processed: i + 1 },
        };
        step += 1;
    }

    const recovered = cipher
        .split("")
        .map((char, i) => String.fromCharCode(65 + wrap(char.charCodeAt(0) - 65 - (keyShifts[i] ?? 0))))
        .join("");
    yield {
        stepNumber: step,
        entities: makeCells(plain, cipher, plain.length - 1, true),
        edges: [],
        description: `Ciphertext ${cipher} decrypts back to ${recovered}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 2, cols: plain.length, keyword, ciphertext: cipher, plaintext: recovered },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine several Caesar ciphers applied in turn. The Vigenere cipher uses a keyword: the first letter shifts the first plaintext letter, the second shifts the second, and the key repeats when it runs out. This hides the single-letter frequency pattern that breaks the Caesar cipher.",
        invariants: [
            "Each letter is a number from 0 through 25.",
            "Position i uses key letter i modulo the keyword length.",
            "Encryption adds the key shift modulo 26 and decryption subtracts it modulo 26.",
        ],
        correctness:
            "For a plaintext letter p and key letter k, encryption gives c = (p + k) mod 26. Decryption computes (c - k + 26) mod 26 = p, so the operations cancel exactly for every position and every keyword letter. Repeating the key preserves this identity because the same k is used to encrypt and decrypt a given position.",
        complexityRationale:
            "Each of the n letters needs one modular addition for encryption (and one subtraction for decryption), so time is O(n). The output string uses O(n) space.",
        uses: [
            "Classical cryptography teaching examples",
            "Demonstrating repeating-key weakness and Kasiski analysis",
            "Light obfuscation where secrecy is not required",
        ],
        references: [
            "Kahn, The Codebreakers, Chapter 3",
            "Singh, The Code Book, Chapter 2",
        ],
        workedExample:
            "With plaintext ATTACKATDAWN and keyword LEMON, the first letter A is shifted by L (11) to L, the second T by E (4) to X, and the key repeats after five letters. Decrypting L with L returns A, confirming the round trip.",
    },
    id: "vigenere-cipher",
    name: "Vigenere Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { plaintext: "ATTACKATDAWN", keyword: "LEMON" },
    visualType: "grid",
    run,
    pseudocode: [
        "normalize plaintext and keyword to uppercase letters",
        "for each plaintext position in order",
        "select keyword letter at position modulo key length",
        "add the key shift modulo twenty-six to encrypt",
        "subtract the key shift modulo twenty-six to decrypt",
        "done: report ciphertext and recovered plaintext",
    ],
};

export default module;
