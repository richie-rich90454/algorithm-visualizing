/**
 * ckks-homomorphic-encryption.ts - CKKS-Style Approximate Homomorphic Arithmetic (Toy)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CKKS encrypts approximate real numbers so that addition and multiplication on
 * ciphertexts mirror the same operations on plaintexts. This teaching model
 * keeps the defining ideas: scale a real by a power of two into an integer, add
 * a small masking term and noise to make a two-part ciphertext, and support
 * homomorphic add and multiply with relinearization. Decryption divides by the
 * current scale, leaving a tiny approximation error.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is NOT CKKS and is not secure. It uses small integers instead of ring
 * polynomials and NTT, a fixed secret, and deterministic tiny noise. It omits
 * modular reduction, rescaling, rotation keys, and bootstrapping. Only the
 * encode, scale, add, multiply, and decode steps are faithful in spirit and
 * exact in their integer arithmetic for this toy.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(s) per operation for s slots
 *   Space: O(s) for each ciphertext's two vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Encoded integers, ciphertext parts, and decoded results are grid cells.
 *   - meta carries both ciphertexts and the plaintext versus decrypted values.
 *   - The final frame reports the approximation error of add and multiply.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Input {
    a?: number[];
    b?: number[];
}

export const CKKS_DELTA = 4096;
export const CKKS_SECRET = 7;
const RELIN_KEY = CKKS_SECRET + 1;

export interface ToyCiphertext {
    c0: number[];
    c1: number[];
    level: number;
    slots: number;
}

/** Scale real slots into integers. */
export function ckksEncode(values: number[]): number[] {
    return values.map((v) => Math.round(v * CKKS_DELTA));
}

/** Add a secret-masked random term and small noise to each encoded slot. */
export function ckksEncrypt(encoded: number[], seed: number): ToyCiphertext {
    const c0 = encoded.map((z, j) => {
        const u = ((Math.imul(seed + 1, 1103515245) + Math.imul(j + 1, 2654435761) + 12345) >>> 0) % 6;
        const e = (((Math.imul(seed + 1, 97) + Math.imul(j + 1, 31) + 5) >>> 0) % 3) - 1;
        return z - CKKS_SECRET * u + e;
    });
    const c1 = encoded.map((_z, j) => ((Math.imul(seed + 1, 1103515245) + Math.imul(j + 1, 2654435761) + 12345) >>> 0) % 6);
    return { c0, c1, level: 1, slots: encoded.length };
}

/** Decrypt by removing the mask and dividing by the current scale. */
export function ckksDecrypt(ct: ToyCiphertext): number[] {
    const scale = CKKS_DELTA ** ct.level;
    return ct.c0.map((v, i) => (v + CKKS_SECRET * (ct.c1[i] ?? 0)) / scale);
}

/** Componentwise homomorphic addition of two same-level ciphertexts. */
export function ckksAdd(a: ToyCiphertext, b: ToyCiphertext): ToyCiphertext {
    return {
        c0: a.c0.map((v, i) => v + (b.c0[i] ?? 0)),
        c1: a.c1.map((v, i) => v + (b.c1[i] ?? 0)),
        level: Math.max(a.level, b.level),
        slots: a.slots,
    };
}

/** Homomorphic multiplication with toy relinearization back to two parts. */
export function ckksMul(a: ToyCiphertext, b: ToyCiphertext): ToyCiphertext {
    const c0 = a.c0.map((v, i) => v * (b.c0[i] ?? 0));
    const c1tmp = a.c0.map((v, i) => v * (b.c1[i] ?? 0) + (a.c1[i] ?? 0) * (b.c0[i] ?? 0));
    const c2 = a.c1.map((v, i) => v * (b.c1[i] ?? 0));
    const c1 = c1tmp.map((v, i) => v + RELIN_KEY * (c2[i] ?? 0));
    return { c0, c1, level: a.level + b.level, slots: a.slots };
}

const flatten = (rows: number[][]): number[] => rows.reduce<number[]>((acc, row) => acc.concat(row), []);

function cells(values: number[], label: (v: number) => string): VisualEntity[] {
    return values.map((value, i) => ({
        id: `slot-${i}`,
        type: "cell" as const,
        label: label(value),
        value,
        state: "active" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i, slot: i },
    }));
}

/** The toy CKKS generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const a = task.a ?? [1.5, -2.25];
    const b = task.b ?? [0.5, 3];
    const slots = a.length;
    const za = ckksEncode(a);
    const zb = ckksEncode(b);
    const ctA = ckksEncrypt(za, 1);
    const ctB = ckksEncrypt(zb, 2);
    const ctAdd = ckksAdd(ctA, ctB);
    const ctMul = ckksMul(ctA, ctB);
    const decA = ckksDecrypt(ctA);
    const decB = ckksDecrypt(ctB);
    const decAdd = ckksDecrypt(ctAdd);
    const decMul = ckksDecrypt(ctMul);
    const expectedAdd = a.map((v, i) => v + (b[i] ?? 0));
    const expectedMul = a.map((v, i) => v * (b[i] ?? 0));
    const addError = Math.max(...decAdd.map((v, i) => Math.abs(v - (expectedAdd[i] ?? 0))));
    const mulError = Math.max(...decMul.map((v, i) => Math.abs(v - (expectedMul[i] ?? 0))));
    const base = {
        rows: 1,
        cols: slots,
        slots,
        delta: CKKS_DELTA,
        secret: CKKS_SECRET,
        encodedA: za,
        encodedB: zb,
        decA,
        decB,
        expectedAdd,
        expectedMul,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(za, (v) => String(v)),
        edges: [],
        description: `Scale ${slots} real slots by ${CKKS_DELTA} into integers before encryption.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "encode", decAdd: [], decMul: [], addError: 0, mulError: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(flatten([ctA.c0, ctA.c1]), (v) => String(v)),
        edges: [],
        description: `Ciphertext A adds a secret-masked mask and tiny noise: c0 ${ctA.c0.join(", ")}, c1 ${ctA.c1.join(", ")}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ...base, phase: "encrypt", c0: ctA.c0, c1: ctA.c1, decAdd: [], decMul: [], addError: 0, mulError: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(decAdd, (v) => v.toFixed(4)),
        edges: [],
        description: `Homomorphic add gives ${decAdd.map((v) => v.toFixed(4)).join(", ")}; expected ${expectedAdd.join(", ")}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { ...base, phase: "add", decAdd, decMul: [], addError, mulError: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(decMul, (v) => v.toFixed(4)),
        edges: [],
        description: `Homomorphic multiply with relinearization gives ${decMul.map((v) => v.toFixed(4)).join(", ")}; expected ${expectedMul.join(", ")}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...base, phase: "mul", decAdd, decMul, addError, mulError },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(decMul, (v) => v.toFixed(4)),
        edges: [],
        description: `Done: largest add error ${addError.toExponential(2)}, multiply error ${mulError.toExponential(2)}. This toy is not secure.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            ...base,
            phase: "done",
            decAdd,
            decMul,
            addError,
            mulError,
            note: "small integer toy, not CKKS and not secure",
            converged: true,
        },
    };
}

/** The toy CKKS-style homomorphic encryption module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "CKKS treats approximate numbers like fixed-point integers: multiply each real by a scale, then encrypt the integer. Because the ciphertext is linear in the plaintext, adding ciphertexts adds the hidden integers, and multiplying them multiplies the hidden integers while squaring the scale. A relinearization step folds the grown ciphertext back to two parts. Decryption divides by the current scale, and the small encryption noise shows up as a tiny approximation error.",
        invariants: [
            "Encoding maps a real value to the nearest integer multiple of the scale.",
            "A ciphertext's mask cancels during decryption because c0 plus the secret times c1 removes it.",
            "Each homomorphic multiplication raises the scale exponent by one.",
        ],
        correctness:
            "Encrypt sets c0 = z - s*u + e and c1 = u, so c0 + s*c1 = z + e and decryption returns z/SCALE, within noise/SCALE of the plaintext. Adding ciphertexts adds both c0 and c1, so decryption yields z_a + z_b over the same scale. Multiplying gives c0_a c0_b + s(c0_a c1_b + c0_b c1_a) + s^2 c1_a c1_b; relinearization adds an encryption of s times c1_a c1_b into c1, so the two-part decryption equals (z_a + e_a)(z_b + e_b) plus one small relin error. Dividing by SCALE squared returns the product up to that tiny error.",
        complexityRationale:
            "Each ciphertext holds two vectors of length s, and add, multiply, and decrypt touch each slot a constant number of times, so every operation is O(s) time and O(s) space. Real CKKS pays polynomial and NTT costs that this toy intentionally omits.",
        uses: [
            "Teaching approximate homomorphic encryption and scale management",
            "Understanding why multiplication consumes a scale level",
            "A stepping stone to CKKS, BFV, and TFHE",
        ],
        references: [
            "Cheon et al., Homomorphic Encryption for Arithmetic of Approximate Numbers, ASIACRYPT 2017",
            "NIST, Privacy-Enhancing Cryptography, 2025",
        ],
        workedExample:
            "With scale 4096, the values 1.5 and -2.25 encode to 6144 and -9216. Encryption hides them behind a secret-times-random mask plus noise of at most one. Adding the ciphertexts and decrypting gives about -0.75, while multiplying and dividing by 4096 squared gives about -3.375, each off only by the tiny toy noise.",
    },
    id: "ckks-homomorphic-encryption",
    name: "CKKS-Style Homomorphic Arithmetic (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(s)", space: "O(s)" },
    defaultInput: { a: [1.5, -2.25], b: [0.5, 3] },
    visualType: "grid",
    run,
    pseudocode: [
        "scale each real slot by the fixed power-of-two scale",
        "encrypt by masking with secret times random and adding tiny noise",
        "store the ciphertext as two component vectors",
        "add ciphertexts componentwise",
        "multiply ciphertexts and relinearize to two components",
        "decrypt by removing the mask and dividing by the scale level",
        "done: report plaintext results and approximation error",
    ],
};

export default module;
