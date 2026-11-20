/**
 * hqc-kem.ts - Toy Syndrome Decoding (HQC Teachable Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * HQC is a code-based post-quantum KEM whose decapsulation step decodes a
 * low-weight error from a syndrome. This is a small teaching model of that
 * step, not HQC and not a secure scheme. A weight-two error vector is encoded
 * as the syndrome H times e over GF(2), and decoding searches every pair of
 * columns of the parity-check matrix to recover the error positions. The
 * chosen matrix has distinct pairwise sums, so the error is unique.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 * m) for the brute-force pair search on an m by n matrix
 *   Space: O(m * n) for the matrix and syndrome
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid rows show the parity matrix, a syndrome column, and an error row.
 *   - The highlighted frame shows the pair search result.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HqcInput { p?: number; q?: number }

const COLUMNS: number[][] = [
    [1, 0, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
];
const M = COLUMNS[0]?.length ?? 5;
const N = COLUMNS.length;

function parity(row: number, col: number): number {
    return COLUMNS[col]?.[row] ?? 0;
}

function makeCells(syndrome: number[], error: number[], valid: boolean, phase: string): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row <= M; row += 1) {
        for (let col = 0; col <= N; col += 1) {
            let value: number;
            if (row < M && col < N) value = parity(row, col);
            else if (row < M && col === N) value = syndrome[row] ?? 0;
            else if (row === M && col < N) value = error[col] ?? 0;
            else value = valid ? 1 : 0;
            const active = (phase === "syndrome" && col === N && row < M)
                || (phase === "error" && row === M && col < N)
                || (phase === "decode" && row === M && col === N);
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: (active ? "active" : value === 1 ? "comparing" : "idle") as EntityState,
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
    const task = (input as HqcInput | null) ?? {};
    const clamp = (v: unknown): number => typeof v === "number" && v >= 0 && v < N ? Math.trunc(v) : 0;
    const p = clamp(task.p);
    const qRaw = clamp(task.q);
    const q = qRaw === p ? (p + 1) % N : qRaw;

    const error = Array(N).fill(0) as number[];
    error[p] = 1;
    error[q] = 1;
    const syndrome = Array.from({ length: M }, (_u, row) => {
        let bit = 0;
        for (let col = 0; col < N; col += 1) {
            bit ^= parity(row, col) & (error[col] ?? 0);
        }
        return bit;
    });

    let decoded: number[] = [];
    for (let i = 0; i < N && decoded.length === 0; i += 1) {
        for (let j = i + 1; j < N; j += 1) {
            let match = true;
            for (let row = 0; row < M; row += 1) {
                if ((parity(row, i) ^ parity(row, j)) !== syndrome[row]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                decoded = [i, j];
                break;
            }
        }
    }
    const expected = [p, q].sort((a, b) => a - b);
    const valid = decoded.length === 2 && decoded[0] === expected[0] && decoded[1] === expected[1];
    const base = { rows: M + 1, cols: N + 1, m: M, n: N, weight: 2, H: COLUMNS.flat(), p, q };

    yield {
        stepNumber: 0,
        entities: makeCells(Array(M).fill(0), Array(N).fill(0), false, "matrix"),
        edges: [],
        description: `Parity-check matrix has ${M} rows and ${N} columns; every pair of columns has a distinct sum.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "matrix", syndrome: [], error: [], decoded: [], valid: false },
    };
    yield {
        stepNumber: 1,
        entities: makeCells(syndrome, Array(N).fill(0), false, "syndrome"),
        edges: [],
        description: `Encode the weight-two error at positions ${p} and ${q}: syndrome is ${syndrome.join("")}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { ...base, phase: "syndrome", syndrome, error: [], decoded: [], valid: false },
    };
    yield {
        stepNumber: 2,
        entities: makeCells(syndrome, error, false, "error"),
        edges: [],
        description: `The error vector has ones at positions ${p} and ${q} and zeros elsewhere.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ...base, phase: "error", syndrome, error, decoded: [], valid: false },
    };
    yield {
        stepNumber: 3,
        entities: makeCells(syndrome, error, valid, "decode"),
        edges: [],
        description: `Brute-force pair search decodes to positions ${decoded.join(" and ")}: ${valid ? "correct" : "wrong"}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...base, phase: "decode", syndrome, error, decoded, valid },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Code-based cryptography hides information in an error vector that is decoded using a parity-check matrix. The syndrome is the matrix times the error vector over the field with two elements. HQC recovers a low-weight error from that syndrome. This toy uses a weight-two error and a tiny matrix whose pairwise column sums are all different, so searching all column pairs recovers the error exactly.",
        invariants: [
            "The syndrome bit in each row is the parity of the matrix row dotted with the error vector.",
            "The error vector has exactly two ones.",
            "The sum of any two distinct columns of the chosen matrix is unique.",
        ],
        correctness:
            "Linearity over GF(2) means the syndrome of a weight-two error at positions p and q equals the column-wise sum of columns p and q. Because the matrix was chosen so no two distinct pairs have the same column sum, the first matching pair found by exhaustive search must be the original pair. Re-encoding that pair reproduces the syndrome, confirming the decode.",
        complexityRationale:
            "The search checks all n choose two column pairs and, for each, compares m syndrome bits, so the toy decoder costs O(n squared times m). The matrix and syndrome occupy O(m times n) space. Real HQC uses structured codes and efficient decoders; this model uses brute force for clarity.",
        uses: [
            "Teaching the syndrome-decoding problem behind code-based cryptography",
            "Understanding the decapsulation step of post-quantum KEMs",
            "Illustrating why decoding a random linear code is computationally hard",
        ],
        references: [
            "Aguilar Melchor et al., HQC: Hamming Quasi-Cyclic, NIST Post-Quantum Cryptography submission",
            "McEliece, A Public-Key Cryptosystem Based on Algebraic Coding Theory, 1978",
        ],
        workedExample:
            "With columns that are the five unit vectors plus the all-ones vector, an error at positions zero and five has syndrome 1 xor the all-ones column, which is the complement of the first unit vector. Searching pairs finds that only columns zero and five produce this syndrome, so the error is recovered.",
    },
    id: "hqc-kem",
    name: "HQC KEM (Toy Syndrome Decoding Core)",
    category: "cryptography-security",
    complexity: { time: "O(n^2 * m) toy", space: "O(m * n) toy" },
    defaultInput: { p: 0, q: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "build a parity-check matrix with distinct pairwise column sums",
        "encode a weight-two error vector from the message",
        "compute the syndrome as matrix times error over GF(2)",
        "for every pair of columns compute their sum",
        "stop when a pair sum matches the syndrome",
        "check that re-encoding the found pair reproduces the syndrome",
        "done: report the decoded error positions",
    ],
};

export default module;
