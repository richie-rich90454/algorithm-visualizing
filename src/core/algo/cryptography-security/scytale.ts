/**
 * scytale.ts - Scytale Transposition Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The scytale is an ancient transposition cipher. The plaintext is written
 * across the rows of a rectangular grid whose width is the key, then read down
 * the columns to produce the ciphertext. Ragged final columns are handled by
 * writing row by row and skipping cells beyond the end of the message.
 * Decryption rebuilds the grid column by column and reads it back row by row.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a message of n characters
 *   Space: O(n) for the displayed grid and the output text
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One character entity per input symbol.
 *   - The active character is highlighted while it is placed in the grid.
 *   - The final frame reports the full transformed message.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mode = "encrypt" | "decrypt";

/** Column lengths when n characters are spread across width columns. */
function columnLengths(n: number, width: number): number[] {
    const rows = Math.ceil(n / width);
    const remainder = n % width;
    return Array.from({ length: width }, (_, col) =>
        remainder === 0 ? rows : col < remainder ? rows : rows - 1,
    );
}

/** Encrypt by reading a row-major grid column by column. */
function encrypt(text: string, width: number): string {
    const chars = [...text];
    const n = chars.length;
    const rows = Math.ceil(n / width);
    const out: string[] = [];
    for (let col = 0; col < width; col += 1) {
        for (let row = 0; row < rows; row += 1) {
            const index = row * width + col;
            if (index < n) out.push(chars[index] as string);
        }
    }
    return out.join("");
}

/** Decrypt by refilling the grid column by column, then reading rows. */
function decrypt(text: string, width: number): string {
    const chars = [...text];
    const n = chars.length;
    if (n === 0) return "";
    const rows = Math.ceil(n / width);
    const lengths = columnLengths(n, width);
    const grid: string[][] = Array.from({ length: rows }, () => new Array<string>(width).fill(""));
    let ptr = 0;
    for (let col = 0; col < width; col += 1) {
        for (let row = 0; row < lengths[col]!; row += 1) {
            const gridRow = grid[row];
            if (gridRow) gridRow[col] = chars[ptr++] as string;
        }
    }
    const out: string[] = [];
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < width; col += 1) {
            const value = grid[row]?.[col];
            if (value) out.push(value);
        }
    }
    return out.join("");
}

/** Build one character entity per input symbol. */
function buildEntities(chars: string[], states: Map<number, EntityState>, output: string): VisualEntity[] {
    return chars.map((ch, index) => ({
        id: `char-${index}`,
        type: "character" as const,
        label: ch,
        value: ch,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, output: output[index] ?? ch },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; rails?: number; mode?: Mode } | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "ATTACKATDAWN";
    const width = Math.max(1, Math.floor(task.rails ?? 4));
    const mode: Mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const chars = [...text];
    const states = new Map<number, EntityState>();
    const transform = mode === "encrypt" ? encrypt : decrypt;
    let output = "";
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities(chars, states, output),
        edges: [],
        description: `${mode === "encrypt" ? "Encrypting" : "Decrypting"} ${chars.length} character(s) with a scytale of width ${width}.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { rails: width, mode, output: "", input: text, phase: "start" },
    };

    for (let i = 0; i < chars.length; i += 1) {
        states.clear();
        states.set(i, "active");
        output = transform(text.slice(0, i + 1), width);
        yield {
            stepNumber: step++,
        entities: buildEntities(chars, states, output),
        edges: [],
        description: `Placed character ${i + 1} (${chars[i]}); partial result so far: "${output}".`,
        codeLineNumber: mode === "encrypt" ? 3 : 5,
        layout: "text",
        meta: { rails: width, mode, output, input: text, phase: "step", index: i },
        };
    }

    output = transform(text, width);
    yield {
        stepNumber: step++,
        entities: buildEntities(chars, states, output),
        edges: [],
        description: `Scytale ${mode} complete: "${output}".`,
        codeLineNumber: 6,
        layout: "text",
        meta: { rails: width, mode, output, input: text, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Wrap a strip of parchment around a rod of a fixed thickness and write the message along the rod. When you unwrap it the letters are scrambled. The key is the rod thickness, which is the number of columns in an imaginary grid: write across the rows, then read down the columns to hide the message.",
        invariants: [
            "The key is the grid width and never changes during the run.",
            "Encryption reads a row-major grid column by column.",
            "Decryption rebuilds the same grid and reads it row by row, so it inverts encryption.",
        ],
        correctness:
            "Encryption writes character i to grid position (row = floor(i / width), column = i mod width) and then emits cells in column-major order. Decryption computes the same column lengths, refills those exact grid positions with the cipher characters in column-major order, and reads row-major. Because the two procedures use the same position map in opposite directions, decrypt(encrypt(text)) returns the original text, including for a ragged final row.",
        complexityRationale:
            "Writing n characters to grid positions and reading them back touches each character once, so both directions run in O(n). The character display and output string use O(n) space.",
        uses: [
            "Teaching the difference between transposition and substitution",
            "Historical study of classical cryptography",
            "A simple check that a permutation cipher is invertible",
        ],
        references: [
            "Kahn, The Codebreakers",
            "Wikipedia, Scytale",
        ],
        workedExample:
            "Writing ATTACKATDAWN across a grid of width 4 and reading down the columns gives A A A A T T K N C D T A A D (with the short final column), and reading the grid back recovers the original message.",
    },
    id: "scytale",
    name: "Scytale Transposition Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "ATTACKATDAWN", rails: 4, mode: "encrypt" },
    visualType: "text",
    run,
    pseudocode: [
        "read the message, the key width and the direction",
        "compute the number of rows needed for the grid",
        "for encryption, write letters across the rows",
        "then read the grid down each column to form the ciphertext",
        "for decryption, fill the grid down the columns",
        "then read the grid across each row to recover the plaintext",
        "done: return the transformed message",
    ],
};

export default module;
