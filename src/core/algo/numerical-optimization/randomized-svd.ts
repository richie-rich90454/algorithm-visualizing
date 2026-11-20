/**
 * randomized-svd.ts - Randomized SVD for Low-Rank Approximation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Randomized SVD approximates the leading singular triplets of a matrix without
 * a full deterministic factorization. It draws a small random test matrix,
 * multiplies by A to sample the column space, orthonormalizes that sample with
 * QR, and then factorizes the much smaller projected matrix B = Q^T A. A few
 * power iterations improve accuracy when the singular values decay slowly. The
 * result is a rank-k approximation U Sigma V^T using only O(m n l) work with
 * l = k plus oversampling.
 *
 * This implementation uses a fixed-seed generator, modified Gram-Schmidt with
 * reorthogonalization, and a cyclic Jacobi eigensolver for the small symmetric
 * matrix B B^T. It is exact on the small matrices shown here; on large or
 * ill-conditioned inputs the approximation is probabilistic and its quality
 * depends on the spectral decay and oversampling.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m n l + m l^2 + l^3) with l = k + oversampling
 *   Space: O(m n + m l + n l) for A, the sample basis, and the small factors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per retained singular value shows its magnitude.
 *   - The sampled basis bar is yellow, the final singular spectrum is green.
 *   - The metadata carries the singular values, rank, and reconstruction error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RandomizedSvdInput {
    matrix?: number[][];
    rank?: number;
    oversample?: number;
    powerIterations?: number;
    seed?: number;
}

/** Deterministic sign-uniform random generator (linear congruential). */
function makeRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return (s / 4294967296) * 2 - 1;
    };
}

function matMul(a: number[][], b: number[][]): number[][] {
    const m = a.length;
    const k = b.length;
    const n = k > 0 ? (b[0]?.length ?? 0) : 0;
    const out = Array.from({ length: m }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < m; i += 1) {
        for (let p = 0; p < k; p += 1) {
            const aip = a[i]![p] ?? 0;
            for (let j = 0; j < n; j += 1) {
                out[i]![j] = out[i]![j]! + aip * (b[p]![j] ?? 0);
            }
        }
    }
    return out;
}

function transpose(a: number[][]): number[][] {
    if (a.length === 0) return [];
    return a[0]!.map((_, j) => a.map((row) => row[j] ?? 0));
}

/** Orthonormalize the columns of a tall matrix by modified Gram-Schmidt with a second pass. */
function qrColumns(a: number[][]): number[][] {
    const rows = a.length;
    const cols = rows > 0 ? (a[0]?.length ?? 0) : 0;
    const q = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
    for (let j = 0; j < cols; j += 1) {
        for (let i = 0; i < rows; i += 1) q[i]![j] = a[i]![j] ?? 0;
        for (let pass = 0; pass < 2; pass += 1) {
            for (let k = 0; k < j; k += 1) {
                let dot = 0;
                for (let i = 0; i < rows; i += 1) dot += q[i]![k]! * q[i]![j]!;
                for (let i = 0; i < rows; i += 1) q[i]![j] = q[i]![j]! - dot * q[i]![k]!;
            }
        }
        let norm = 0;
        for (let i = 0; i < rows; i += 1) norm += q[i]![j]! ** 2;
        norm = Math.sqrt(norm);
        if (norm < 1e-12) {
            for (let i = 0; i < rows; i += 1) q[i]![j] = 0;
        } else {
            for (let i = 0; i < rows; i += 1) q[i]![j] = q[i]![j]! / norm;
        }
    }
    return q;
}

/** Cyclic Jacobi eigendecomposition of a small symmetric matrix. Columns of vectors are eigenvectors. */
function jacobiEigen(input: number[][]): { values: number[]; vectors: number[][] } {
    const n = input.length;
    const a = input.map((row) => [...row]);
    const v: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    for (let sweep = 0; sweep < 60; sweep += 1) {
        let maxOff = 0;
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) maxOff = Math.max(maxOff, Math.abs(a[i]![j]!));
        }
        if (maxOff < 1e-13) break;
        for (let p = 0; p < n; p += 1) {
            for (let q = p + 1; q < n; q += 1) {
                const apq = a[p]![q]!;
                if (Math.abs(apq) < 1e-15) continue;
                const theta = (a[q]![q]! - a[p]![p]!) / (2 * apq);
                const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(1 + theta * theta));
                const c = 1 / Math.sqrt(1 + t * t);
                const s = t * c;
                for (let k = 0; k < n; k += 1) {
                    if (k === p || k === q) continue;
                    const akp = a[k]![p]!;
                    const akq = a[k]![q]!;
                    a[k]![p] = c * akp - s * akq;
                    a[k]![q] = s * akp + c * akq;
                    a[p]![k] = a[k]![p];
                    a[q]![k] = a[k]![q];
                }
                const app = a[p]![p]!;
                const aqq = a[q]![q]!;
                a[p]![p] = app - t * apq;
                a[q]![q] = aqq + t * apq;
                a[p]![q] = 0;
                a[q]![p] = 0;
                for (let k = 0; k < n; k += 1) {
                    const vkp = v[k]![p]!;
                    const vkq = v[k]![q]!;
                    v[k]![p] = c * vkp - s * vkq;
                    v[k]![q] = s * vkp + c * vkq;
                }
            }
        }
    }
    return { values: a.map((row, i) => row[i]!), vectors: v };
}

function frobenius(a: number[][]): number {
    let sum = 0;
    for (const row of a) for (const x of row) sum += x * x;
    return Math.sqrt(sum);
}

function makeBars(values: number[], active: EntityState): VisualEntity[] {
    return values.map((sigma, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: sigma.toFixed(4),
        value: sigma,
        state: active,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, sigma },
    }));
}

/** The randomized SVD generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RandomizedSvdInput | null) ?? {};
    const A = Array.isArray(task.matrix) && task.matrix.length > 0
        ? task.matrix.map((row) => [...row])
        : [
              [1, 2, 3, 4],
              [5, 6, 7, 8],
              [9, 10, 11, 12],
              [13, 14, 15, 16],
              [17, 18, 19, 20],
          ];
    const m = A.length;
    const n = A[0]?.length ?? 0;
    const rank = typeof task.rank === "number" ? Math.max(1, Math.floor(task.rank)) : 2;
    const oversample = typeof task.oversample === "number" ? Math.max(1, Math.floor(task.oversample)) : 2;
    const powerIterations = typeof task.powerIterations === "number" ? Math.max(0, Math.min(4, Math.floor(task.powerIterations))) : 1;
    const seed = typeof task.seed === "number" ? task.seed : 7;
    const l = Math.min(m, n, rank + oversample);
    const k = Math.min(rank, l);
    let step = 0;

    yield {
        stepNumber: step++,
        entities: makeBars([], "idle"),
        edges: [],
        description: `Approximating rank ${k} of a ${m} by ${n} matrix with ${l} random samples and ${powerIterations} power iteration(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { m, n, rank: k, l, seed, singularValues: [], error: 0, phase: "start" },
    };

    const rand = makeRandom(seed);
    const omega = Array.from({ length: n }, () => Array.from({ length: l }, () => rand()));
    let Y = matMul(A, omega);
    yield {
        stepNumber: step++,
        entities: makeBars([], "comparing"),
        edges: [],
        description: "Sampled the column space with a fixed-seed random test matrix: Y = A * Omega.",
        codeLineNumber: 1,
        layout: "array",
        meta: { m, n, rank: k, l, seed, singularValues: [], error: 0, phase: "sample" },
    };

    for (let q = 0; q < powerIterations; q += 1) {
        Y = qrColumns(Y);
        Y = matMul(A, matMul(transpose(A), Y));
        yield {
            stepNumber: step++,
            entities: makeBars([], "comparing"),
            edges: [],
            description: `Power iteration ${q + 1} amplifies the leading singular directions.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { m, n, rank: k, l, seed, singularValues: [], error: 0, phase: "power" },
        };
    }

    const Q = qrColumns(Y);
    const B = matMul(transpose(Q), A);
    const gram = matMul(B, transpose(B));
    const eig = jacobiEigen(gram);
    const order = eig.values.map((value, i) => ({ value: Math.max(0, value), i })).sort((x, y) => y.value - x.value);
    const singularValues = order.map((o) => Math.sqrt(o.value));
    yield {
        stepNumber: step++,
        entities: makeBars(singularValues.slice(0, k), "comparing"),
        edges: [],
        description: `Projected A onto the sampled basis and factorized B = Q^T A; leading singular values: ${singularValues.slice(0, k).map((s) => s.toFixed(3)).join(", ")}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { m, n, rank: k, l, seed, singularValues: singularValues.slice(0, k), error: 0, phase: "factor" },
    };

    // Build the rank-k reconstruction A_approx = Q * U_b[:, :k] * Sigma[:, :k] * V[:, :k]^T.
    const Ub = Array.from({ length: l }, (_, row) => Array.from({ length: k }, (_, col) => eig.vectors[row]![order[col]!.i]!));
    const V = Array.from({ length: n }, () => new Array<number>(k).fill(0));
    for (let j = 0; j < k; j += 1) {
        const sigma = singularValues[j]!;
        if (sigma < 1e-12) continue;
        for (let i = 0; i < n; i += 1) {
            let sum = 0;
            for (let r = 0; r < l; r += 1) sum += B[r]![i]! * Ub[r]![j]!;
            V[i]![j] = sum / sigma;
        }
    }
    const QUb = matMul(Q, Ub);
    const recon = matMul(matMul(QUb, Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? singularValues[i]! : 0)))), transpose(V));
    const diff = Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => (A[i]![j] ?? 0) - (recon[i]![j] ?? 0)));
    const error = frobenius(diff);
    yield {
        stepNumber: step++,
        entities: makeBars(singularValues.slice(0, k), "sorted"),
        edges: [],
        description: `Rank-${k} reconstruction has Frobenius error ${error.toFixed(6)} using ${powerIterations} power iteration(s).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { m, n, rank: k, l, seed, singularValues: singularValues.slice(0, k), error, phase: "done" },
    };
}

/** The randomized SVD module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A matrix with quickly decaying singular values lives mostly in a low-dimensional subspace. Instead of computing the whole SVD, multiply the matrix by a few random vectors to sample that subspace, then factorize only the small projected matrix. A couple of power iterations push the sample toward the most important directions, and the result reconstructs the matrix nearly as well as an exact rank-k factorization at a fraction of the cost.",
        invariants: [
            "The sampled basis Q has orthonormal columns after QR orthonormalization.",
            "The projected matrix B = Q^T A is much smaller than A when l is much less than min(m, n).",
            "The reconstructed matrix has rank at most k.",
        ],
        correctness:
            "The random test matrix almost surely has a component along each leading singular vector, so A times that test matrix spans a subspace that captures the dominant column space. Power iteration applies (A A^T)^q, multiplying each singular component by sigma to the 2q, which suppresses small directions. Orthonormalizing gives a basis Q such that A is close to Q Q^T A; the SVD of B = Q^T A then gives the singular values and right vectors of that compressed matrix, and U = Q U_b lifts them back. When the spectrum decays and oversampling is used, the reconstruction error is within a small factor of the best rank-k error.",
        complexityRationale:
            "Forming the sample costs O(m n l); each power iteration costs O(m n l) plus QR; factorizing B costs O(l^3) for the small eigensolve and O(n l^2) to form B B^T. With l much smaller than min(m, n) the total is far below the O(m n min(m, n)) of a full SVD, and the stored factors use O(m l + n l).",
        uses: [
            "Fast latent semantic analysis and topic models",
            "Low-rank compression of images and embeddings",
            "Preconditioning and dimensionality reduction for large data sets",
        ],
        references: [
            "Halko, Martinsson, and Tropp, Finding Structure with Randomness, 2011",
            "Trefethen and Bau, Numerical Linear Algebra, lectures on the SVD",
        ],
        workedExample:
            "For a 5 by 4 matrix with l = 4 samples and one power iteration, the method builds a 5 by 4 orthonormal basis Q, factorizes the 4 by 4 matrix B, and keeps the two largest singular values. The rank-two reconstruction captures most of the Frobenius norm of the original matrix.",
    },
    id: "randomized-svd",
    name: "Randomized SVD",
    category: "numerical-optimization",
    complexity: { time: "O(m n l + m l^2 + l^3)", space: "O(m n + m l + n l)" },
    defaultInput: { rank: 2, oversample: 2, powerIterations: 1, seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "read the matrix, target rank, oversampling, and seed",
        "draw a fixed-seed random test matrix with rank plus oversampling columns",
        "form the sample Y equals A times the test matrix",
        "repeat power iterations Y equals A A transpose Y with QR",
        "orthonormalize the sample columns into Q",
        "project the matrix B equals Q transpose A",
        "compute the eigendecomposition of B B transpose for singular values",
        "lift the factors back and build the rank-k reconstruction",
        "done: report singular values and reconstruction error",
    ],
};

export default module;
