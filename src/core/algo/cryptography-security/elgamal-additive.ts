/**
 * elgamal-additive.ts - Additive ElGamal Encryption (Toy Parameters)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Additive ElGamal encrypts a small nonnegative message m as the pair
 * (g to the r, g to the m times h to the r), where h is the public key. The
 * message sits in the exponent, so multiplying two ciphertexts multiplies the
 * g to the m terms and therefore adds the hidden messages. Decryption removes
 * the random mask with the private key and recovers m by a small discrete log.
 * The parameters here are tiny so the search is fast; this is a teaching model,
 * not a production cryptosystem.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log p) modular arithmetic plus O(p) decryption search
 *   Space: O(1) big integers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row is a named quantity: keys, messages, ciphertext parts, result.
 *   - Newly revealed rows are yellow; the final decrypted sum is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface AdditiveCiphertext {
    c1: bigint;
    c2: bigint;
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    let result = 1n;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0n) {
        if (e & 1n) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e >>= 1n;
    }
    return result;
}

function modInverse(value: bigint, modulus: bigint): bigint {
    let [oldR, r] = [((value % modulus) + modulus) % modulus, modulus];
    let [oldS, s] = [1n, 0n];
    while (r !== 0n) {
        const quotient = oldR / r;
        [oldR, r] = [r, oldR - quotient * r];
        [oldS, s] = [s, oldS - quotient * s];
    }
    return ((oldS % modulus) + modulus) % modulus;
}

/** Derive the public key h = g^a mod p from a private exponent a. */
export function additivePublicKey(p: bigint, g: bigint, a: bigint): bigint {
    return modPow(g, a, p);
}

/** Encrypt a small message m using random exponent r. */
export function additiveEncrypt(
    p: bigint,
    g: bigint,
    h: bigint,
    message: bigint,
    r: bigint,
): AdditiveCiphertext {
    return {
        c1: modPow(g, r, p),
        c2: (modPow(g, message, p) * modPow(h, r, p)) % p,
    };
}

/** Homomorphically combine two ciphertexts into an encryption of the sum. */
export function additiveMultiply(p: bigint, a: AdditiveCiphertext, b: AdditiveCiphertext): AdditiveCiphertext {
    return { c1: (a.c1 * b.c1) % p, c2: (a.c2 * b.c2) % p };
}

/** Decrypt by removing the mask and solving the small discrete log. */
export function additiveDecrypt(p: bigint, g: bigint, a: bigint, ciphertext: AdditiveCiphertext): bigint {
    const mask = modPow(ciphertext.c1, a, p);
    const gm = (ciphertext.c2 * modInverse(mask, p)) % p;
    let power = 1n % p;
    for (let message = 0n; message < p; message += 1n) {
        if (power === gm) return message;
        power = (power * g) % p;
    }
    return -1n;
}

const LABELS = [
    "prime p",
    "generator g",
    "private a",
    "public h = g^a",
    "message m1",
    "random r1",
    "c1 = g^r1",
    "c2 = g^m1 h^r1",
    "message m2",
    "random r2",
    "c1b = g^r2",
    "c2b = g^m2 h^r2",
    "combined c1",
    "combined c2",
    "decrypted sum",
];

function makeCells(values: string[], activeRow: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    LABELS.forEach((label, row) => {
        const present = values[row] !== undefined;
        for (let col = 0; col < 2; col += 1) {
            let state: EntityState = "idle";
            if (present) state = col === 0 ? "comparing" : "visited";
            if (col === 1 && row === LABELS.length - 1 && present) state = "sorted";
            if (row === activeRow && present) state = "active";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: col === 0 ? label : (values[row] ?? "-"),
                value: col === 0 ? label : (values[row] ?? "-"),
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, label, value: values[row] ?? "" },
            });
        }
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { p?: number; g?: number; a?: number; m1?: number; m2?: number; r1?: number; r2?: number } | null
    ) ?? {};
    const p = BigInt(typeof task.p === "number" ? task.p : 101);
    const g = BigInt(typeof task.g === "number" ? task.g : 2);
    const a = BigInt(typeof task.a === "number" ? task.a : 7);
    const m1 = BigInt(typeof task.m1 === "number" ? Math.max(0, task.m1) : 7);
    const m2 = BigInt(typeof task.m2 === "number" ? Math.max(0, task.m2) : 5);
    const r1 = BigInt(typeof task.r1 === "number" ? Math.max(1, task.r1) : 3);
    const r2 = BigInt(typeof task.r2 === "number" ? Math.max(1, task.r2) : 4);
    const h = additivePublicKey(p, g, a);
    const cipher1 = additiveEncrypt(p, g, h, m1, r1);
    const cipher2 = additiveEncrypt(p, g, h, m2, r2);
    const combined = additiveMultiply(p, cipher1, cipher2);
    const decrypted = additiveDecrypt(p, g, a, combined);

    const values: string[] = [];
    const set = (index: number, value: bigint | number): void => {
        values[index] = String(value);
    };
    const metaBase = {
        rows: LABELS.length,
        cols: 2,
        p: String(p),
        g: String(g),
        a: String(a),
        h: String(h),
        m1: String(m1),
        m2: String(m2),
        r1: String(r1),
        r2: String(r2),
        c1: String(cipher1.c1),
        c2: String(cipher1.c2),
        c1b: String(cipher2.c1),
        c2b: String(cipher2.c2),
        combinedC1: String(combined.c1),
        combinedC2: String(combined.c2),
        decrypted: String(decrypted),
        expectedSum: String(m1 + m2),
    };

    let step = 0;
    set(0, p); set(1, g); set(2, a); set(3, h);
    yield {
        stepNumber: step,
        entities: makeCells(values, 3),
        edges: [],
        description: `Generated keys over p=${p} with generator ${g}: private ${a}, public h=${h}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: metaBase,
    };
    step += 1;

    set(4, m1); set(5, r1); set(6, cipher1.c1); set(7, cipher1.c2);
    yield {
        stepNumber: step,
        entities: makeCells(values, 7),
        edges: [],
        description: `Encrypted m1=${m1} with r1=${r1} into (${cipher1.c1}, ${cipher1.c2}).`,
        codeLineNumber: 1,
        layout: "grid",
        meta: metaBase,
    };
    step += 1;

    set(8, m2); set(9, r2); set(10, cipher2.c1); set(11, cipher2.c2);
    yield {
        stepNumber: step,
        entities: makeCells(values, 11),
        edges: [],
        description: `Encrypted m2=${m2} with r2=${r2} into (${cipher2.c1}, ${cipher2.c2}).`,
        codeLineNumber: 1,
        layout: "grid",
        meta: metaBase,
    };
    step += 1;

    set(12, combined.c1); set(13, combined.c2);
    yield {
        stepNumber: step,
        entities: makeCells(values, 13),
        edges: [],
        description: `Multiplied the two ciphertexts componentwise to get (${combined.c1}, ${combined.c2}).`,
        codeLineNumber: 2,
        layout: "grid",
        meta: metaBase,
    };
    step += 1;

    set(14, decrypted);
    yield {
        stepNumber: step,
        entities: makeCells(values, 14),
        edges: [],
        description: `Decryption recovered ${decrypted}, which equals m1 + m2 = ${m1 + m2} without revealing either message alone.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: metaBase,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Hide the message in the exponent of a group element. The ciphertext carries one part that only the private key can unmask and one part that still contains g raised to the message. If you multiply two ciphertexts, the g-to-the-message parts multiply, and exponents add, so the combined ciphertext hides the sum of the two messages. No server combining them ever sees the plaintexts.",
        invariants: [
            "A ciphertext is always a pair of residues modulo p.",
            "The public key satisfies h = g to the a modulo p.",
            "Multiplying ciphertexts adds the hidden messages modulo the group order.",
        ],
        correctness:
            "For ciphertext (g to the r, g to the m times h to the r), raising the first part to the private a gives g to the ar, whose inverse cancels the h to the r factor in the second part because h = g to the a. What remains is g to the m. For two ciphertexts the product's second part is g to the (m1+m2) times h to the (r1+r2), so the same cancellation leaves g to the (m1+m2), and the small discrete log returns the sum. The prime and generator here are small for teaching, so the scheme is a model rather than a secure deployment.",
        complexityRationale:
            "Encryption and the homomorphic multiply use a constant number of modular exponentiations, each O(log p) multiplications. Decryption does one exponentiation and then a linear scan of at most p candidates for the small discrete log, giving O(p) worst-case time with tiny toy parameters.",
        uses: [
            "Teaching homomorphic encryption and exponent-based hiding",
            "Privacy-preserving tallying of small integer votes or counts",
            "Secure aggregation demos where an untrusted server adds ciphertexts",
        ],
        references: [
            "ElGamal, A Public Key Cryptosystem and a Signature Scheme Based on Discrete Logarithms, 1985",
            "Paillier, Public-Key Cryptosystems Based on Composite Degree Residuosity Classes, 1999",
        ],
        workedExample:
            "With p=101, g=2, and private a=7, the public key is h=27. Encrypting m1=7 with r1=3 gives (8, 80) and encrypting m2=5 with r2=4 gives another pair. Multiplying the pairs componentwise and decrypting with a=7 returns 12, the sum of 7 and 5, without decrypting either ciphertext separately.",
    },
    id: "elgamal-additive",
    name: "Additive ElGamal Encryption (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(p) decryption search", space: "O(1)" },
    defaultInput: { p: 101, g: 2, a: 7, m1: 7, m2: 5, r1: 3, r2: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a prime p, a generator g, and a private exponent a",
        "publish the public key h = g to the a modulo p",
        "for each small message m choose a fresh random r",
        "encrypt into the pair (g to the r, g to the m times h to the r)",
        "multiply two ciphertexts componentwise modulo p",
        "remove the random mask with the private key",
        "solve the small discrete log to recover the summed message",
        "done: report the ciphertexts and the decrypted sum",
    ],
};

export default module;
