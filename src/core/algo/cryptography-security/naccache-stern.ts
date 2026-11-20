/**
 * naccache-stern.ts - Naccache-Stern Public-Key Cryptosystem (Toy Field)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Naccache-Stern encryption hides a small message as g to the m times a random
 * sigma-th power modulo a large prime, where sigma is the product of several
 * small primes dividing p minus one. The private small primes let the receiver
 * recover m modulo each of them by tiny discrete logarithms and combine the
 * residues with the Chinese remainder theorem. The scheme is homomorphic. With
 * p=211 and small primes 2,3,5,7 this is a teaching toy with no security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * log p + sigma) for k small primes
 *   Space: O(1) for the scalar values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the public values, ciphertext, residues and recovered message.
 *   - The active computation phase is highlighted.
 *   - meta carries the message, ciphertext and homomorphic check.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const SMALL_PRIMES = [2, 3, 5, 7];
const SIGMA = SMALL_PRIMES.reduce((a, b) => a * b, 1);
// p = 2311 is prime and p-1 = 210 * 11; sigma = 210 divides p-1 and the
// cofactor 11 is coprime to every small prime, so the residues are distinct.
const PRIME = 2311;

/** Modular exponentiation for the small toy modulus. */
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

/** Find a generator of the subgroup of order sigma modulo PRIME. */
export function findGenerator(): number {
    for (let g = 2; g < PRIME; g += 1) {
        if (modPow(g, SIGMA, PRIME) !== 1) continue;
        let ok = true;
        for (const q of SMALL_PRIMES) {
            if (modPow(g, SIGMA / q, PRIME) === 1) {
                ok = false;
                break;
            }
        }
        if (ok) return g;
    }
    throw new Error("no generator found");
}

export function encryptValue(plain: number, nonce: number, g: number): number {
    const x = (nonce * 29 + plain * 13 + 7) % (PRIME - 1) + 1;
    return (modPow(g, plain, PRIME) * modPow(x, SIGMA, PRIME)) % PRIME;
}

export function decryptValue(cipher: number, g: number): number {
    let message = 0;
    let modulus = 1;
    for (const q of SMALL_PRIMES) {
        const ci = modPow(cipher, (PRIME - 1) / q, PRIME);
        const gi = modPow(g, (PRIME - 1) / q, PRIME);
        let residue = 0;
        for (let candidate = 0; candidate < q; candidate += 1) {
            if (modPow(gi, candidate, PRIME) === ci) {
                residue = candidate;
                break;
            }
        }
        const target = (((residue - message) % q) + q) % q;
        let t = 0;
        for (; t < q; t += 1) {
            if ((modulus * t) % q === target) break;
        }
        message += modulus * t;
        modulus *= q;
    }
    return message % SIGMA;
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
    const plain = Math.max(0, Math.min(SIGMA - 1, Math.floor(Number(task.plaintext ?? 83)) || 0));
    const nonce = Math.max(0, Math.floor(Number(task.nonce ?? 0)) || 0);
    const g = findGenerator();
    const cipher = encryptValue(plain, nonce, g);
    const recovered = decryptValue(cipher, g);

    const residues = SMALL_PRIMES.map((q) => decryptValue(cipher, g) % q);
    const other = encryptValue((plain + 17) % SIGMA, nonce + 3, g);
    const product = (cipher * other) % PRIME;
    const homo = decryptValue(product, g);
    const homoExpected = (plain + ((plain + 17) % SIGMA)) % SIGMA;

    let step = 0;
    yield {
        stepNumber: step,
        entities: stateBars([PRIME, SIGMA, g, ...SMALL_PRIMES], 0, false),
        edges: [],
        description: `Naccache-Stern toy: p=${PRIME}, sigma=${SIGMA}, generator ${g}, small primes ${SMALL_PRIMES.join(",")}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { p: PRIME, sigma: SIGMA, g, plaintext: plain, ciphertext: 0, decrypted: 0, homomorphic: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: stateBars([plain, nonce, modPow(g, plain, PRIME), cipher], 3, false),
        edges: [],
        description: `Encrypt m=${plain}: c = g^m times a random sigma-th power modulo p = ${cipher}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { p: PRIME, sigma: SIGMA, g, plaintext: plain, ciphertext: cipher, decrypted: 0, homomorphic: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: stateBars(residues, 3, false),
        edges: [],
        description: `Small-subgroup logarithms give residues ${residues.join(",")} modulo ${SMALL_PRIMES.join(",")}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { p: PRIME, sigma: SIGMA, g, plaintext: plain, ciphertext: cipher, decrypted: recovered, homomorphic: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: stateBars([plain, recovered, product, homo, homoExpected], 4, true),
        edges: [],
        description: `Chinese remaindering recovered ${recovered}; homomorphic check gives ${homo}, expected ${homoExpected}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            p: PRIME,
            sigma: SIGMA,
            g,
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
            "Choose a prime where the product of a few small primes divides p minus one, then hide the message in the exponent of a generator of that small subgroup. A random sigma-th power masks it. The receiver solves tiny discrete logarithms in each small subgroup and stitches the residues back together with the Chinese remainder theorem.",
        invariants: [
            "Plaintexts lie in the range zero through sigma minus one.",
            "The generator has order exactly sigma modulo p.",
            "Multiplying ciphertexts decrypts to the sum of the plaintexts modulo sigma.",
        ],
        correctness:
            "Raising the ciphertext to p minus one over q lands in the subgroup of order q, where the discrete logarithm is m modulo q because the random sigma-th power vanishes. Doing this for every small prime yields all residues, and the Chinese remainder theorem reconstructs m uniquely modulo sigma. Homomorphism follows from exponent addition under multiplication.",
        complexityRationale:
            "Encryption uses two modular exponentiations with exponents below p or sigma, each O(log p) multiplications. Decryption solves at most seven candidates per small prime, so time is O(k log p + sigma) and space is constant.",
        uses: [
            "A teaching example of subgroup discrete logarithms",
            "An introduction to homomorphic public-key encryption",
            "A stepping stone to Damgard-Jurik and Paillier systems",
        ],
        references: [
            "Naccache and Stern, A New Public Key Cryptosystem, 1998",
            "Cohen, A Course in Computational Algebraic Number Theory, Chapter 3",
        ],
        workedExample:
            "With p=2311 and sigma=210 from the primes 2,3,5,7, a generator g of order 210 encrypts m=83 as g^83 times x^210 modulo 2311. The receiver computes residues modulo 2, 3, 5 and 7 and combines them to recover 83. Multiplying by an encryption of 11 decrypts to 94 modulo 210.",
    },
    id: "naccache-stern",
    name: "Naccache-Stern Encryption (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(k log p + sigma)", space: "O(1)" },
    defaultInput: { plaintext: 83, nonce: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "choose small primes whose product sigma divides p minus one",
        "pick a generator g whose order modulo p is exactly sigma",
        "set the ciphertext to g to the m times a random sigma-th power modulo p",
        "for each small prime q, raise the ciphertext to sigma over q",
        "solve the tiny subgroup logarithm to get m modulo q",
        "combine all residues with the Chinese remainder theorem",
        "multiply two ciphertexts to verify the additive homomorphism",
        "report the recovered message and the homomorphic check",
    ],
};

export default module;
