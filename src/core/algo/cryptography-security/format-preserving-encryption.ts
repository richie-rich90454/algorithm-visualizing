/**
 * format-preserving-encryption.ts - Format-Preserving Encryption (Feistel Core)
 *
 * TEACHING MODEL, NOT A NIST FF1 OR FF3 IMPLEMENTATION. Format-preserving
 * encryption maps a value in a restricted domain, such as a digit string, to
 * another value of exactly the same format. The teachable core is a balanced
 * Feistel network over that domain: split the string, apply a keyed round
 * function to one half, and swap. This module uses a toy round function so
 * every round can be checked by hand. It makes no production security claim.
 *
 * Complexity:
 *   Time:  O(r) for r Feistel rounds
 *   Space: O(1) working state
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Cell = number | null;

function makeCells(matrix: Cell[][], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const cells = matrix[row] ?? [];
        for (let col = 0; col < cells.length; col += 1) {
            const value = cells[col] ?? null;
            const hidden = row >= revealed || value === null;
            const state: EntityState = hidden
                ? "unvisited"
                : row === current
                  ? "active"
                  : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: hidden ? "?" : String(value),
                value: value ?? -1,
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

/** A deterministic toy round function over the half-domain. */
function roundFunction(round: number, value: number, key: number, modulus: number): number {
    return (key + value * (round + 1) + round * round * 7 + 13) % modulus;
}

function pad(value: number, width: number): string {
    return String(value).padStart(width, "0");
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { digits?: string; key?: number; rounds?: number } | null
    ) ?? {};
    let text = String(task.digits ?? "123456").replace(/[^0-9]/g, "");
    if (text.length % 2 === 1) {
        text = `0${text}`;
    }
    if (text.length === 0) {
        text = "00";
    }
    const key = Math.floor(task.key ?? 7);
    const rounds = Math.max(1, Math.min(12, Math.floor(task.rounds ?? 4)));
    const half = text.length / 2;
    const modulus = 10 ** half;
    let left = Number(text.slice(0, half));
    let right = Number(text.slice(half));
    const trace: Array<[number, number, number, number, number]> = [];
    for (let r = 0; r < rounds; r += 1) {
        const f = roundFunction(r, right, key, modulus);
        const nextLeft = right;
        const nextRight = (left + f) % modulus;
        trace.push([r, left, right, f, nextRight]);
        left = nextLeft;
        right = nextRight;
    }
    const ciphertext = pad(left, half) + pad(right, half);

    let dl = left;
    let dr = right;
    for (let r = rounds - 1; r >= 0; r -= 1) {
        const previousRight = dl;
        const f = roundFunction(r, previousRight, key, modulus);
        const previousLeft = (dr - f + modulus) % modulus;
        dl = previousLeft;
        dr = previousRight;
    }
    const plaintext = pad(dl, half) + pad(dr, half);

    const matrix: Cell[][] = trace.map(([r, l, v, f, nr]) => [r, l, v, f, nr]);
    const base = { rows: rounds, cols: 5, rounds, half, modulus };
    yield {
        stepNumber: 0,
        entities: makeCells(matrix, 0, -1),
        edges: [],
        description: `Split ${text} into halves of ${half} digit(s); run ${rounds} Feistel rounds.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "setup", ciphertext: "", plaintext: text },
    };
    for (let r = 0; r < trace.length; r += 1) {
        yield {
            stepNumber: r + 1,
            entities: makeCells(matrix, r + 1, r),
            edges: [],
            description: `Round ${r}: f = ${trace[r]?.[3]}; new halves are ${trace[r]?.[1]} and ${trace[r]?.[4]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                ...base,
                phase: "feistel",
                round: r,
                ciphertext: r === rounds - 1 ? ciphertext : "",
                plaintext: "",
            },
        };
    }
    yield {
        stepNumber: rounds + 1,
        entities: makeCells(matrix, rounds, -1),
        edges: [],
        description: `Ciphertext ${ciphertext} keeps the ${text.length}-digit format; reversing the rounds restores ${plaintext}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...base, phase: "done", ciphertext, plaintext },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Format-preserving encryption hides a value without changing its shape: a six-digit number encrypts to another six-digit number. A Feistel network makes this easy because it only needs a round function on one half and never requires that function to be invertible. The halves are combined with addition modulo the half-domain and swapped each round.",
        invariants: [
            "Both halves always stay in the range zero through ten to the half length minus one.",
            "Each round sets the new left half to the old right half.",
            "Decryption runs the same round function in reverse order with subtraction.",
        ],
        correctness:
            "A Feistel round maps the pair (L, R) to (R, L plus F(R) modulo m). Given the output, the previous right half is the current left half, and the previous left half is recovered by subtracting F of that value modulo m. Because addition and subtraction modulo m are inverse operations, every round is invertible regardless of the round function, and running the rounds backward restores the original halves exactly.",
        complexityRationale:
            "Each of the r rounds performs one round function evaluation and a couple of arithmetic operations, so the time is O(r). The state is just the two halves, giving O(1) working space.",
        uses: [
            "Encrypting identifiers while preserving database column formats",
            "Tokenizing payment card numbers with the same length",
            "A teaching model of Feistel networks over a small domain",
        ],
        references: [
            "Black and Rogaway, Ciphers with Arbitrary Finite Domains, 2002",
            "NIST SP 800-38G, Recommendation for Block Cipher Modes: FF1 and FF3, 2016",
        ],
        workedExample:
            "With the digits 123456 split into 123 and 456 and modulus 1000, round zero computes F from 456 and the key, adds it to 123 modulo 1000, and swaps the halves. Repeating four rounds gives a six-digit ciphertext, and reversing the rounds returns 123456.",
    },
    id: "format-preserving-encryption",
    name: "Format-Preserving Encryption (Feistel Network Core)",
    category: "cryptography-security",
    complexity: { time: "O(r)", space: "O(1)" },
    defaultInput: { digits: "123456", key: 7, rounds: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "split the digit string into two equal halves",
        "set the modulus to ten to the half length",
        "for each round compute F from the right half and the key",
        "set the new right half to the left half plus F modulo the modulus",
        "swap the left and right halves",
        "to decrypt subtract F and walk the rounds in reverse",
        "done: reformat both halves into the original digit format",
    ],
};

export default module;
