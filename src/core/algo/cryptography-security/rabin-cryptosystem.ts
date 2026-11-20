/**
 * rabin-cryptosystem.ts - Rabin Cryptosystem (Small-Parameter Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rabin encryption raises a message to the second power modulo n = p*q. When
 * both primes are congruent to 3 modulo 4, decryption takes square roots
 * modulo each prime with a single exponentiation and combines the two signs
 * with the Chinese remainder theorem. This yields four candidate plaintexts,
 * so a real deployment must add padding to identify the right one. The tiny
 * primes here illustrate the mathematics and provide no security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) for the modular exponentiations
 *   Space: O(1) beyond the visualization
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A key/value grid lists p, q, n, the ciphertext, the two modular square
 *     roots, and the four CRT-combined candidates.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const ROWS = ["p", "q", "n = p*q", "message m", "cipher c", "root mod p", "root mod q", "four roots"] as const;

/** Modular exponentiation with BigInt so products stay exact. */
function powMod(base: number, exponent: number, modulus: number): number {
    let result = 1n;
    let b = BigInt(base) % BigInt(modulus);
    let e = BigInt(exponent);
    const m = BigInt(modulus);
    while (e > 0n) {
        if (e & 1n) {
            result = (result * b) % m;
        }
        b = (b * b) % m;
        e >>= 1n;
    }
    return Number(result);
}

const mod = (value: number, m: number): number => ((value % m) + m) % m;

/** Combine residues modulo p and q into a residue modulo n. */
function crt(a: number, b: number, p: number, q: number, n: number): number {
    const invQ = powMod(mod(q, p), p - 2, p);
    const invP = powMod(mod(p, q), q - 2, q);
    return mod(a * q * invQ + b * p * invP, n);
}

/** Build the key/value grid cells. */
function makeCells(values: Array<string | null>, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < ROWS.length; row += 1) {
        const value = values[row];
        const state: EntityState = row === current ? "comparing" : value !== null ? "sorted" : "idle";
        entities.push({
            id: `cell-${row}-0`,
            type: "cell",
            label: ROWS[row] ?? "",
            value: ROWS[row] ?? "",
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col: 0 },
        });
        entities.push({
            id: `cell-${row}-1`,
            type: "cell",
            label: value ?? "?",
            value: value ?? "",
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col: 1 },
        });
    }
    return entities;
}

/** The Rabin generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { p?: number; q?: number; message?: number } | null) ?? {};
    const p = typeof task.p === "number" ? task.p : 23;
    const q = typeof task.q === "number" ? task.q : 47;
    const n = p * q;
    const message = mod(typeof task.message === "number" ? task.message : 389, n);
    const cipher = powMod(message, 2, n);

    const values: Array<string | null> = Array(ROWS.length).fill(null);
    values[0] = String(p);
    values[1] = String(q);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(values, 0),
        edges: [],
        description: `Rabin toy setup with primes p = ${p} and q = ${q}, both congruent to 3 modulo 4 (not secure).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, p, q, n, message, cipher, valid: false },
    };
    step += 1;

    values[2] = String(n);
    yield {
        stepNumber: step,
        entities: makeCells(values, 2),
        edges: [],
        description: `The public modulus is n = p*q = ${n}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, p, q, n, message, cipher, valid: false },
    };
    step += 1;

    values[3] = String(message);
    values[4] = String(cipher);
    yield {
        stepNumber: step,
        entities: makeCells(values, 4),
        edges: [],
        description: `Encrypt: c = m^2 mod n = ${message}^2 mod ${n} = ${cipher}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, p, q, n, message, cipher, valid: false },
    };
    step += 1;

    const mp = powMod(cipher, (p + 1) / 4, p);
    values[5] = String(mp);
    yield {
        stepNumber: step,
        entities: makeCells(values, 5),
        edges: [],
        description: `Square root modulo p: c^((p+1)/4) mod p = ${mp}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, p, q, n, message, cipher, rootP: mp, valid: false },
    };
    step += 1;

    const mq = powMod(cipher, (q + 1) / 4, q);
    values[6] = String(mq);
    yield {
        stepNumber: step,
        entities: makeCells(values, 6),
        edges: [],
        description: `Square root modulo q: c^((q+1)/4) mod q = ${mq}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, p, q, n, message, cipher, rootP: mp, rootQ: mq, valid: false },
    };
    step += 1;

    const roots: number[] = [];
    for (const a of [mp, p - mp]) {
        for (const b of [mq, q - mq]) {
            roots.push(crt(a, b, p, q, n));
        }
    }
    const uniqueRoots = Array.from(new Set(roots));
    values[7] = uniqueRoots.join(", ");
    yield {
        stepNumber: step,
        entities: makeCells(values, 7),
        edges: [],
        description: `The four sign combinations give square roots ${uniqueRoots.join(", ")} modulo ${n}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, p, q, n, message, cipher, rootP: mp, rootQ: mq, roots: uniqueRoots, valid: true },
    };
    step += 1;

    const allSquareBack = uniqueRoots.every((root) => powMod(root, 2, n) === cipher);
    yield {
        stepNumber: step,
        entities: makeCells(values, -1),
        edges: [],
        description: `Done: ${uniqueRoots.length} candidates square back to c; padding is needed to pick the original message.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: ROWS.length,
            cols: 2,
            p,
            q,
            n,
            message,
            cipher,
            rootP: mp,
            rootQ: mq,
            roots: uniqueRoots,
            valid: allSquareBack && uniqueRoots.includes(message),
        },
    };
}

/** The Rabin cryptosystem module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Squaring a number modulo a composite is easy, but finding square roots without knowing the prime factors is believed to be as hard as factoring. If you do know the primes, take a square root modulo each one and glue the answers together in four sign combinations. The message is one of those four roots.",
        invariants: [
            "Both primes are congruent to 3 modulo 4 so the exponent (p+1)/4 gives a square root.",
            "Each CRT candidate satisfies root squared congruent to the ciphertext modulo n.",
            "For two odd primes there are exactly four distinct square roots of a quadratic residue.",
        ],
        correctness:
            "For a prime p congruent to 3 modulo 4, c^((p+1)/4) squared equals c^(2(p+1)/4) = c^((p+1)/2), which is c times c^((p-1)/2) and reduces to c by Euler's criterion when c is a quadratic residue. The Chinese remainder theorem then combines each choice of sign modulo p and q into a unique residue modulo n, and all four square back to the ciphertext.",
        complexityRationale:
            "Encryption and each root extraction are modular exponentiations with exponents at most n, costing O(log n) multiplications each. The CRT combination and stored roots use O(1) space.",
        uses: [
            "A public-key scheme whose security is equivalent to factoring",
            "A teaching bridge from modular square roots to RSA",
            "Digital signatures built on squaring in Rabin-like schemes",
        ],
        references: [
            "Rabin, Digitalized Signatures and Public-Key Functions as Intractable as Factorization, 1979",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Chapter 8",
        ],
        workedExample:
            "With p = 23, q = 47, and n = 1081, encrypting 389 gives c = 389^2 mod 1081. The square roots modulo p and q are raised to (p+1)/4 and (q+1)/4 respectively, and CRT combines the four sign choices into four roots modulo 1081, one of which is 389.",
    },
    id: "rabin-cryptosystem",
    name: "Rabin Cryptosystem",
    category: "cryptography-security",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { p: 23, q: 47, message: 389 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose primes p and q congruent to 3 modulo 4",
        "compute the public modulus n = p times q",
        "encrypt message m as c = m squared modulo n",
        "compute roots c to the power (p+1)/4 mod p and (q+1)/4 mod q",
        "combine the sign choices with the Chinese remainder theorem",
        "verify each of the four roots squares back to c",
        "use padding to identify the intended plaintext",
        "done: report the four decryption candidates",
    ],
};

export default module;
