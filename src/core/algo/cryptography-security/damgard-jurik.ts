/**
 * damgard-jurik.ts - Damgard-Jurik Homomorphic Encryption (Toy Parameters)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Damgard-Jurik generalizes Paillier encryption to a scale parameter s. With
 * modulus n and g = n + 1, a message m is encrypted as g to the m times r to
 * the n to the s, all modulo n to the s+1. The plaintext hides in the exponent,
 * so multiplying ciphertexts adds the messages. Setting s = 1 recovers ordinary
 * Paillier; larger s gives a bigger multiplicative payload at the cost of a
 * larger modulus. The parameters here are tiny, so this is a teaching model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log(modulus)) per modular exponentiation (big-integer cost)
 *   Space: O(1) big integers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row is a named quantity: primes, keys, messages, ciphertexts, sum.
 *   - Ciphertext rows are yellow; the final decrypted sum is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

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

export interface DjKey {
    p: bigint;
    q: bigint;
    n: bigint;
    phi: bigint;
    scale: number;
    modulus: bigint;
}

/** Build the toy public and private parameters. */
export function djKey(p: bigint, q: bigint, scale: number): DjKey {
    const n = p * q;
    return { p, q, n, phi: (p - 1n) * (q - 1n), scale, modulus: n ** BigInt(scale + 1) };
}

/** Encrypt a message m below n with randomness r coprime to n. */
export function djEncrypt(message: bigint, r: bigint, key: DjKey): bigint {
    const g = key.n + 1n;
    const gTerm = modPow(g, ((message % key.n) + key.n) % key.n, key.modulus);
    const rTerm = modPow(r, key.n ** BigInt(key.scale), key.modulus);
    return (gTerm * rTerm) % key.modulus;
}

/** Decrypt with the secret phi, removing the random mask and dividing by phi. */
export function djDecrypt(cipher: bigint, key: DjKey): bigint {
    const powered = modPow(cipher, key.phi, key.modulus);
    const L = (powered - 1n) / key.n;
    return (L * modInverse(key.phi % key.n, key.n)) % key.n;
}

/** Homomorphically add two ciphertexts modulo the working modulus. */
export function djMultiply(c1: bigint, c2: bigint, key: DjKey): bigint {
    return (c1 * c2) % key.modulus;
}

const LABELS = [
    "prime p",
    "prime q",
    "n = p times q",
    "phi(n)",
    "scale s",
    "modulus n^(s+1)",
    "message m1",
    "random r1",
    "cipher c1",
    "message m2",
    "random r2",
    "cipher c2",
    "c1 times c2",
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
        input as { p?: number; q?: number; scale?: number; m1?: number; m2?: number; r1?: number; r2?: number } | null
    ) ?? {};
    const p = BigInt(typeof task.p === "number" ? task.p : 11);
    const q = BigInt(typeof task.q === "number" ? task.q : 13);
    const scale = typeof task.scale === "number" ? Math.max(1, Math.min(4, Math.floor(task.scale))) : 2;
    const m1 = BigInt(typeof task.m1 === "number" ? Math.max(0, task.m1) : 7);
    const m2 = BigInt(typeof task.m2 === "number" ? Math.max(0, task.m2) : 5);
    const r1 = BigInt(typeof task.r1 === "number" ? task.r1 : 3);
    const r2 = BigInt(typeof task.r2 === "number" ? task.r2 : 5);
    const key = djKey(p, q, scale);
    const c1 = djEncrypt(m1, r1, key);
    const c2 = djEncrypt(m2, r2, key);
    const combined = djMultiply(c1, c2, key);
    const decrypted = djDecrypt(combined, key);

    const values: string[] = [];
    const set = (index: number, value: bigint | number): void => {
        values[index] = String(value);
    };
    const metaBase = {
        rows: LABELS.length,
        cols: 2,
        p: String(p),
        q: String(q),
        n: String(key.n),
        phi: String(key.phi),
        scale,
        modulus: String(key.modulus),
        m1: String(m1),
        m2: String(m2),
        r1: String(r1),
        r2: String(r2),
        c1: String(c1),
        c2: String(c2),
        combined: String(combined),
        decrypted: String(decrypted),
        expectedSum: String((m1 + m2) % key.n),
    };

    let step = 0;
    set(0, p); set(1, q); set(2, key.n); set(3, key.phi); set(4, scale); set(5, key.modulus);
    yield {
        stepNumber: step,
        entities: makeCells(values, 5),
        edges: [],
        description: `Set up modulus n=${key.n}, phi=${key.phi}, and scale ${scale} giving working modulus ${key.modulus}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: metaBase,
    };
    step += 1;

    set(6, m1); set(7, r1); set(8, c1);
    yield {
        stepNumber: step,
        entities: makeCells(values, 8),
        edges: [],
        description: `Encrypted m1=${m1} with r1=${r1} into ciphertext ${c1}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: metaBase,
    };
    step += 1;

    set(9, m2); set(10, r2); set(11, c2);
    yield {
        stepNumber: step,
        entities: makeCells(values, 11),
        edges: [],
        description: `Encrypted m2=${m2} with r2=${r2} into ciphertext ${c2}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: metaBase,
    };
    step += 1;

    set(12, combined);
    yield {
        stepNumber: step,
        entities: makeCells(values, 12),
        edges: [],
        description: `Multiplying the ciphertexts modulo ${key.modulus} gives an encryption of m1 + m2.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: metaBase,
    };
    step += 1;

    set(13, decrypted);
    yield {
        stepNumber: step,
        entities: makeCells(values, 13),
        edges: [],
        description: `Decryption recovered ${decrypted} = m1 + m2 modulo ${key.n}, without decrypting either input alone.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: metaBase,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Put the message in the exponent of n plus one and multiply in a random blinding factor raised to a high power of the modulus. Because exponents add when you multiply powers, multiplying two ciphertexts adds the hidden messages. The secret phi lets you strip the blinding factor and read off the sum. A bigger scale gives more room but uses a larger modulus for the same primes.",
        invariants: [
            "Each ciphertext is a residue modulo n to the scale plus one.",
            "The random factor is raised to n to the scale and cancels when raised to phi.",
            "Multiplying ciphertexts adds the corresponding plaintexts modulo n.",
        ],
        correctness:
            "Raising ciphertext g to the m times r to the n^s to the power phi removes the blinding factor because n^s times phi equals the Euler totient of the working modulus, so Euler's theorem makes that term one. The remaining (1+n) to the m phi has a first-order residue of m phi modulo n, and multiplying by the inverse of phi recovers m. For a product of ciphertexts the exponents add, so decryption returns m1 + m2 modulo n. With scale one this is exactly Paillier.",
        complexityRationale:
            "Encryption and decryption each use a constant number of modular exponentiations with exponents of size proportional to the modulus, costing O(log modulus) big-integer multiplications. The working modulus grows as n to the scale plus one, so larger scales increase both time and storage.",
        uses: [
            "Teaching additive homomorphic encryption beyond Paillier",
            "Privacy-preserving sums where ciphertexts can be combined by anyone",
            "Comparing scale-one Paillier with larger-scale Damgard-Jurik",
        ],
        references: [
            "Damgard and Jurik, A Generalisation, a Simplification and Some Applications of Paillier's Probabilistic Public-Key System, 2001",
            "Paillier, Public-Key Cryptosystems Based on Composite Degree Residuosity Classes, 1999",
        ],
        workedExample:
            "With p=11, q=13, and scale=2, the modulus is 143 and the working modulus is 143 cubed. Encrypting m1=7 with r1=3 and m2=5 with r2=5 produces two large residues. Multiplying them and decrypting with phi=120 returns 12, the sum of 7 and 5, without ever decrypting the two ciphertexts on their own.",
    },
    id: "damgard-jurik",
    name: "Damgard-Jurik Homomorphic Encryption (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(log modulus)", space: "O(1)" },
    defaultInput: { p: 11, q: 13, scale: 2, m1: 7, m2: 5, r1: 3, r2: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose primes p and q and a scale parameter s",
        "set n to p times q and the working modulus to n to the s plus one",
        "publish n and s; keep phi of n private",
        "for each message m choose a random r coprime to n",
        "encrypt as (n+1) to the m times r to the n to the s, modulo the working modulus",
        "multiply ciphertexts modulo the working modulus to add plaintexts",
        "decrypt by removing the blinding factor and dividing by phi modulo n",
        "done: report the ciphertexts and the decrypted sum",
    ],
};

export default module;
