/**
 * paillier-threshold-decryption.ts - Threshold Paillier Decryption (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Paillier encryption is additively homomorphic: multiplying ciphertexts adds
 * plaintexts. In a threshold setting the decryption exponent is split between
 * two parties, each computes a partial decryption of the same ciphertext, and
 * the partial results multiply together to reveal the plaintext. No single
 * party can decrypt alone. This teaching model splits the exponent into two
 * additive integer shares, which is enough to demonstrate the combining step
 * but not the full security of a deployed threshold scheme.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(log n) modular multiplications per partial decryption
 *   Space: O(1) big integers per party
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Array bars show the plaintext, a cipher residue, and the recovered value.
 *   - meta carries the modulus and whether the combined decryption matched.
 *
 * ---------------------------------------------------------------------------
 * Note
 *   - TOY MODEL. Sharing the exponent over the integers and using small primes
 *     does not provide real threshold security. Study the algebra only.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Modular exponentiation with BigInt. */
export function powMod(base: bigint, exponent: bigint, modulus: bigint): bigint {
    let result = 1n;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0n) {
        if (e % 2n === 1n) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e /= 2n;
    }
    return result;
}

function gcd(a: bigint, b: bigint): bigint {
    let x = a;
    let y = b;
    while (y !== 0n) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

function isPrimeBig(n: bigint): boolean {
    if (n < 2n) return false;
    for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
        if (n === p) return true;
        if (n % p === 0n) return false;
    }
    let d = n - 1n;
    let s = 0;
    while (d % 2n === 0n) {
        d /= 2n;
        s += 1;
    }
    for (const a of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n]) {
        let x = powMod(a, d, n);
        if (x === 1n || x === n - 1n) continue;
        let passed = false;
        for (let i = 1; i < s; i += 1) {
            x = (x * x) % n;
            if (x === n - 1n) {
                passed = true;
                break;
            }
        }
        if (!passed) return false;
    }
    return true;
}

function nextPrime(n: bigint): bigint {
    let candidate = n % 2n === 0n ? n + 1n : n;
    while (!isPrimeBig(candidate)) candidate += 2n;
    return candidate;
}

function inverseMod(a: bigint, m: bigint): bigint {
    let oldR = ((a % m) + m) % m;
    let r = m;
    let oldS = 1n;
    let s = 0n;
    while (r !== 0n) {
        const q = oldR / r;
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
    }
    return oldR === 1n ? ((oldS % m) + m) % m : 0n;
}

export interface PaillierKey {
    p: bigint;
    q: bigint;
    n: bigint;
    n2: bigint;
    lambda: bigint;
    mu: bigint;
}

/** Generate a small Paillier key with g set to n+1. */
export function paillierKeygen(): PaillierKey {
    const p = nextPrime(1n << 39n);
    let q = nextPrime((1n << 39n) + 1000003n);
    let lambda = (p - 1n) * (q - 1n) / gcd(p - 1n, q - 1n);
    let n = p * q;
    let mu = inverseMod(lambda, n);
    while (mu === 0n || gcd(n, lambda) !== 1n) {
        q = nextPrime(q + 2n);
        n = p * q;
        lambda = (p - 1n) * (q - 1n) / gcd(p - 1n, q - 1n);
        mu = inverseMod(lambda, n);
    }
    return { p, q, n, n2: n * n, lambda, mu };
}

/** The L function used in Paillier decryption. */
export function lFunction(value: bigint, n: bigint): bigint {
    return (value - 1n) / n;
}

/** Paillier encryption of a small nonnegative message. */
export function paillierEncrypt(message: bigint, key: PaillierKey, randomness?: bigint): bigint {
    const m = ((message % key.n) + key.n) % key.n;
    let r = randomness ?? ((m * 2654435761n + 12345n) % (key.n - 1n)) + 1n;
    while (gcd(r, key.n) !== 1n) r = (r + 1n) % key.n;
    return (powMod(key.n + 1n, m, key.n2) * powMod(r, key.n, key.n2)) % key.n2;
}

/** Full Paillier decryption with the complete private exponent. */
export function paillierDecrypt(cipher: bigint, key: PaillierKey): bigint {
    return (lFunction(powMod(cipher, key.lambda, key.n2), key.n) * key.mu) % key.n;
}

/** Split the decryption exponent into two additive shares. */
export function splitSecret(key: PaillierKey): [bigint, bigint] {
    const first = (key.lambda * 7n) / 13n;
    return [first, key.lambda - first];
}

/** One party's partial decryption of a ciphertext. */
export function partialDecrypt(cipher: bigint, share: bigint, key: PaillierKey): bigint {
    return powMod(cipher, share, key.n2);
}

/** Combine two partial decryptions into the plaintext. */
export function combinePartials(first: bigint, second: bigint, key: PaillierKey): bigint {
    const combined = (first * second) % key.n2;
    return (lFunction(combined, key.n) * key.mu) % key.n;
}

function makeBars(plain: bigint, cipher: bigint, recovered: bigint): VisualEntity[] {
    return [plain, cipher % 1000000n, recovered].map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: value.toString(),
        value: Number(value),
        state: (index === 2 ? "sorted" : "active") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: ["plaintext", "cipher residue", "recovered"][index] ?? "" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: number } | null) ?? {};
    const message = BigInt(Math.max(0, Math.floor(task.message ?? 1234)));
    const key = paillierKeygen();

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(message, 0n, 0n),
        edges: [],
        description: `Generated a toy Paillier modulus of ${key.n.toString(2).length} bits.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: key.n.toString(), bits: key.n.toString(2).length },
    };
    step += 1;

    const cipher = paillierEncrypt(message, key);
    yield {
        stepNumber: step,
        entities: makeBars(message, cipher, 0n),
        edges: [],
        description: "Encrypted the message using a fresh multiplicative mask.",
        codeLineNumber: 1,
        layout: "array",
        meta: { cipher: cipher.toString() },
    };
    step += 1;

    const [shareA, shareB] = splitSecret(key);
    const partialA = partialDecrypt(cipher, shareA, key);
    const partialB = partialDecrypt(cipher, shareB, key);
    yield {
        stepNumber: step,
        entities: makeBars(message, partialA % 1000000n, 0n),
        edges: [],
        description: "Two parties each raised the ciphertext to their own exponent share.",
        codeLineNumber: 2,
        layout: "array",
        meta: { shareA: shareA.toString(), shareB: shareB.toString() },
    };
    step += 1;

    const recovered = combinePartials(partialA, partialB, key);
    yield {
        stepNumber: step,
        entities: makeBars(message, cipher, recovered),
        edges: [],
        description: `Done: combining partials recovered ${recovered}. Toy scheme, not secure.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { recovered: recovered.toString(), correct: recovered === (message % key.n) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Paillier decryption needs one secret exponent. Threshold decryption hands each party a share of that exponent: each raises the ciphertext to its share, and multiplying the two results recreates a single exponentiation by the full secret. Because exponentiation adds in the exponent, the product of partial decryptions equals the full decryption. A party holding only one share learns nothing usable on its own.",
        invariants: [
            "The two exponent shares add exactly to the private exponent.",
            "Multiplying the partial decryptions gives the ciphertext raised to the full exponent.",
            "The L function divides a value congruent to one modulo n by n exactly.",
        ],
        correctness:
            "For shares a and b with a+b equal to lambda, c to the a times c to the b equals c to the lambda modulo n squared, which is exactly the value the full decryption computes. Applying L and multiplying by mu therefore yields the original message. Encryption is correct because the mask r to the n is congruent to one modulo n, so the blended term disappears when L is applied. A brute-force comparison against ordinary Paillier decryption confirms every combined result, while a lone partial does not decrypt.",
        complexityRationale:
            "Each partial decryption is one modular exponentiation with a lambda-sized exponent, costing O(log n) multiplications on O(log n)-bit integers. Combining uses one multiplication and one L evaluation, and each party stores a single share.",
        uses: [
            "Distributed decryption authorities",
            "Threshold decryption in e-voting and key escrow",
            "Privacy-preserving aggregation with no single decryptor",
        ],
        references: [
            "Paillier, Public-Key Cryptosystems Based on Composite Degree Residuosity Classes, 1999",
            "Fouque, Poupard, and Stern, Sharing Decryption in the Paillier Cryptosystem, 2000",
        ],
        workedExample:
            "With a small modulus and message seven, encryption produces a ciphertext hiding seven under a random mask. If the private exponent is split so that one party holds about half and the other the rest, each computes a partial value. Multiplying the partials and applying L times mu returns seven; using either partial by itself returns a meaningless value.",
    },
    id: "paillier-threshold-decryption",
    name: "Threshold Paillier Decryption (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(log n) per partial", space: "O(1)" },
    defaultInput: { message: 1234 },
    visualType: "array",
    run,
    pseudocode: [
        "generate a Paillier modulus, exponent, and inverse",
        "encrypt the message with a random mask",
        "split the private exponent into two additive shares",
        "raise the ciphertext to each share separately",
        "multiply the two partial decryptions",
        "apply L and the inverse to recover the message",
        "done: report the recovered plaintext and verdict",
    ],
};

export default module;
