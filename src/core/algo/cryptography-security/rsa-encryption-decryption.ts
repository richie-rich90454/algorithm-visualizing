/**
 * rsa-encryption-decryption.ts - Toy RSA Encryption and Decryption
 *
 * Builds a small RSA keypair from two primes and demonstrates the exact
 * textbook modular-exponentiation steps. Parameters are tiny so every power
 * can be checked by hand; this is not a production-secure implementation.
 *
 * Time:  O(log e + log d) with square-and-multiply
 * Space: O(1)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RSAInput {
    p?: number;
    q?: number;
    e?: number;
    m?: number;
}

/** Square-and-multiply modular exponentiation. */
function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = ((base % modulus) + modulus) % modulus;
    let k = exponent;
    while (k > 0) {
        if (k % 2 === 1) {
            result = (result * b) % modulus;
        }
        b = (b * b) % modulus;
        k = Math.trunc(k / 2);
    }
    return result;
}

/** Euclidean greatest common divisor. */
function gcd(a: number, b: number): number {
    let x = a;
    let y = b;
    while (y !== 0) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

/** Brute-force modular inverse by scanning candidates. */
function modInverse(a: number, modulus: number): number {
    const v = ((a % modulus) + modulus) % modulus;
    for (let x = 1; x < modulus; x += 1) {
        if ((v * x) % modulus === 1) {
            return x;
        }
    }
    return 0;
}

function makeCells(rows: Array<[string, number]>, highlight: number): VisualEntity[] {
    return rows.map(([label, value], col) => ({
        id: `cell-0-${col}`,
        type: "cell" as const,
        label: `${label}=${value}`,
        value,
        state: (col === highlight ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RSAInput | null) ?? {};
    const p = typeof task.p === "number" ? Math.trunc(task.p) : 11;
    const q = typeof task.q === "number" ? Math.trunc(task.q) : 13;
    const e = typeof task.e === "number" ? Math.trunc(task.e) : 7;
    const n = p * q;
    const phi = (p - 1) * (q - 1);
    const m = typeof task.m === "number" ? ((Math.trunc(task.m) % n) + n) % n : 42;
    const d = modInverse(e, phi);
    const validKey = d > 0 && gcd(e, phi) === 1;
    const c = modPow(m, e, n);
    const recovered = modPow(c, d, n);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(
            [
                ["p", p],
                ["q", q],
                ["n", n],
                ["phi", phi],
            ],
            -1,
        ),
        edges: [],
        description: `Toy RSA from p=${p}, q=${q}: modulus n=${n}, totient phi=${phi}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: 4, p, q, n, phi, e, d, m, c, recovered, validKey },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(
            [
                ["e", e],
                ["phi", phi],
                ["d", d],
            ],
            2,
        ),
        edges: [],
        description: validKey
            ? `Chosen e=${e} is coprime to phi; its inverse is d=${d} because e*d = ${e * d} = ${Math.trunc((e * d) / phi)}*phi + 1.`
            : `Chosen e=${e} is not invertible modulo phi=${phi}; no valid private key.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: 1, cols: 3, e, d, phi, validKey },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(
            [
                ["m", m],
                ["e", e],
                ["n", n],
                ["c", c],
            ],
            3,
        ),
        edges: [],
        description: `Encrypt: c = m^e mod n = ${m}^${e} mod ${n} = ${c}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: 1, cols: 4, m, e, n, c },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(
            [
                ["c", c],
                ["d", d],
                ["n", n],
                ["m", recovered],
            ],
            3,
        ),
        edges: [],
        description: `Decrypt: m = c^d mod n = ${c}^${d} mod ${n} = ${recovered}${recovered === m ? " (matches)" : " (MISMATCH)"}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: 1, cols: 4, p, q, n, phi, e, c, d, m: recovered, original: m, validKey },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "RSA uses a public exponent to encrypt and a private exponent to decrypt. The two exponents are inverses modulo Euler's totient of the modulus, so raising a message to the public power and then to the private power brings it back to the original message by Euler's theorem. The toy primes here keep the arithmetic small enough to follow by hand.",
        invariants: [
            "The modulus is n = p*q and the totient is phi = (p-1)(q-1).",
            "The private exponent d satisfies e*d congruent to one modulo phi.",
            "Decryption computes c^d mod n and must return the original m.",
        ],
        correctness:
            "For a message m coprime to n, Euler's theorem gives m^phi congruent to one. Since e*d = 1 + k*phi, we have (m^e)^d = m^(1+k*phi) = m*(m^phi)^k congruent to m modulo n. The toy implementation computes these powers with square-and-multiply, which is exact modular arithmetic, and the test checks every residue.",
        complexityRationale:
            "Square-and-multiply uses O(log exponent) modular multiplications for both encryption and decryption, and all values are scalars, so space is O(1).",
        uses: [
            "Public-key encryption and key transport",
            "Digital signatures when combined with a hash and padding",
            "A teaching model for modular arithmetic in cryptography",
        ],
        references: [
            "Rivest, Shamir and Adleman, A Method for Obtaining Digital Signatures, 1978",
            "Menezes et al., Handbook of Applied Cryptography, Chapter 8",
        ],
        workedExample:
            "With p=11 and q=13 we get n=143 and phi=120. For e=7 the inverse is d=103 because 7*103=721=6*120+1. Encrypting m=42 gives c=42^7 mod 143=2, and decrypting gives 2^103 mod 143=42, the original message.",
    },
    id: "rsa-encryption-decryption",
    name: "RSA Encryption and Decryption (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(log e + log d)", space: "O(1)" },
    defaultInput: { p: 11, q: 13, e: 7, m: 42 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose distinct primes p and q",
        "compute modulus n = p times q and totient phi = (p-1)(q-1)",
        "choose public exponent e coprime to phi",
        "compute private exponent d as the inverse of e modulo phi",
        "encrypt with c = m to the e modulo n",
        "decrypt with m = c to the d modulo n",
        "done: verify that the recovered message equals the original",
    ],
};

export default module;
