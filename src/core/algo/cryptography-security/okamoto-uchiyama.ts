/**
 * okamoto-uchiyama.ts - Okamoto-Uchiyama Public-Key Cryptosystem (Toy Field)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Okamoto-Uchiyama encryption works over the group modulo p squared times q.
 * A plaintext m below p is hidden as g to the m times h to a random r, where
 * h is g to the p. The private prime p lets the receiver strip the random
 * factor with a logarithm in the small subgroup modulo p squared. The scheme
 * is additively homomorphic. This module uses tiny primes, so it is a teaching
 * toy and offers no cryptographic security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) modular multiplications per exponentiation
 *   Space: O(1) for the scalar values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the public values, then the ciphertext, then the recovered m.
 *   - The active computation step is highlighted.
 *   - meta carries n, g, h, ciphertext, plaintext and the homomorphic check.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const PRIME_P = 101;
const PRIME_Q = 103;
const MODULUS = PRIME_P * PRIME_P * PRIME_Q;
const P_SQUARED = PRIME_P * PRIME_P;

/** Modular exponentiation by repeated squaring (safe: values stay below 2^53). */
export function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

function extendedGcd(a: number, b: number): { g: number; x: number; y: number } {
    if (b === 0) return { g: a, x: 1, y: 0 };
    const r = extendedGcd(b, a % b);
    return { g: r.g, x: r.y, y: r.x - Math.floor(a / b) * r.y };
}

function modInverse(value: number, modulus: number): number {
    const r = extendedGcd(((value % modulus) + modulus) % modulus, modulus);
    return ((r.x % modulus) + modulus) % modulus;
}

/** Deterministically pick a public generator whose order is divisible by p. */
export function findGenerator(): { g: number; h: number } {
    for (let g = 2; g < 1000; g += 1) {
        const gp = modPow(g, PRIME_P - 1, P_SQUARED);
        const a = (gp - 1) / PRIME_P;
        if (!Number.isInteger(a) || a === 0 || modInverse(a, PRIME_P) === 0) continue;
        if (modPow(g, PRIME_P - 1, P_SQUARED) !== 1) {
            return { g, h: modPow(g, PRIME_P, MODULUS) };
        }
    }
    throw new Error("no generator found");
}

export function encryptValue(plain: number, r: number, g: number, h: number): number {
    const gm = modPow(g, plain, MODULUS);
    const hr = modPow(h, r, MODULUS);
    return (gm * hr) % MODULUS;
}

export function decryptValue(cipher: number, g: number): number {
    const a = (modPow(cipher, PRIME_P - 1, P_SQUARED) - 1) / PRIME_P;
    const b = (modPow(g, PRIME_P - 1, P_SQUARED) - 1) / PRIME_P;
    return Math.round((a * modInverse(b, PRIME_P)) % PRIME_P);
}

function stateBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `value-${index}`,
        type: "bar" as const,
        label: `v${index}=${value}`,
        value,
        state: (done ? "sorted" : index === active ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { plaintext?: number; nonce?: number } | null) ?? {};
    const plain = Math.max(0, Math.min(PRIME_P - 1, Math.floor(Number(task.plaintext ?? 42)) || 0));
    const nonce = Math.max(0, Math.floor(Number(task.nonce ?? 0)) || 0);
    const r = (nonce * 31 + plain * 17 + 3) % 97 + 1;

    const { g, h } = findGenerator();
    const cipher = encryptValue(plain, r, g, h);
    const recovered = decryptValue(cipher, g);

    const p2 = (plain * plain) % PRIME_P;
    const cipher2 = encryptValue(p2, r + 1, g, h);
    const both = (cipher * cipher2) % MODULUS;
    const homo = decryptValue(both, g);
    const homoExpected = (plain + p2) % PRIME_P;

    let step = 0;
    yield {
        stepNumber: step,
        entities: stateBars([PRIME_P, PRIME_Q, MODULUS, g, h], 0, false),
        edges: [],
        description: `Okamoto-Uchiyama toy setup: p=${PRIME_P}, q=${PRIME_Q}, n=${MODULUS}, g=${g}, h=${h}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { p: PRIME_P, q: PRIME_Q, n: MODULUS, g, h, plaintext: plain, ciphertext: 0, decrypted: 0, homomorphic: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: stateBars([plain, r, modPow(g, plain, MODULUS), modPow(h, r, MODULUS), cipher], 4, false),
        edges: [],
        description: `Encrypt m=${plain} with random r=${r}: c = g^m * h^r mod n = ${cipher}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { p: PRIME_P, q: PRIME_Q, n: MODULUS, g, h, plaintext: plain, ciphertext: cipher, decrypted: 0, homomorphic: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: stateBars([cipher, recovered, g, PRIME_P, plain], 1, false),
        edges: [],
        description: `Decrypt with private p: recovered m=${recovered}, expected ${plain}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { p: PRIME_P, q: PRIME_Q, n: MODULUS, g, h, plaintext: plain, ciphertext: cipher, decrypted: recovered, homomorphic: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: stateBars([plain, p2, both, homo, homoExpected], 4, true),
        edges: [],
        description: `Homomorphic check: decrypt of c(m) times c(m squared) is ${homo}, expected ${homoExpected}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            p: PRIME_P,
            q: PRIME_Q,
            n: MODULUS,
            g,
            h,
            plaintext: plain,
            ciphertext: cipher,
            decrypted: recovered,
            homomorphic: homo === homoExpected && recovered === plain,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Hide a small message in the exponent of a generator and multiply by a random factor h to the r so equal messages encrypt differently. The secret prime p reveals a short logarithm modulo p squared that strips the random part. Because exponents add when ciphertexts multiply, the scheme supports adding encrypted numbers.",
        invariants: [
            "Plaintexts are restricted to the range zero through p minus one.",
            "The public generator g has order divisible by p modulo p squared.",
            "Multiplying two ciphertexts and decrypting returns the sum of the plaintexts modulo p.",
        ],
        correctness:
            "Since h equals g to the p modulo n, the random factor h to the r contributes a multiple of p to the exponent and vanishes modulo p in the subgroup of order p. The ratio of the two discrete logarithms modulo p squared therefore equals m modulo p. Homomorphism follows because g to the m1 times g to the m2 equals g to the m1 plus m2.",
        complexityRationale:
            "Each encryption and decryption uses a constant number of modular exponentiations, each taking O(log n) multiplications by repeated squaring. All values are scalars, so space is constant.",
        uses: [
            "A teaching example of homomorphism modulo p squared",
            "A stepping stone to Paillier and Damgard-Jurik encryption",
            "Demonstrating random encryption of small integers",
        ],
        references: [
            "Okamoto and Uchiyama, A New Public-Key Cryptosystem as Secure as Factoring, 1998",
            "Cohen, A Course in Computational Algebraic Number Theory, Chapter 3",
        ],
        workedExample:
            "With p=101 and q=103 the modulus is 1050703. To encrypt m=42 with r=5, compute c = g^42 times h^5 modulo n. The receiver computes the ratio of logarithms modulo 10201 and obtains 42. Multiplying that ciphertext by an encryption of 7 and decrypting yields 49 modulo 101.",
    },
    id: "okamoto-uchiyama",
    name: "Okamoto-Uchiyama Encryption (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { plaintext: 42, nonce: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "choose primes p and q and set n to p squared times q",
        "pick a generator g whose order modulo p squared is divisible by p",
        "set h to g to the p modulo n",
        "choose a random exponent r and set c to g to the m times h to the r modulo n",
        "compute a from c to the p minus one modulo p squared",
        "compute b from g to the p minus one modulo p squared",
        "recover m as a times the inverse of b modulo p",
        "multiply two ciphertexts to verify the additive homomorphism",
    ],
};

export default module;
