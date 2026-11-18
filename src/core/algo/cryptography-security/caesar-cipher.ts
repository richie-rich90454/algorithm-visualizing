/**
 * caesar-cipher.ts - Caesar Shift Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Caesar cipher shifts every plaintext letter by a fixed number of places
 * around the alphabet. Decryption shifts back by the same amount. It is the
 * simplest substitution cipher and is useful for teaching modular arithmetic,
 * even though its small key space makes it trivial to break by brute force.
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
 *   - The top row holds plaintext letters; the bottom row holds ciphertext.
 *   - The active column is yellow; finished columns are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Keep only uppercase letters so every character maps to 0 through 25. */
function letters(text: string): string {
    return text.toUpperCase().replace(/[^A-Z]/g, "");
}

/** Reduce any integer shift into the range 0 through 25. */
function wrap(shift: number): number {
    return ((shift % 26) + 26) % 26;
}

/** Build the two grid rows for the current state of the shift. */
function makeCells(
    plain: string,
    cipher: string,
    current: number,
    done: boolean,
): VisualEntity[] {
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

/** The Caesar cipher generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { plaintext?: string; shift?: number } | null) ?? {};
    const plain = letters(String(task.plaintext ?? "ATTACKATDAWN"));
    const shift = wrap(typeof task.shift === "number" ? task.shift : 3);
    const cipher = plain
        .split("")
        .map((char) => String.fromCharCode(65 + wrap(char.charCodeAt(0) - 65 + shift)))
        .join("");

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(plain, cipher, -1, false),
        edges: [],
        description: `Shifting each letter of "${plain}" forward by ${shift} place(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols: plain.length, shift, processed: 0, ciphertext: cipher },
    };
    step += 1;

    for (let i = 0; i < plain.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(plain, cipher, i, false),
            edges: [],
            description: `Letter ${i}: ${plain[i]} shifted by ${shift} becomes ${cipher[i]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 2, cols: plain.length, shift, processed: i + 1 },
        };
        step += 1;
    }

    const decrypted = cipher
        .split("")
        .map((char) => String.fromCharCode(65 + wrap(char.charCodeAt(0) - 65 - shift)))
        .join("");
    yield {
        stepNumber: step,
        entities: makeCells(plain, cipher, plain.length - 1, true),
        edges: [],
        description: `Ciphertext ${cipher} shifts back to ${decrypted}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: 2,
            cols: plain.length,
            shift,
            processed: plain.length,
            ciphertext: cipher,
            plaintext: decrypted,
        },
    };
}

/** The Caesar cipher module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Write the alphabet in a circle and rotate it by a fixed number of places. Encryption reads the letter at the rotated position; decryption rotates back by the same amount. Every letter uses the same shift.",
        invariants: [
            "Each letter is represented by a number from 0 through 25.",
            "Encryption adds the shift modulo 26; decryption subtracts it modulo 26.",
            "The shift is the same for every position in the message.",
        ],
        correctness:
            "For a letter number p and shift s, encryption gives c = (p + s) mod 26 and decryption gives (c - s + 26) mod 26 = p. The two modular operations cancel exactly for every letter and every shift, so the original text is recovered.",
        complexityRationale:
            "Each of the n letters needs one arithmetic operation, so the time is O(n). Storing the output string uses O(n) space.",
        uses: [
            "Classical cryptography teaching examples",
            "Simple obfuscation where secrecy is not required",
            "Brute-force key search demonstrations",
        ],
        references: [
            "Suetonius, The Twelve Caesars, Life of Julius 56",
            "Kahn, The Codebreakers, Chapter 2",
        ],
        workedExample:
            "With a shift of 3, ATTACK becomes DWWDFN: A goes to D, T goes to W, and C goes to F. Shifting DWWDFN back by 3 restores ATTACK.",
    },
    id: "caesar-cipher",
    name: "Caesar Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { plaintext: "ATTACKATDAWN", shift: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "normalize the plaintext to uppercase letters",
        "reduce the shift into the range zero through twenty-five",
        "for each plaintext letter in order",
        "add the shift modulo twenty-six to get the cipher letter",
        "subtract the shift modulo twenty-six to decrypt",
        "done: report the ciphertext and the recovered plaintext",
    ],
};

export default module;
