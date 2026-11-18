/**
 * one-time-pad.ts - One-Time Pad on Letters
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A one-time pad adds each plaintext letter to a key letter modulo 26. If the
 * key is truly random, at least as long as the message, and never reused, the
 * ciphertext reveals no information about the plaintext. Decryption subtracts
 * the same key letters modulo 26. This demo cycles a supplied key so short
 * keys stay playable; the security property only holds for a genuine pad.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a message of n letters
 *   Space: O(n) for the ciphertext
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Three rows show plaintext, key letter, and ciphertext.
 *   - The active column is yellow; finished columns are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Keep only uppercase letters so every character maps to 0 through 25. */
function letters(text: string): string {
    return text.toUpperCase().replace(/[^A-Z]/g, "");
}

/** Build one grid cell. */
function cell(
    row: number,
    col: number,
    label: string,
    value: number | string,
    state: EntityState,
): VisualEntity {
    return {
        id: `cell-${row}-${col}`,
        type: "cell",
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row, col },
    };
}

/** Build the three grid rows for the current state of the encryption. */
function makeCells(
    plain: string,
    key: string,
    cipher: string,
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < plain.length; i += 1) {
        const state: EntityState = done || i < current ? "sorted" : i === current ? "comparing" : "idle";
        const shift = key.charCodeAt(i % key.length) - 65;
        const cipherLabel = done || i < current ? cipher[i] ?? "?" : "?";
        entities.push(cell(0, i, plain[i] ?? "?", plain.charCodeAt(i) - 65, state));
        entities.push(cell(1, i, key[i % key.length] ?? "A", shift, state));
        entities.push(cell(2, i, cipherLabel, cipherLabel === "?" ? -1 : cipher.charCodeAt(i) - 65, state));
    }
    return entities;
}

/** The one-time pad generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { plaintext?: string; key?: string } | null) ?? {};
    const plain = letters(String(task.plaintext ?? "ATTACKDAWN"));
    const keyStream = letters(String(task.key ?? "STREAM"));
    const key = keyStream.length > 0 ? keyStream : "A";
    const cipher = plain
        .split("")
        .map((char, index) =>
            String.fromCharCode(
                65 +
                    ((char.charCodeAt(0) - 65 + (key.charCodeAt(index % key.length) - 65)) % 26),
            ),
        )
        .join("");

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(plain, key, cipher, -1, false),
        edges: [],
        description: `Encrypting ${plain.length} letters with a ${key.length}-letter key stream.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3, cols: plain.length, processed: 0, ciphertext: cipher },
    };
    step += 1;

    for (let i = 0; i < plain.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(plain, key, cipher, i, false),
            edges: [],
            description: `Column ${i}: ${plain[i]} + ${key[i % key.length]} modulo 26 = ${cipher[i]}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: 3,
                cols: plain.length,
                processed: i + 1,
                ciphertext: cipher.slice(0, i + 1),
            },
        };
        step += 1;
    }

    const decrypted = cipher
        .split("")
        .map((char, index) =>
            String.fromCharCode(
                65 +
                    ((char.charCodeAt(0) - 65 - (key.charCodeAt(index % key.length) - 65) + 26) % 26),
            ),
        )
        .join("");
    yield {
        stepNumber: step,
        entities: makeCells(plain, key, cipher, plain.length - 1, true),
        edges: [],
        description: `Ciphertext ${cipher} decrypts back to ${decrypted}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 3,
            cols: plain.length,
            processed: plain.length,
            ciphertext: cipher,
            plaintext: decrypted,
        },
    };
}

/** The one-time pad module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Turn each letter into a number, add a secret key letter to it modulo the alphabet size, and turn the result back into a letter. The key changes the result of every position independently, so without the key each ciphertext letter is uniformly random.",
        invariants: [
            "Plaintext, key, and ciphertext letters are all mapped to the range 0 through 25.",
            "Decryption subtracts the same key letter that encryption added.",
            "A ciphertext letter is the plaintext shifted by the key letter modulo 26.",
        ],
        correctness:
            "For any plaintext number p and key number k, encryption produces c = (p + k) mod 26, and decryption computes (c - k + 26) mod 26 = p. The algebra is exact for every pair, so the original message is always recovered when the same key is used.",
        complexityRationale:
            "One modular addition per plaintext letter gives O(n) encryption time, and the ciphertext stores n letters so space is O(n).",
        uses: [
            "Historical diplomatic and military message encryption",
            "Information-theoretic secrecy demonstrations",
            "A teaching baseline for modern stream ciphers",
        ],
        references: [
            "Vernam, Cipher Printing Telegraph Systems, 1926",
            "Shannon, Communication Theory of Secrecy Systems, 1949",
        ],
        workedExample:
            "Encrypting ATTACK with key STREAM: A(0) + S(18) = S, T(19) + T(19) = M, T(19) + R(17) = K, and so on. Subtracting the same key letters from the ciphertext restores ATTACK exactly.",
    },
    id: "one-time-pad",
    name: "One-Time Pad",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { plaintext: "ATTACKDAWN", key: "STREAM" },
    visualType: "grid",
    run,
    pseudocode: [
        "normalize plaintext and key to uppercase letters",
        "for each plaintext letter at index i",
        "convert plaintext and key letters to numbers zero through twenty-five",
        "add them modulo twenty-six to get the cipher letter",
        "subtract the key letter modulo twenty-six to decrypt",
        "done: report the ciphertext and the recovered plaintext",
    ],
};

export default module;
