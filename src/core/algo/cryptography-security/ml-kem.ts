/**
 * ml-kem.ts - ML-KEM (Rounding and Reconciliation Core)
 *
 * TEACHING MODEL, NOT FIPS 203 OR A SECURE KEM. ML-KEM (the NIST standard
 * formerly called Kyber) relies on compress and decompress rounding plus the
 * half-modulus message encoding that makes noisy lattice values decode to the
 * right bit. This module implements exactly those arithmetic steps on a small
 * coefficient vector with the real modulus q = 3329, so the rounding can be
 * followed by hand. It makes no security claim.
 *
 * Complexity:
 *   Time:  O(n) for n polynomial coefficients
 *   Space: O(n) for the staged coefficient table
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const Q = 3329;

type Cell = number | null;

function fmt(value: number): string {
    return String(Math.round(value * 1000) / 1000);
}

function positiveMod(value: number, modulus: number): number {
    return ((value % modulus) + modulus) % modulus;
}

/** Round a coefficient down into the smaller compressed domain. */
function compress(value: number, d: number): number {
    const pow = 2 ** d;
    return positiveMod(Math.round((pow / Q) * value), pow);
}

/** Map a compressed coefficient back into the modulus domain. */
function decompress(value: number, d: number): number {
    const pow = 2 ** d;
    return positiveMod(Math.round((Q / pow) * value), Q);
}

/** Encode a message bit as zero or half the modulus. */
function encodeBit(bit: number): number {
    return positiveMod(Math.round((Q / 2) * bit), Q);
}

/** Recover a message bit by checking which half of the modulus holds x. */
function decodeBit(value: number): number {
    return positiveMod(Math.round((2 / Q) * value), 2);
}

function makeCells(matrix: Cell[][], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const cells = matrix[row] ?? [];
        for (let col = 0; col < cells.length; col += 1) {
            const value = cells[col] ?? null;
            const hidden = row >= revealed || value === null;
            const state: EntityState = hidden
                ? "unvisited"
                : row === current
                  ? "active"
                  : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: hidden ? "?" : String(value),
                value: value ?? -1,
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
    const task = (
        input as { coefficients?: number[]; bits?: number[]; d?: number } | null
    ) ?? {};
    const coefficients = task.coefficients?.length
        ? task.coefficients.map((value) => positiveMod(Math.round(value), Q))
        : [0, 1664, 800, 2500, 3328, 100];
    const bits = task.bits?.length
        ? task.bits.map((bit) => (bit === 1 ? 1 : 0))
        : [0, 1, 1, 0, 1, 0];
    const d = Math.max(1, Math.min(12, Math.floor(task.d ?? 10)));
    const compressed = coefficients.map((value) => compress(value, d));
    const recovered = compressed.map((value) => decompress(value, d));
    const encoded = bits.map((bit) => encodeBit(bit));
    const decoded = encoded.map((value) => decodeBit(value));
    const width = Math.max(coefficients.length, bits.length, 1);

    const row = (values: number[]): Cell[] =>
        Array.from({ length: width }, (_, i) => values[i] ?? null);
    const matrix: Cell[][] = [row(coefficients), row(compressed), row(recovered), row(encoded), row(decoded)];
    const base = { rows: 5, cols: width, q: Q, d, coefficients: coefficients.length };
    const maxError = recovered.reduce(
        (max, value, i) => Math.max(max, Math.abs(value - (coefficients[i] ?? 0))),
        0,
    );
    const captions = [
        `Polynomial coefficients live modulo q = ${Q}; message bits are zero or q/2.`,
        `Compress each coefficient into the range 0 through 2^${d} by scaling and rounding.`,
        `Decompress scales back by q / 2^${d}; the largest rounding error is ${maxError}.`,
        "Encode each message bit as zero or the halfway value of the modulus.",
        `Decode by rounding twice the value over q; recovered bits: [${decoded.join(", ")}].`,
    ];
    const lines = [0, 1, 2, 3, 4];
    for (let frame = 0; frame < captions.length; frame += 1) {
        yield {
            stepNumber: frame,
            entities: makeCells(matrix, frame + 1, frame),
            edges: [],
            description: captions[frame] ?? "",
            codeLineNumber: lines[frame] ?? 0,
            layout: "grid",
            meta: {
                ...base,
                phase: frame === 0 ? "setup" : frame === 4 ? "done" : "rounding",
                compressed: compressed.slice(0, 12),
                recovered: recovered.slice(0, 12),
                decoded: decoded.slice(0, 12),
                maxError,
            },
        };
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Lattice encryption works with noisy numbers modulo a prime. To shrink ciphertexts and to recover a message from a slightly noisy coefficient, ML-KEM rounds values between two ranges. A message bit is placed either at zero or at half the modulus, so checking which half a noisy value falls into recovers the bit even after small errors.",
        invariants: [
            "Compressed coefficients lie in the range zero through two to the d minus one.",
            "Decompression maps back into the range zero through q minus one.",
            "A message bit encoded as zero or q/2 decodes back to the same bit by half-modulus rounding.",
        ],
        correctness:
            "Compression multiplies by two to the d over q and rounds, so the result differs from the exactly scaled value by at most one half. Multiplying back by q over two to the d therefore returns a coefficient within a small fixed rounding distance of the original, bounded by about q over two to the d plus one. For message bits, encoding gives zero or a value within a half of q/2; doubling and dividing by q then rounds to zero or one respectively, so the bit is recovered exactly.",
        complexityRationale:
            "Each of the n coefficients and each of the message bits needs a constant number of arithmetic operations, so the time is O(n). Storing the staged rows of coefficients uses O(n) space. Real ML-KEM applies these steps to vectors of polynomials rather than a single short vector.",
        uses: [
            "Post-quantum key establishment standardized as FIPS 203",
            "Compact ciphertext encoding in module-lattice schemes",
            "A teaching model of compression and message reconciliation",
        ],
        references: [
            "NIST FIPS 203, Module-Lattice-Based Key-Encapsulation Mechanism Standard, 2024",
            "Bos et al., CRYSTALS-Kyber, 2018",
        ],
        workedExample:
            "With q = 3329 and d = 10, a coefficient of 800 compresses to round(1024 times 800 over 3329), which is 246. Decompressing 246 scales back to about 800. The bit 1 encodes to 1665, and round of twice 1665 over 3329 is 1, so the bit is recovered.",
    },
    id: "ml-kem",
    name: "ML-KEM (Rounding and Reconciliation Core)",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        coefficients: [0, 1664, 800, 2500, 3328, 100],
        bits: [0, 1, 1, 0, 1, 0],
        d: 10,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with coefficients modulo q and message bits",
        "for each coefficient compute round(2^d * x / q) modulo 2^d",
        "recover an approximation with round(q * y / 2^d) modulo q",
        "encode each bit as zero or round(q / 2)",
        "decode each coefficient with round(2 * value / q) modulo 2",
        "done: report the compressed values and the recovered bits",
    ],
};

export default module;
