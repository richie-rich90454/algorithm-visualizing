/**
 * spectral-normalization.ts - Spectral Normalization by Power Iteration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Spectral normalization divides a weight matrix by its largest singular
 * value, bounding the operator norm of the layer to at most one. The largest
 * singular value is approximated with power iteration: repeatedly multiply a
 * unit vector by the matrix and its transpose, renormalizing each time. The
 * Rayleigh quotient of the resulting vectors converges to the spectral norm.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * m * n) for k power iterations on an m-by-n matrix
 *   Space: O(m + n) for the two iterate vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars trace the spectral-norm estimate at each power iteration.
 *   - The final frame reports the normalized layer's spectral norm.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Input {
    matrix?: number[][];
    iterations?: number;
}

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, weight, j) => sum + weight * (vector[j] ?? 0), 0));
}

function transpose(matrix: number[][]): number[][] {
    const rows = matrix.length;
    const cols = rows > 0 ? (matrix[0]?.length ?? 0) : 0;
    const result: number[][] = [];
    for (let c = 0; c < cols; c += 1) {
        const row: number[] = [];
        for (let r = 0; r < rows; r += 1) {
            row.push(matrix[r]?.[c] ?? 0);
        }
        result.push(row);
    }
    return result;
}

function norm(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function unit(vector: number[]): number[] {
    const length = norm(vector);
    return length > 0 ? vector.map((value) => value / length) : vector.map(() => 0);
}

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
}

function makeBars(values: number[], current: number): VisualEntity[] {
    return values.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: i === current ? "active" : i < current ? "sorted" : "idle",
        x: i,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, iteration: i, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const matrix = (task.matrix ?? [
        [3, 1],
        [1, 2],
    ]).map((row) => row.slice());
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 12;
    const transposed = transpose(matrix);
    const rightDim = matrix.length > 0 ? (matrix[0]?.length ?? 0) : 0;

    let v = rightDim > 0 ? unit(new Array<number>(rightDim).fill(1)) : [];
    const estimates: number[] = [];
    let sigma = 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([0], -1),
        edges: [],
        description: `Estimate the largest singular value with ${iterations} power iterations.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: 1, cols: 1, iterations, sigma: 0 },
    };
    step += 1;

    for (let k = 0; k < iterations; k += 1) {
        const u = unit(matVec(matrix, v));
        v = unit(matVec(transposed, u));
        sigma = Math.abs(dot(u, matVec(matrix, v)));
        estimates.push(Number(sigma.toFixed(6)));
        yield {
            stepNumber: step,
            entities: makeBars(estimates, estimates.length - 1),
            edges: [],
            description: `Iteration ${k + 1}: Rayleigh-quotient estimate of the spectral norm is ${sigma.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { rows: 1, cols: estimates.length, iteration: k + 1, sigma, estimate: Number(sigma.toFixed(6)) },
        };
        step += 1;
    }

    const safeSigma = sigma > 0 ? sigma : 1;
    const normalized = matrix.map((row) => row.map((value) => value / safeSigma));
    let checkV = rightDim > 0 ? unit(new Array<number>(rightDim).fill(1)) : [];
    let checkSigma = 0;
    for (let k = 0; k < 60; k += 1) {
        const u = unit(matVec(normalized, checkV));
        checkV = unit(matVec(transpose(normalized), u));
        checkSigma = Math.abs(dot(u, matVec(normalized, checkV)));
    }

    yield {
        stepNumber: step,
        entities: makeBars(estimates, estimates.length - 1),
        edges: [],
        description: `Done: divide weights by ${sigma.toFixed(4)}; the normalized layer has spectral norm about ${checkSigma.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            rows: 1,
            cols: estimates.length,
            sigma: Number(sigma.toFixed(6)),
            normalized: normalized.flat().map((value) => Number(value.toFixed(6))),
            normalizedSpectralNorm: Number(checkSigma.toFixed(6)),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A layer cannot stretch space by more than its largest singular value. Power iteration finds that value by repeatedly pushing a vector through the matrix and its transpose; the vector rotates toward the dominant singular direction and the Rayleigh quotient settles on the stretch factor. Dividing the weights by that factor caps the layer's Lipschitz constant near one, which stabilizes adversarial and generative training.",
        invariants: [
            "Both iterate vectors are renormalized to unit length after every multiplication.",
            "The Rayleigh quotient is nonnegative and converges upward toward the largest singular value.",
            "The normalized matrix is the original matrix divided by a single scalar sigma.",
        ],
        correctness:
            "Power iteration on W^T W converges to its dominant eigenvector, which is the right singular vector of W for the largest singular value. For unit u and v aligned with the singular vectors, u^T W v equals that singular value, so dividing W by sigma makes the largest singular value of the result equal to one and bounds the operator norm accordingly.",
        complexityRationale:
            "Each iteration multiplies by W and W^T, costing O(m * n) each, so k iterations cost O(k * m * n) time; only the two length-m and length-n vectors are kept, giving O(m + n) space.",
        uses: [
            "Lipschitz-constrained discriminator networks in WGAN",
            "Stability control in deep residual networks",
            "Certified robustness bounds for neural networks",
        ],
        references: [
            "Miyato et al., Spectral Normalization for Generative Adversarial Networks, ICLR 2018",
            "Golub & Van Loan, Matrix Computations, Chapter 8",
        ],
        workedExample:
            "For the matrix [[3, 1], [1, 2]], power iteration converges to a spectral norm near 3.618. Dividing every entry by 3.618 gives a matrix whose own power-iteration estimate is near 1.000, confirming the layer can no longer amplify a vector by more than about one.",
    },
    id: "spectral-normalization",
    name: "Spectral Normalization",
    category: "ml-ai",
    complexity: { time: "O(k * m * n)", space: "O(m + n)" },
    defaultInput: {
        matrix: [
            [3, 1],
            [1, 2],
        ],
        iterations: 12,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize vector v to a unit vector",
        "repeat for a fixed number of iterations",
        "compute u as W times v, normalized to unit length",
        "compute v as transpose(W) times u, normalized",
        "estimate sigma as u transpose times W times v",
        "divide every weight by sigma",
        "done: return the spectral-normalized weights",
    ],
};

export default module;
