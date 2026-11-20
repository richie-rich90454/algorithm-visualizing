/**
 * spinquant.ts - SpinQuant Rotation-Based Post-Training Quantization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SpinQuant suppresses quantization outliers by rotating weight rows with an
 * orthogonal matrix before rounding them to low precision. A Walsh-Hadamard
 * rotation spreads large values across many coordinates, which shrinks the
 * dynamic range that a fixed scale must cover. Several candidate rotations are
 * scored by reconstruction error and the best one is kept.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * n log n) for m rows, n columns and the fast Hadamard transform
 *   Space: O(m * n) for the rotated and quantized matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The weight matrix is drawn as a grid of cells.
 *   - Each candidate rotation replaces the displayed values with its quantized version.
 *   - The frame meta records the mean squared error of every candidate.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SpinQuantInput {
    weights?: number[][];
    bits?: number;
    candidates?: string[];
}

/** Dense unnormalized Sylvester Hadamard matrix of power-of-two order. */
export function hadamardMatrix(n: number): number[][] {
    let H = [[1]];
    while (H.length < n) {
        const size = H.length;
        const next: number[][] = Array.from({ length: size * 2 }, () => new Array<number>(size * 2).fill(0));
        for (let i = 0; i < size; i += 1) {
            for (let j = 0; j < size; j += 1) {
                const h = H[i]?.[j] ?? 0;
                next[i]![j] = h;
                next[i]![j + size] = h;
                next[i + size]![j] = h;
                next[i + size]![j + size] = -h;
            }
        }
        H = next;
    }
    return H;
}

/** Fast Walsh-Hadamard transform, equal to multiplying by the dense matrix. */
export function fwht(vector: number[]): number[] {
    const out = [...vector];
    for (let len = 1; len < out.length; len *= 2) {
        for (let start = 0; start < out.length; start += 2 * len) {
            for (let i = 0; i < len; i += 1) {
                const a = out[start + i] ?? 0;
                const b = out[start + i + len] ?? 0;
                out[start + i] = a + b;
                out[start + i + len] = a - b;
            }
        }
    }
    return out;
}

/** Symmetric uniform affine quantization with one scale per row. */
export function quantizeRow(row: number[], bits: number): { codes: number[]; dequant: number[]; scale: number } {
    const limit = 2 ** (bits - 1) - 1;
    const maxAbs = row.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    const scale = maxAbs / limit;
    if (scale === 0) {
        return { codes: row.map(() => 0), dequant: row.map(() => 0), scale: 0 };
    }
    const codes = row.map((v) => Math.max(-limit, Math.min(limit, Math.round(v / scale))));
    return { codes, dequant: codes.map((q) => q * scale), scale };
}

function rotationVector(name: string, row: number[], H: number[][]): number[] {
    if (name === "identity") return [...row];
    const rotated = fwht(row);
    if (name === "hadamard-sign") {
        return rotated.map((v, i) => (i % 2 === 1 ? -v / H.length : v / H.length));
    }
    return rotated.map((v) => v / H.length);
}

function inverseRotation(name: string, row: number[], H: number[][]): number[] {
    if (name === "identity") return [...row];
    const scaled = row.map((v) => v * H.length);
    if (name === "hadamard-sign") {
        return fwht(scaled.map((v, i) => (i % 2 === 1 ? -v : v))).map((v) => v / H.length);
    }
    return fwht(scaled).map((v) => v / H.length);
}

/** Try every named rotation and return the quantized matrix with lowest error. */
export function spinQuant(
    weights: number[][],
    bits: number,
    candidates: string[],
): { matrix: number[][]; codes: number[][]; errors: number[]; chosen: string; chosenIndex: number } {
    const n = weights[0]?.length ?? 1;
    const H = hadamardMatrix(2 ** Math.ceil(Math.log2(Math.max(2, n))));
    const errors: number[] = [];
    const variants = candidates.map((name) => {
        let totalError = 0;
        const codes: number[][] = [];
        const dequantRows: number[][] = [];
        for (const row of weights) {
            const rotated = rotationVector(name, row, H);
            const q = quantizeRow(rotated, bits);
            codes.push(q.codes);
            const restored = inverseRotation(name, q.dequant, H);
            dequantRows.push(restored);
            row.forEach((v, j) => {
                totalError += ((restored[j] ?? 0) - v) ** 2;
            });
        }
        errors.push(totalError / Math.max(1, weights.length * n));
        return { name, codes, matrix: dequantRows };
    });
    let chosenIndex = 0;
    for (let i = 1; i < variants.length; i += 1) {
        if ((errors[i] ?? Infinity) < (errors[chosenIndex] ?? Infinity)) chosenIndex = i;
    }
    const chosen = variants[chosenIndex];
    return {
        matrix: chosen?.matrix ?? [],
        codes: chosen?.codes ?? [],
        errors,
        chosen: chosen?.name ?? "identity",
        chosenIndex,
    };
}

function makeCells(matrix: number[][], codes: number[][]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < (matrix[row]?.length ?? 0); col += 1) {
            const value = matrix[row]?.[col] ?? 0;
            entities.push({
                id: `weight-${row}-${col}`,
                type: "cell",
                label: value.toFixed(2),
                value,
                state: (codes[row]?.[col] ?? 0) === 0 ? "idle" : "comparing",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, code: codes[row]?.[col] ?? 0 },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SpinQuantInput | null) ?? {};
    const weights = (task.weights ?? [
        [0.12, -0.45, 0.88, 0.03],
        [-0.30, 0.77, 0.14, -0.62],
        [0.55, 0.21, -0.09, 0.93],
        [0.41, -0.18, 0.36, -0.71],
    ]).map((row) => [...row]);
    const bits = Math.max(2, Math.min(8, Math.floor(task.bits ?? 4)));
    const candidates = Array.isArray(task.candidates) && task.candidates.length > 0
        ? task.candidates
        : ["identity", "hadamard", "hadamard-sign"];
    const result = spinQuant(weights, bits, candidates);
    const rows = weights.length;
    const cols = weights[0]?.length ?? 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(weights, weights.map((row) => row.map(() => 0))),
        edges: [],
        description: `Original ${rows} by ${cols} weight matrix; trying ${candidates.length} rotations at ${bits} bits.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, bits, candidates, errors: result.errors, stage: "original", matrix: weights },
    };
    step += 1;

    for (let index = 0; index < candidates.length; index += 1) {
        const name = candidates[index] ?? "identity";
        // Re-run each variant through the public helper so every frame is truthful.
        const H = hadamardMatrix(2 ** Math.ceil(Math.log2(Math.max(2, cols))));
        const codes: number[][] = [];
        const matrix: number[][] = [];
        for (const row of weights) {
            const q = quantizeRow(rotationVector(name, row, H), bits);
            codes.push(q.codes);
            matrix.push(inverseRotation(name, q.dequant, H));
        }
        yield {
            stepNumber: step,
            entities: makeCells(matrix, codes),
            edges: [],
            description: `Rotation ${name}: reconstruction error ${(result.errors[index] ?? 0).toExponential(2)}.`,
            codeLineNumber: index === 0 ? 2 : 4,
            layout: "grid",
            meta: { rows, cols, bits, candidates, errors: result.errors, stage: name, matrix, codes },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result.matrix, result.codes),
        edges: [],
        description: `Chose ${result.chosen} with mean squared error ${(result.errors[result.chosenIndex] ?? 0).toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows, cols, bits, candidates, errors: result.errors, chosen: result.chosen, matrix: result.matrix },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Quantization fails when a few weights are huge outliers because one shared scale must cover them all. Rotating the weight space with an orthogonal matrix spreads those outliers across coordinates without changing the linear function. After rounding, rotating back gives a quantized weight matrix with far less error.",
        invariants: [
            "A Hadamard rotation is orthogonal up to a known scale factor, so it preserves distances.",
            "Each row is quantized with one scale derived from its largest rotated magnitude.",
            "The chosen rotation has the lowest mean squared reconstruction error among the candidates.",
        ],
        correctness:
            "The fast Walsh-Hadamard transform computes the same product as the dense Sylvester matrix by repeated butterfly additions, so it is orthogonal up to a factor of n. Round-to-nearest with scale s bounds each entry's quantization error by s/2. Trying every candidate rotation and taking the smallest reconstruction error is an exhaustive search, so the returned rotation is optimal within the provided set.",
        complexityRationale:
            "A length-n Hadamard transform takes O(n log n) butterfly operations; applying it to all m rows and scoring the candidates costs O(m n log n). The rotated, coded, and restored matrices each use O(m n) space.",
        uses: [
            "Post-training quantization of large language model weights",
            " Reducing memory bandwidth in inference accelerators",
            "Outlier suppression in low-bit neural network deployment",
        ],
        references: [
            "Liu et al., SpinQuant: LLM Quantization with Learned Rotations, ICML 2024",
            "Sylvester, Hadamard matrices and their applications, 1867",
        ],
        workedExample:
            "For the single row [3, 1], the identity rotation has scale 3/7 at 4 bits and rounds to codes [7, 2], while a Hadamard rotation turns it into [4, 2] with scale 4/7, spreading the range. Rotating the dequantized values back and comparing squared errors picks the rotation with the smaller reconstruction error.",
    },
    id: "spinquant",
    name: "SpinQuant Rotation-Based Quantization",
    category: "ml-ai",
    complexity: { time: "O(m * n log n)", space: "O(m * n)" },
    defaultInput: {
        weights: [
            [0.12, -0.45, 0.88, 0.03],
            [-0.30, 0.77, 0.14, -0.62],
            [0.55, 0.21, -0.09, 0.93],
            [0.41, -0.18, 0.36, -0.71],
        ],
        bits: 4,
        candidates: ["identity", "hadamard", "hadamard-sign"],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "build an orthogonal Walsh-Hadamard rotation matrix",
        "initialize the best error to infinity",
        "for each candidate rotation",
        "rotate every weight row and find its quantization scale",
        "round and clamp entries to integer codes",
        "rotate the dequantized row back and measure squared error",
        "keep the rotation with the smallest error",
        "done: output the best quantized weight matrix",
    ],
};

export default module;
