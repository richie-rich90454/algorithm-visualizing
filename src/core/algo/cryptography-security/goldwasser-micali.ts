/**
 * goldwasser-micali.ts - Goldwasser-Micali Bit Encryption (Toy Parameters)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Goldwasser-Micali is a probabilistic public-key scheme that encrypts one bit
 * at a time. The public key is a modulus n = p*q and a quadratic non-residue x
 * whose Jacobi symbol is positive. To encrypt bit b, multiply x to the power b
 * by a random square. Decryption tests whether the result is a quadratic residue
 * modulo p: a residue means the bit was zero. Small primes are used here so the
 * number theory can be shown exactly; this is a teaching model, not a secure
 * deployment.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(bits * log n) for the modular exponentiation per encrypted bit
 *   Space: O(bits) for the ciphertexts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A three-row grid shows each bit, its ciphertext, and its decryption.
 *   - The current column is highlighted while earlier columns are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Modular exponentiation by repeated squaring. */
function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let factor = ((base % modulus) + modulus) % modulus;
    let power = exponent;
    while (power > 0) {
        if (power % 2 === 1) {
            result = (result * factor) % modulus;
        }
        factor = (factor * factor) % modulus;
        power = Math.floor(power / 2);
    }
    return result;
}

/** Euler criterion: 1 for a residue, -1 for a non-residue, 0 when divisible. */
function legendre(value: number, prime: number): number {
    const result = modPow(((value % prime) + prime) % prime, (prime - 1) / 2, prime);
    if (result === 1) {
        return 1;
    }
    if (result === prime - 1) {
        return -1;
    }
    return 0;
}

function gcd(a: number, b: number): number {
    let x = a;
    let y = b;
    while (y !== 0) {
        const next = x % y;
        x = y;
        y = next;
    }
    return x;
}

/** Find a non-residue modulo both primes, so its Jacobi symbol is positive. */
function findNonResidue(p: number, q: number): number {
    for (let candidate = 2; candidate < p * q; candidate += 1) {
        if (
            gcd(candidate, p) === 1 &&
            gcd(candidate, q) === 1 &&
            legendre(candidate, p) === -1 &&
            legendre(candidate, q) === -1
        ) {
            return candidate;
        }
    }
    return 0;
}

/** Deterministic 32-bit pseudo-random generator (mulberry32). */
function mulberry32(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function makeCells(
    bits: number[],
    ciphertexts: number[],
    decoded: number[],
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const rows = ["bit", "cipher", "plain"];
    for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < bits.length; col += 1) {
            const state: EntityState =
                done || col < current ? "sorted" : col === current ? "comparing" : "idle";
            const label = done || col <= current
                ? row === 0
                    ? `${bits[col]}`
                    : row === 1
                        ? `${ciphertexts[col]}`
                        : `${decoded[col]}`
                : "?";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label,
                value: label === "?" ? -1 : Number(label),
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, series: rows[row] ?? "" },
            });
        }
    }
    return entities;
}

/** The Goldwasser-Micali generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { p?: number; q?: number; bits?: number[]; seed?: number } | null
    ) ?? {};
    const p = typeof task.p === "number" && task.p > 2 ? Math.floor(task.p) : 11;
    const q = typeof task.q === "number" && task.q > 2 && task.q !== p ? Math.floor(task.q) : 23;
    const bits: number[] = task.bits ?? [1, 0, 1, 1, 0, 0, 1];
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 29;
    const n = p * q;
    const x = findNonResidue(p, q);
    const random = mulberry32(seed);

    const ciphertexts: number[] = [];
    const decoded: number[] = [];
    const randoms: number[] = [];
    for (const bit of bits) {
        let r = 1 + Math.floor(random() * (n - 1));
        while (gcd(r, n) !== 1) {
            r = 1 + Math.floor(random() * (n - 1));
        }
        const cipher = ((bit === 1 ? x : 1) * r * r) % n;
        ciphertexts.push(cipher);
        decoded.push(legendre(cipher, p) === 1 ? 0 : 1);
        randoms.push(r);
    }

    const baseMeta = { p, q, n, x, seed, cols: bits.length, rows: 3 };

    yield {
        stepNumber: 0,
        entities: makeCells(bits, ciphertexts, decoded, -1, false),
        edges: [],
        description: `GM toy key: n = ${n} = ${p}*${q}, non-residue x = ${x}. Encrypting ${bits.length} bits.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...baseMeta, bits: [...bits], ciphertexts: [], decoded: [], processed: 0 },
    };

    let step = 1;
    for (let i = 0; i < bits.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(bits, ciphertexts, decoded, i, false),
            edges: [],
            description: `Bit ${i} = ${bits[i]} encrypts to ${ciphertexts[i]}; its residue test decrypts to ${decoded[i]}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                ...baseMeta,
                bits: bits.slice(0, i + 1),
                ciphertexts: ciphertexts.slice(0, i + 1),
                decoded: decoded.slice(0, i + 1),
                processed: i + 1,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(bits, ciphertexts, decoded, bits.length - 1, true),
        edges: [],
        description: `All ${bits.length} bits decrypted correctly; small primes are for demonstration only.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            ...baseMeta,
            bits: [...bits],
            ciphertexts: [...ciphertexts],
            decoded: [...decoded],
            randoms: [...randoms],
            processed: bits.length,
            correct: decoded.every((value, index) => value === bits[index]),
        },
    };
}

/** The Goldwasser-Micali module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Bit encryption can hide a bit by making the ciphertext either a random square or a random square multiplied by a special non-square. Anyone can form a square, but only someone who knows the secret factors can cheaply tell whether a number is a square modulo a composite. The receiver tests residuosity with the private primes and reads off the bit.",
        invariants: [
            "The public x has Jacobi symbol positive but is a non-residue modulo both p and q.",
            "Encrypting zero produces a quadratic residue; encrypting one produces a non-residue.",
            "The random square r squared is discarded from the ciphertext by the residuosity test.",
        ],
        correctness:
            "By Euler's criterion, the Legendre symbol of a nonzero square modulo p is one. If the bit is zero, c equals r squared, so its Legendre symbol is one. If the bit is one, c equals x times r squared, whose Legendre symbol is the symbol of x, which is minus one by construction. The decryption test therefore returns the original bit for every random r coprime to n.",
        complexityRationale:
            "Each bit needs one modular multiplication and a fixed-size exponentiation of x to the bit, so encryption is O(bits * log n). The ciphertext array stores one number per bit, giving O(bits) space.",
        uses: [
            "Teaching probabilistic public-key encryption and semantic security",
            "A building block for homomorphic encryption over bits",
            "Illustrating the quadratic residuosity assumption",
        ],
        references: [
            "Goldwasser and Micali, Probabilistic Encryption, 1982",
            "Katz and Lindell, Introduction to Modern Cryptography, Chapter 11, 2015",
        ],
        workedExample:
            "With p = 11, q = 23, n = 253, and non-residue x = 7, encrypting bit 1 with r = 3 gives c = 7 * 9 mod 253 = 63. Since 63 is a non-residue modulo 11, the receiver decodes 1. Encrypting bit 0 with r = 4 gives c = 16, a residue modulo 11, which decodes to 0.",
    },
    id: "goldwasser-micali",
    name: "Goldwasser-Micali (toy parameters)",
    category: "cryptography-security",
    complexity: { time: "O(bits * log n)", space: "O(bits)" },
    defaultInput: { p: 11, q: 23, bits: [1, 0, 1, 1, 0, 0, 1], seed: 29 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose primes p and q and set the modulus n to their product",
        "find x with positive Jacobi symbol that is a non-residue modulo both primes",
        "for each plaintext bit draw a random r coprime to n",
        "set the ciphertext to x to the bit times r squared modulo n",
        "test whether the ciphertext is a quadratic residue modulo p",
        "decode zero for a residue and one for a non-residue",
        "done: report the recovered bit string",
    ],
};

export default module;
