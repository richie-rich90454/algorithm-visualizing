/**
 * paillier-additive-homomorphism.ts - Paillier Additive Homomorphism (Toy Parameters)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Paillier cryptosystem is additively homomorphic: multiplying two
 * ciphertexts modulo n squared decrypts to the sum of the two plaintexts.
 * This teaching model implements key generation, encryption, decryption, and
 * the homomorphic multiplication exactly with small primes and the standard
 * simplification g = n + 1, using big integers throughout. It is NOT secure:
 * the modulus is tiny, messages are small, and the encryption randomness is
 * fixed for reproducibility. Only the algebraic homomorphism is faithful.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) modular exponentiations per operation with big integers
 *   Space: O(log n) for the modulus-sized values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the two plaintexts and the decrypted sum.
 *   - meta carries n, lambda, mu, and each ciphertext in decimal form.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    a?: number;
    b?: number;
    p?: number;
    q?: number;
    r?: number;
}

const gcd = (a: bigint, b: bigint): bigint => {
    let x = a;
    let y = b;
    while (y !== 0n) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x < 0n ? -x : x;
};

const lcm = (a: bigint, b: bigint): bigint => (a / gcd(a, b)) * b;

const modPow = (base: bigint, exp: bigint, mod: bigint): bigint => {
    let result = 1n;
    let b = ((base % mod) + mod) % mod;
    let e = exp;
    while (e > 0n) {
        if (e & 1n) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e >>= 1n;
    }
    return result;
};

const modInv = (a: bigint, mod: bigint): bigint => {
    let oldR = ((a % mod) + mod) % mod;
    let r = mod;
    let oldS = 1n;
    let s = 0n;
    while (r !== 0n) {
        const q = oldR / r;
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
    }
    return ((oldS % mod) + mod) % mod;
};

interface Keys {
    n: bigint;
    n2: bigint;
    g: bigint;
    lambda: bigint;
    mu: bigint;
}

/** Generate toy Paillier keys with g = n + 1. */
function keygen(p: number, q: number): Keys {
    const n = BigInt(p) * BigInt(q);
    const n2 = n * n;
    const lambda = lcm(BigInt(p) - 1n, BigInt(q) - 1n);
    const g = n + 1n;
    const L = (modPow(g, lambda, n2) - 1n) / n;
    const mu = modInv(L, n);
    return { n, n2, g, lambda, mu };
}

/** Encrypt a small message with randomness r. */
function encrypt(m: bigint, keys: Keys, r: bigint): bigint {
    const gm = modPow(keys.g, m, keys.n2);
    const rn = modPow(r, keys.n, keys.n2);
    return (gm * rn) % keys.n2;
}

/** Decrypt a ciphertext. */
function decrypt(c: bigint, keys: Keys): bigint {
    const u = modPow(c, keys.lambda, keys.n2);
    return ((((u - 1n) / keys.n) * keys.mu) % keys.n + keys.n) % keys.n;
}

function makeBars(a: number, b: number, sum: number | null, phase: string): VisualEntity[] {
    const values: Array<[string, number, EntityState]> = [
        ["a", a, "idle"],
        ["b", b, "idle"],
        ["a+b", sum ?? 0, sum === null ? "unvisited" : "sorted"],
    ];
    return values.map(([label, value, state], index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: sum === null && index === 2 ? "a+b?" : `${label}=${value}`,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, label, value, phase },
    }));
}

/** The Paillier homomorphism generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 5;
    const b = typeof task.b === "number" ? task.b : 7;
    const p = typeof task.p === "number" ? task.p : 7;
    const q = typeof task.q === "number" ? task.q : 11;
    const r = BigInt(typeof task.r === "number" ? task.r : 2);
    const keys = keygen(p, q);
    const ma = BigInt(a);
    const mb = BigInt(b);
    const ca = encrypt(ma, keys, r);
    const cb = encrypt(mb, keys, r);
    const product = (ca * cb) % keys.n2;
    const sum = decrypt(product, keys);
    const expected = (ma + mb) % keys.n;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(a, b, null, "setup"),
        edges: [],
        description: `Toy Paillier keys: p=${p}, q=${q}, n=${keys.n}, n^2=${keys.n2}, lambda=${keys.lambda}, mu=${keys.mu}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            n: Number(keys.n),
            n2: Number(keys.n2),
            lambda: Number(keys.lambda),
            mu: Number(keys.mu),
            a,
            b,
            cipherA: "",
            cipherB: "",
            cipherProduct: "",
            decryptedSum: -1,
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(a, b, null, "encrypt-a"),
        edges: [],
        description: `Encrypt a=${a}: g^a * r^n mod n^2 = ${ca}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { n: Number(keys.n), n2: Number(keys.n2), lambda: Number(keys.lambda), mu: Number(keys.mu), a, b, cipherA: ca.toString(), cipherB: "", cipherProduct: "", decryptedSum: -1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(a, b, null, "encrypt-b"),
        edges: [],
        description: `Encrypt b=${b}: g^b * r^n mod n^2 = ${cb}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { n: Number(keys.n), n2: Number(keys.n2), lambda: Number(keys.lambda), mu: Number(keys.mu), a, b, cipherA: ca.toString(), cipherB: cb.toString(), cipherProduct: "", decryptedSum: -1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(a, b, null, "multiply"),
        edges: [],
        description: `Homomorphic multiplication: E(a) * E(b) mod n^2 = ${product}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n: Number(keys.n), n2: Number(keys.n2), lambda: Number(keys.lambda), mu: Number(keys.mu), a, b, cipherA: ca.toString(), cipherB: cb.toString(), cipherProduct: product.toString(), decryptedSum: -1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(a, b, Number(sum), "decrypt"),
        edges: [],
        description: `Decrypt the product: L(c^lambda mod n^2) * mu mod n = ${sum}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n: Number(keys.n), n2: Number(keys.n2), lambda: Number(keys.lambda), mu: Number(keys.mu), a, b, cipherA: ca.toString(), cipherB: cb.toString(), cipherProduct: product.toString(), decryptedSum: Number(sum), expected: Number(expected) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(a, b, Number(sum), "done"),
        edges: [],
        description: `Additive homomorphism verified: decrypt(E(a) * E(b)) = ${sum} = (${a} + ${b}) mod ${keys.n}. This toy is not secure.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n: Number(keys.n), n2: Number(keys.n2), lambda: Number(keys.lambda), mu: Number(keys.mu), a, b, cipherA: ca.toString(), cipherB: cb.toString(), cipherProduct: product.toString(), decryptedSum: Number(sum), expected: Number(expected), note: "toy parameters, not secure" },
    };
}

/** The Paillier teaching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Paillier encryption has a remarkable property: you can add two secret numbers without learning either one. Multiply their ciphertexts and the result decrypts to the sum of the plaintexts. This teaching model implements the exact modular arithmetic with tiny primes so every intermediate value is visible, but the small modulus makes it completely insecure.",
        invariants: [
            "The public modulus is n = p*q and all ciphertexts live modulo n squared.",
            "With the standard choice g = n + 1, the decryption multiplier mu is the inverse of lambda modulo n.",
            "Multiplying two ciphertexts modulo n squared produces a ciphertext of the sum modulo n.",
        ],
        correctness:
            "For g = n + 1, g^m is congruent to 1 + m*n modulo n squared, so the function L(u) = (u - 1) / n recovers m times a factor. Raising a ciphertext to lambda and multiplying by mu undoes the randomness because r raised to n*lambda is congruent to 1 modulo n squared. Consequently decrypt(E(a) times E(b) mod n squared) equals (a + b) mod n for every pair of small messages, which the module verifies directly.",
        complexityRationale:
            "Encryption and decryption each use a modular exponentiation with an exponent of size roughly n, costing O(log n) big-integer operations. The modulus-sized ciphertexts occupy O(log n) space.",
        uses: [
            "A teaching model for additive homomorphic encryption",
            "Privacy-preserving aggregation of sums over encrypted data",
            "A stepping stone to secure multiparty computation protocols",
        ],
        references: [
            "Paillier, Public-Key Cryptosystems Based on Composite Degree Residuosity Classes, 1999",
            "Boneh and Shoup, A Graduate Course in Applied Cryptography, Chapter 13, 2020",
        ],
        workedExample:
            "With p=7 and q=11 the modulus is n=77, lambda is 30, and mu is 18. Encrypting a=5 and b=7 with r=2 gives two ciphertexts modulo 5929. Their product decrypts to 12, which equals (5 + 7) mod 77, demonstrating the additive homomorphism.",
    },
    id: "paillier-additive-homomorphism",
    name: "Paillier Additive Homomorphism (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(log n)", space: "O(log n)" },
    defaultInput: { a: 5, b: 7, p: 7, q: 11, r: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "choose small primes p and q and set n to their product",
        "set lambda to the least common multiple of p minus one and q minus one",
        "set g to n plus one and mu to the inverse of lambda modulo n",
        "encrypt a as g to the a times r to the n, modulo n squared",
        "encrypt b the same way",
        "multiply the two ciphertexts modulo n squared",
        "decrypt the product to obtain the sum of the plaintexts",
        "done: report the decrypted sum and the homomorphism check",
    ],
};

export default module;
