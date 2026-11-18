/**
 * rayleigh-quotient-iteration.ts - Rayleigh Quotient Iteration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rayleigh quotient iteration refines an approximate eigenvector by shifting
 * the matrix with the current Rayleigh quotient and solving the shifted system
 * for a fresh vector. For a symmetric matrix the quotient converges cubically
 * to an eigenvalue and the vector converges to its eigenvector. This module
 * demonstrates the method on a small symmetric matrix with an exact 2 by 2
 * shifted solve.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^3) for a dense shifted solve
 *   Space: O(n^2) for the shifted matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the two components of the current eigenvector estimate.
 *   - The estimate is yellow while it moves and green once it converges.
 *   - The quotient, eigenpair residual, and iteration count are in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build the two component bars of the eigenvector estimate. */
function makeBars(x: number[], state: EntityState): VisualEntity[] {
    return x.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(6),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
}

function matVec(a: number[][], x: number[]): number[] {
    return a.map((row) => dot(row, x));
}

/** Solve a two by two system exactly, or return null when it is singular. */
function solve2(a: number[][], rhs: number[]): number[] | null {
    const p = a[0]?.[0] ?? 0;
    const q = a[0]?.[1] ?? 0;
    const r = a[1]?.[0] ?? 0;
    const s = a[1]?.[1] ?? 0;
    const det = p * s - q * r;
    if (Math.abs(det) < 1e-14) {
        return null;
    }
    const y0 = rhs[0] ?? 0;
    const y1 = rhs[1] ?? 0;
    return [(s * y0 - q * y1) / det, (p * y1 - r * y0) / det];
}

/** The Rayleigh quotient iteration generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { a?: number[][]; x0?: number[]; maxIter?: number; tol?: number } | null
    ) ?? {};
    const a = Array.isArray(task.a) ? task.a.map((row) => [...row]) : [[2, 1], [1, 3]];
    const maxIter = typeof task.maxIter === "number" ? Math.max(1, Math.floor(task.maxIter)) : 20;
    const tol = typeof task.tol === "number" && task.tol > 0 ? task.tol : 1e-12;
    let x = Array.isArray(task.x0) && task.x0.length === 2 ? [...task.x0] : [1, 0];
    const initialNorm = Math.hypot(x[0] ?? 0, x[1] ?? 0) || 1;
    x = x.map((value) => value / initialNorm);

    let quotient = dot(x, matVec(a, x));
    let residual = Math.sqrt(
        matVec(a, x)
            .map((value, i) => value - quotient * (x[i] ?? 0))
            .reduce((sum, value) => sum + value * value, 0),
    );
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(x, "idle"),
        edges: [],
        description: `Starting from the unit vector (${x[0]!.toFixed(4)}, ${x[1]!.toFixed(4)}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { eigenvector: [...x], quotient, residual, iteration: 0, converged: false },
    };
    step += 1;

    let converged = residual < tol;
    let used = 0;
    for (let iteration = 0; iteration < maxIter && !converged; iteration += 1) {
        const shift = quotient;
        const shifted = [
            [(a[0]?.[0] ?? 0) - shift, a[0]?.[1] ?? 0],
            [a[1]?.[0] ?? 0, (a[1]?.[1] ?? 0) - shift],
        ];
        const y = solve2(shifted, x);
        if (y === null) {
            converged = true;
            break;
        }
        const norm = Math.hypot(y[0] ?? 0, y[1] ?? 0);
        if (norm < 1e-15 || !Number.isFinite(norm)) {
            break;
        }
        x = y.map((value) => value / norm);
        quotient = dot(x, matVec(a, x));
        residual = Math.sqrt(
            matVec(a, x)
                .map((value, i) => value - quotient * (x[i] ?? 0))
                .reduce((sum, value) => sum + value * value, 0),
        );
        used = iteration + 1;
        converged = residual < tol;
        yield {
            stepNumber: step,
            entities: makeBars(x, converged ? "sorted" : "comparing"),
            edges: [],
            description: `Iteration ${used}: quotient ${quotient.toFixed(10)}, eigenpair residual ${residual.toExponential(2)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { eigenvector: [...x], quotient, residual, iteration: used, converged },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, "sorted"),
        edges: [],
        description: converged
            ? `Converged to eigenvalue ${quotient.toFixed(10)} in ${used} iteration(s).`
            : `Stopped after ${used} iteration(s) with quotient ${quotient.toFixed(10)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { eigenvector: [...x], quotient, residual, iteration: used, converged },
    };
}

/** The Rayleigh quotient iteration module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A Rayleigh quotient turns any approximate eigenvector into an estimate of its eigenvalue. Shifting the matrix by that estimate makes the desired eigenvalue almost zero, so solving the shifted system strongly amplifies the eigenvector component you want. Repeating the shift and solve converges very quickly for symmetric matrices.",
        invariants: [
            "The iterate stays normalized to unit Euclidean length.",
            "The quotient is the weighted average of the eigenvalues using the squared eigenvector components.",
            "A near-singular shifted matrix indicates that the quotient is already an eigenvalue.",
        ],
        correctness:
            "For a symmetric matrix, expand the starting vector in an orthonormal eigenbasis. The shifted solve multiplies component i by one over lambda_i minus the quotient, so the component whose eigenvalue is nearest the quotient dominates. The quotient becomes a far better estimate, and the error contracts cubically once it is close. The final residual norm measures how nearly the pair satisfies Ax equals lambda x.",
        complexityRationale:
            "A dense shifted linear solve costs O(n^3) and is the dominant work per iteration. The quotient and residual are O(n^2), so the total is O(iterations * n^3) time and O(n^2) space for the shifted matrix.",
        uses: [
            "Computing a single eigenvalue and eigenvector to high accuracy",
            "Refining eigenvalues found by a preliminary QR or Lanczos pass",
            "Solving shifted linear systems in structural dynamics",
        ],
        references: [
            "Parlett, The Symmetric Eigenvalue Problem, 1980",
            "Burden and Faires, Numerical Analysis, Section 9.5",
        ],
        workedExample:
            "For the matrix [[2, 1], [1, 3]] starting at (1, 0), the first quotient is 2. The shifted solve points toward the eigenvector of the smaller eigenvalue, and a few steps reach an eigenvalue near 1.38197 with residual below one part in a trillion.",
    },
    id: "rayleigh-quotient-iteration",
    name: "Rayleigh Quotient Iteration",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^3)", space: "O(n^2)" },
    defaultInput: { a: [[2, 1], [1, 3]], x0: [1, 0], maxIter: 20, tol: 1e-12 },
    visualType: "array",
    run,
    pseudocode: [
        "normalize the starting vector to unit length",
        "compute the Rayleigh quotient of the current vector",
        "form the matrix shifted by that quotient",
        "solve the shifted system for a new direction",
        "normalize the direction to get the next vector",
        "recompute the quotient and eigenpair residual",
        "repeat until the residual is tiny or the shift is singular",
        "done: report the eigenvalue and eigenvector",
    ],
};

export default module;
