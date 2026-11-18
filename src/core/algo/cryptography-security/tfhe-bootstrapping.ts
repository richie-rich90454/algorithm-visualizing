/**
 * tfhe-bootstrapping.ts - Toy LWE Noise Refresh (TFHE Teachable Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * TFHE bootstrapping homomorphically evaluates decryption to replace a noisy
 * ciphertext with a fresh one whose noise is small again, enabling unlimited
 * computations. This is a small teaching model of that refresh idea, not a
 * fully homomorphic scheme: it decodes a noisy LWE sample, then re-encrypts the
 * same message with new small noise using a separate seeded generator. No
 * security claim is made.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(dim) for the inner products and re-encryption
 *   Space: O(dim) for the ciphertext vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells list the phase, decoded bit, fresh noise, and refreshed phase.
 *   - The secret, vectors, and noise bounds are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TfheInput { bit?: number; seed?: number }

const Q = 256;
const HALF = Q / 2;
const S = [3, -2];
const A = [7, -5];
const BOUND = 2;

function smallNoise(seed: number, offset: number): number[] {
    let state = (seed + offset) >>> 0;
    return A.map(() => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return (state % (2 * BOUND + 1)) - BOUND;
    });
}

function inner(a: number[], b: number[]): number {
    return a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
}

function modq(value: number): number {
    return ((value % Q) + Q) % Q;
}

function decode(phase: number): number {
    return phase > HALF ? 1 : 0;
}

function makeCells(values: number[]): VisualEntity[] {
    const labels = ["a dot s", "phase", "decoded", "fresh noise", "refreshed phase", "refreshed bit"];
    const entities: VisualEntity[] = [];
    for (let row = 0; row < labels.length; row += 1) {
        for (let col = 0; col < 2; col += 1) {
            const text = col === 0 ? labels[row] ?? "" : String(values[row] ?? 0);
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: text,
                value: col === 0 ? labels[row] ?? "" : values[row] ?? 0,
                state: (col === 0 ? "idle" : "comparing") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TfheInput | null) ?? {};
    const bit = task.bit === 1 || task.bit === 0 ? task.bit : 1;
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 11;
    const as = inner(A, S);
    const noise = smallNoise(seed, 0);
    const phase = modq(as + inner(noise, [1, 1]) + bit * HALF);
    const decoded = decode(phase);
    const freshNoise = smallNoise(seed, 1000);
    const refreshedPhase = modq(as + inner(freshNoise, [1, 1]) + decoded * HALF);
    const refreshedBit = decode(refreshedPhase);
    const valid = decoded === bit && refreshedBit === bit && freshNoise.every((v) => Math.abs(v) <= BOUND);

    const values = [as, phase, decoded, inner(freshNoise, [1, 1]), refreshedPhase, refreshedBit];
    const base = {
        rows: 6,
        cols: 2,
        q: Q,
        bit,
        seed,
        a: A,
        s: S,
        as,
        noise,
        freshNoise,
        bound: BOUND,
    };
    yield {
        stepNumber: 0,
        entities: makeCells([as, phase, decoded, 0, 0, 0]),
        edges: [],
        description: `Noisy ciphertext decodes to bit ${decoded} with phase ${phase} modulo ${Q}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { ...base, phase: "decode", lwePhase: phase, decoded, refreshedPhase: 0, refreshedBit: 0, valid: false },
    };
    yield {
        stepNumber: 1,
        entities: makeCells([as, phase, decoded, inner(freshNoise, [1, 1]), refreshedPhase, refreshedBit]),
        edges: [],
        description: `Re-encrypt bit ${decoded} with fresh noise bounded by ${BOUND}; refreshed phase is ${refreshedPhase}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { ...base, phase: "refresh", lwePhase: phase, decoded, refreshedPhase, refreshedBit, valid },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Every homomorphic operation adds a little noise to an encrypted value, and too much noise makes decryption fail. Bootstrapping evaluates the decryption circuit on the ciphertext itself and produces a new encryption of the same message with low noise, so computation can continue. This toy shows the refresh end of that idea: it decodes the noisy sample and then encrypts the recovered bit again with fresh small noise.",
        invariants: [
            "The phase is the inner product of the ciphertext vector with the secret plus the message times half the modulus, reduced modulo q.",
            "The decoded bit is one when the phase exceeds half the modulus.",
            "Fresh noise is drawn with absolute value at most the stated bound.",
        ],
        correctness:
            "The noisy phase equals a dot s plus the message times q over two plus small noise. Because the small noise is far below q over four, the phase lies on the correct side of the midpoint, so comparing with q over two recovers the message. Re-encrypting that bit with new small noise and the same secret reproduces a valid ciphertext of the same message, which is the observable purpose of bootstrapping.",
        complexityRationale:
            "The inner products and modular reductions use O(dim) operations, and re-encryption uses O(dim) more. Only the ciphertext vectors, secret, and noise samples are stored, so space is O(dim). Real TFHE replaces the explicit decode with a homomorphic blind rotation over the torus.",
        uses: [
            "Teaching why fully homomorphic encryption needs noise refresh",
            "Understanding the role of the LWE phase and decoding radius",
            "Introducing bootstrapping before studying blind rotation",
        ],
        references: [
            "Chillotti, Gama, Georgieva and Paillier, TFHE: Fast Fully Homomorphic Encryption over the Torus, 2020",
            "Gentry, Fully Homomorphic Encryption Using Ideal Lattices, 2009",
        ],
        workedExample:
            "With secret (3, minus 2), vector (7, minus 5), and modulus 256, the inner product is 31. Encrypting bit one adds 128 and small noise, giving a phase near 159, above the midpoint 128, so the bit decodes to one. Re-encryption with new small noise gives a phase near 159 again with a refreshed noise budget.",
    },
    id: "tfhe-bootstrapping",
    name: "TFHE Bootstrapping (Toy Noise Refresh Core)",
    category: "cryptography-security",
    complexity: { time: "O(dim) toy", space: "O(dim) toy" },
    defaultInput: { bit: 1, seed: 11 },
    visualType: "grid",
    run,
    pseudocode: [
        "set the modulus, secret, and ciphertext vector",
        "sample a small noise vector for the noisy ciphertext",
        "compute the phase modulo the modulus",
        "decode the message by comparing with half the modulus",
        "sample fresh small noise for the refreshed ciphertext",
        "re-encrypt the decoded bit and compute its phase",
        "check that the refreshed bit matches the original",
        "done: report both phases and the refresh verdict",
    ],
};

export default module;
