/**
 * inverse-iteration.ts - Inverse Iteration for Eigenpairs
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Inverse iteration finds an eigenvector of a matrix by repeatedly solving
 * (A - mu*I)*y = x and renormalizing. When the shift mu is close to an
 * eigenvalue lambda, the component of x along that eigenvector is amplified by
 * 1/(lambda - mu) at every step, so the iterate converges to that eigenvector
 * and the Rayleigh quotient converges to lambda.
 *
 * The exact step shown is the shifted solve and the Rayleigh quotient. For a
 * small symmetric matrix the converged quotient matches the closed-form
 * eigenvalue nearest the shift, and the eigenvector residual is driven to zero.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * n^3) for k iterations with a fresh n by n solve each time
 *   Space: O(n^2) for the shifted matrix and O(n) for the iterate
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current eigenvector estimate, renormalized each step.
 *   - The newest iterate is yellow; the converged vector is green.
 *   - The eigenvalue estimate and eigenvector residual are in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Norm of a vector. */
function norm(v: number[]): number {
    return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

/** Dot product. */
function dot(a: number[], b: number[]): number {
    return a.reduce((sum, x, i) => sum + x * (b[i] ?? 0), 0);
}

/** Matrix-vector product. */
function matVec(a: number[][], x: number[]): number[] {
    return a.map((row) => dot(row, x));
}

/** Gaussian elimination with partial pivoting; null when singular. */
function solve(a: number[][], b: number[]): number[] | null {
    const n = b.length;
    const m = a.map((row, i) => [...row, b[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) pivot = r;
        }
        if (Math.abs(m[pivot]?.[col] ?? 0) < 1e-12) return null;
        [m[col], m[pivot]] = [m[pivot]!, m[col]!];
        const pv = m[col]![col]!;
        for (let c = col; c <= n; c += 1) m[col]![c]! /= pv;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const f = m[r]![col]!;
            if (f === 0) continue;
            for (let c = col; c <= n; c += 1) m[r]![c]! -= f * m[col]![c]!;
        }
    }
    return m.map((row) => row[n] ?? 0);
}

/** Shifted system (A - mu*I)*y = x, nudging an exactly singular shift. */
function shiftedSolve(a: number[][], mu: number, x: number[]): number[] {
    const n = x.length;
    const build = (shift: number): number[][] =>
        a.map((row, i) => row.map((entry, j) => entry - (i === j ? shift : 0)));
    let result = solve(build(mu), x);
    if (result === null) {
        result = solve(build(mu + 1e-7), x);
    }
    return result ?? [...x];
}

export interface InverseIterationData {
    history: Array<{ iter: number; vector: number[]; eigenvalue: number; residual: number }>;
    shift: number;
}

/** Run inverse iteration and record the eigenpair estimate at each step. */
export function inverseIteration(a: number[][], mu: number, iterations: number, initial: number[]): InverseIterationData {
    const n = initial.length;
    let x = [...initial];
    const initialNorm = norm(x);
    x = initialNorm > 0 ? x.map((v) => v / initialNorm) : x.map((_, i) => (i === 0 ? 1 : 0));
    const history: InverseIterationData["history"] = [];

    for (let iter = 1; iter <= iterations; iter += 1) {
        const y = shiftedSolve(a, mu, x);
        const yNorm = norm(y);
        x = yNorm > 0 ? y.map((v) => v / yNorm) : [...x];
        const ax = matVec(a, x);
        const eigenvalue = dot(x, ax);
        const residual = norm(ax.map((v, i) => v - eigenvalue * (x[i] ?? 0)));
        history.push({ iter, vector: [...x], eigenvalue, residual });
    }
    return { history, shift: mu };
}

/** Build eigenvector bars. */
function makeBars(vector: number[], active: boolean, state: EntityState = "idle"): VisualEntity[] {
    return vector.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: active ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** The inverse iteration generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; shift?: number; iterations?: number } | null) ?? {};
    const matrix = Array.isArray(task.matrix) ? task.matrix : [[2, 1], [1, 2]];
    const shift = typeof task.shift === "number" ? task.shift : 3.2;
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 8;
    const n = matrix.length;
    const initial = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 1 : 0.7));
    const data = inverseIteration(matrix, shift, iterations, initial);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(initial, false),
        edges: [],
        description: `Inverse iteration with shift ${shift} to find the eigenpair nearest that value.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, shift, eigenvalue: 0, residual: 0, vector: [...initial] },
    };

    for (const entry of data.history) {
        yield {
            stepNumber: step++,
            entities: makeBars(entry.vector, true),
            edges: [],
            description: `Iteration ${entry.iter}: eigenvalue estimate ${entry.eigenvalue.toFixed(6)}, residual ${entry.residual.toExponential(2)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                iteration: entry.iter,
                shift,
                eigenvalue: entry.eigenvalue,
                residual: entry.residual,
                vector: [...entry.vector],
            },
        };
    }

    const final = data.history[data.history.length - 1];
    yield {
        stepNumber: step,
        entities: makeBars(final?.vector ?? initial, false, "sorted"),
        edges: [],
        description: `Converged to eigenvalue ${(final?.eigenvalue ?? 0).toFixed(6)} with eigenvector residual ${(final?.residual ?? 0).toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            iteration: final?.iter ?? 0,
            shift,
            eigenvalue: final?.eigenvalue ?? 0,
            residual: final?.residual ?? 0,
            vector: final?.vector ?? initial,
        },
    };
}

/** The inverse iteration module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A shifted inverse solve magnifies exactly the eigenvector whose eigenvalue is closest to the shift. Start with an arbitrary vector, solve against the shifted matrix, and normalize. After a handful of rounds the direction stops changing and the Rayleigh quotient gives the eigenvalue.",
        invariants: [
            "The iterate is renormalized to unit length after every shifted solve.",
            "The Rayleigh quotient x transposed times A x estimates the eigenvalue.",
            "The component along the eigenvector nearest the shift grows fastest.",
        ],
        correctness:
            "Expand the starting vector in eigenvectors v_i with eigenvalues lambda_i. One inverse step multiplies the coefficient of v_i by 1/(lambda_i - mu). The eigenvalue closest to mu has the largest amplification factor, so after repeated steps its direction dominates. The Rayleigh quotient of a unit vector approaching an eigenvector converges to that eigenvalue, and the residual A*x - lambda*x tends to zero.",
        complexityRationale:
            "Each iteration solves one n by n linear system, O(n^3) when the factorization is redone, plus O(n^2) for the matrix-vector products. The shifted matrix and the iterate use O(n^2) and O(n) space respectively.",
        uses: [
            "Computing a single eigenvector when an approximate eigenvalue is known",
            "Rayleigh quotient iteration and shifted eigenvalue solvers",
            "Structural vibration and principal component computations",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, Chapter 7",
            "Wilkinson, The Algebraic Eigenvalue Problem, 1965",
        ],
        workedExample:
            "For matrix [[2,1],[1,2]] the eigenvalues are 3 and 1. With shift 3.2 the inverse solve repeatedly amplifies the eigenvector (1,1), and the Rayleigh quotient converges to 3 while the residual falls toward zero.",
    },
    id: "inverse-iteration",
    name: "Inverse Iteration",
    category: "numerical-optimization",
    complexity: { time: "O(k*n^3)", space: "O(n^2)" },
    defaultInput: { matrix: [[2, 1], [1, 2]], shift: 3.2, iterations: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a shift near the eigenvalue of interest",
        "start from a nonzero vector and normalize it",
        "for each iteration solve (A minus shift times I) times y equals x",
        "renormalize y and set x to it",
        "compute the Rayleigh quotient as x transposed A x",
        "compute the eigenvector residual norm",
        "stop when the residual is small",
        "done: report the eigenpair nearest the shift",
    ],
};

export default module;
