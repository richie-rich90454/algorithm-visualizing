/**
 * kyber-kem.ts - Toy LWE Key Encapsulation (Kyber Core Step)
 *
 * TEACHING MODEL, NOT PRODUCTION KYBER. This shows the learning-with-errors
 * rounding step at the heart of Kyber: encrypt a bit as a value near q/2, add
 * small noise, and recover the bit by checking which half of the modulus the
 * noisy value falls in. All arithmetic is exact on a tiny two-dimensional
 * example.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const Q = 251;
const HALF = Math.floor(Q / 2);
const A = [
    [5, 7],
    [11, 3],
];
const S = [3, -2];
const E = [1, -1];
const R = [2, -1];
const E1 = [1, 0];
const E2 = 1;

function mod(value: number): number {
    return ((value % Q) + Q) % Q;
}

function dot(a: number[], b: number[]): number {
    return a.reduce((acc, v, i) => acc + v * (b[i] ?? 0), 0);
}

function transpose(): number[][] {
    return A[0]?.map((_, col) => A.map((row) => row[col] ?? 0)) ?? [];
}

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => mod(dot(row, vector)));
}

function makeCells(rows: number[][], revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < rows.length; row += 1) {
        for (let col = 0; col < 4; col += 1) {
            const value = row <= revealed ? rows[row]?.[col] ?? -1 : -1;
            const state: EntityState = value < 0 ? "unvisited" : row === revealed ? "active" : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: value < 0 ? "?" : String(value),
                value,
                state,
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
    const task = (input as { bit?: number } | null) ?? {};
    const bit = task.bit === 1 || task.bit === 0 ? task.bit : 1;
    const t = matVec(A, S).map((value, i) => mod(value + (E[i] ?? 0)));
    const u = matVec(transpose(), R).map((value, i) => mod(value + (E1[i] ?? 0)));
    const v = mod(dot(t, R) + E2 + bit * HALF);
    const w = mod(v - dot(S, u));
    const decoded = w > HALF ? 1 : 0;
    const valid = decoded === bit;

    const rows = [
        A.flat(),
        [mod(S[0] ?? 0), mod(S[1] ?? 0), mod(E[0] ?? 0), mod(E[1] ?? 0)],
        [t[0] ?? 0, t[1] ?? 0, u[0] ?? 0, u[1] ?? 0],
        [v, w, decoded, valid ? 1 : 0],
    ];

    const base = { q: Q, bit, rows: 4, cols: 4 };
    yield {
        stepNumber: 0,
        entities: makeCells(rows, 0),
        edges: [],
        description: `Public matrix A over the integers modulo ${Q}; the secret and errors are small vectors.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "matrix", decoded: -1, valid: false },
    };
    yield {
        stepNumber: 1,
        entities: makeCells(rows, 1),
        edges: [],
        description: `Secret s and error e are small: s = (${S[0]}, ${S[1]}), e = (${E[0]}, ${E[1]}).`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { ...base, phase: "secret", decoded: -1, valid: false },
    };
    yield {
        stepNumber: 2,
        entities: makeCells(rows, 2),
        edges: [],
        description: `Public value t = A*s + e = (${t[0]}, ${t[1]}); ciphertext vector u = A^T*r + e1 = (${u[0]}, ${u[1]}).`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ...base, phase: "ciphertext", decoded: -1, valid: false, t, u },
    };
    yield {
        stepNumber: 3,
        entities: makeCells(rows, 3),
        edges: [],
        description: `Decapsulation computes w = v - s*u mod q = ${w}, which decodes to bit ${decoded}: ${valid ? "correct" : "wrong"}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...base, phase: "decode", decoded, valid, v, w, t, u },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Lattice-based encryption hides a message inside noise. To send a bit, the sender adds either zero or half the modulus to a value derived from the public key, plus a little random error. The receiver subtracts a quantity involving the secret and reads the bit by checking which half of the modulus the result lands in.",
        invariants: [
            "The public value t equals A times the secret plus a small error, modulo q.",
            "The ciphertext vector u equals A transposed times the randomness plus small error.",
            "The noise left after subtracting s times u is much smaller than q/4.",
        ],
        correctness:
            "Expanding v - s*u gives (t*r + e2 + bit*q/2) - s*(A^T r + e1). Since t = A*s + e and (A*s)*r = s*(A^T r), the large terms cancel, leaving bit*q/2 plus the small quantity e*r + e2 - s*e1. Because this residual is far smaller than q/4, rounding to the nearest half of the modulus returns the original bit exactly. This two-dimensional instance demonstrates that step only; it is not a secure KEM.",
        complexityRationale:
            "All products are small fixed-size vectors and one matrix-vector multiplication each, so the work is constant time and constant space for this toy instance; real Kyber scales with the module dimension and polynomial degree.",
        uses: [
            "Post-quantum key establishment in TLS and VPNs",
            "Hybrid key exchange combining classical and lattice schemes",
            "A teaching model of module-lattice encryption",
        ],
        references: [
            "Regev, On Lattices, Learning with Errors, 2005",
            "Bos et al., CRYSTALS-Kyber: A CCA-Secure Module-Lattice-Based KEM, 2018",
        ],
        workedExample:
            "With q = 251, the secret (3, -2) and error (1, -1) give public value t = (2, 26). Encoding bit 1 adds 125, and after subtracting s times u the receiver sees w = 126, which lies above the halfway point, so the decoded bit is 1.",
    },
    id: "kyber-kem",
    name: "Kyber KEM (Toy LWE Step)",
    category: "cryptography-security",
    complexity: { time: "O(1) toy", space: "O(1) toy" },
    defaultInput: { bit: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a small secret and error vector modulo q",
        "publish t equal to A times the secret plus the error",
        "choose small randomness and form u from A transposed",
        "encode the bit by adding zero or half of q to the shared value v",
        "decode by subtracting the secret contribution from v",
        "read the bit by comparing the result with half of q",
        "done: report whether the decoded bit matches",
    ],
};

export default module;
