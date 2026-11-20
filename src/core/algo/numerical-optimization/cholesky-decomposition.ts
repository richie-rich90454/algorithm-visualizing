/**
 * cholesky-decomposition.ts - Cholesky Decomposition
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cholesky factorization writes a symmetric positive-definite matrix A as
 * L times the transpose of L, where L is lower triangular with positive
 * diagonal entries. It is the workhorse for solving linear systems, sampling
 * multivariate Gaussians, and Monte Carlo simulation because it is roughly
 * twice as fast as LU for the same matrices.
 *
 * This module computes L entry by entry with floating-point arithmetic. If a
 * diagonal term is not positive the matrix is not positive definite and the
 * factorization is reported as failed rather than forced.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) for an n by n matrix
 *   Space: O(n^2) for the factor L
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the lower-triangular factor L as it is filled in.
 *   - The pivot being computed is highlighted; finished entries are green.
 *   - meta carries A, L, and the reconstruction error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build the grid cells for the factor L. */
function makeCells(
    l: number[][],
    computed: boolean[][],
    pivot: [number, number] | null,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < l.length; row += 1) {
        for (let col = 0; col < l.length; col += 1) {
            const isComputed = computed[row]?.[col] === true;
            const isPivot = pivot !== null && pivot[0] === row && pivot[1] === col;
            let state: EntityState = "unvisited";
            if (isPivot) {
                state = "comparing";
            } else if (isComputed) {
                state = "sorted";
            }
            const value = l[row]?.[col] ?? 0;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: isComputed ? value.toFixed(3) : "",
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
    return cells;
}

/** Flatten a matrix row by row. */
function flatten(matrix: number[][]): number[] {
    const out: number[] = [];
    for (const row of matrix) {
        for (const value of row) {
            out.push(value);
        }
    }
    return out;
}

/** The Cholesky decomposition generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][] } | null) ?? {};
    const raw = Array.isArray(task.matrix) ? task.matrix : [];
    const matrix: number[][] =
        raw.length > 0
            ? raw.map((row) => (Array.isArray(row) ? row.map((v) => Number(v)) : []))
            : [
                  [4, 2, 2],
                  [2, 10, 1],
                  [2, 1, 9],
              ];
    const n = matrix.length;
    const l: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    const computed: boolean[][] = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => false),
    );

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(l, computed, null),
        edges: [],
        description: `Factoring a ${n} by ${n} symmetric matrix; the lower-triangular factor starts empty.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n, n, matrix: flatten(matrix), factor: flatten(l), success: false, maxError: 0 },
    };
    step += 1;

    let success = true;
    let failure = "";

    for (let i = 0; i < n && success; i += 1) {
        for (let j = 0; j <= i; j += 1) {
            let sum = matrix[i]?.[j] ?? 0;
            for (let k = 0; k < j; k += 1) {
                sum -= (l[i]?.[k] ?? 0) * (l[j]?.[k] ?? 0);
            }
            if (i === j) {
                if (sum <= 0) {
                    success = false;
                    failure = `Diagonal term at ${i} is ${sum.toExponential(2)}, so the matrix is not positive definite.`;
                    yield {
                        stepNumber: step,
                        entities: makeCells(l, computed, [i, j]),
                        edges: [],
                        description: failure,
                        codeLineNumber: 4,
                        layout: "grid",
                        meta: { rows: n, cols: n, n, matrix: flatten(matrix), factor: flatten(l), success: false, maxError: 0 },
                    };
                    step += 1;
                    break;
                }
                l[i]![j] = Math.sqrt(sum);
            } else {
                l[i]![j] = sum / (l[j]?.[j] ?? 1);
            }
            computed[i]![j] = true;

            yield {
                stepNumber: step,
                entities: makeCells(l, computed, [i, j]),
                edges: [],
                description: `Compute L[${i}][${j}] = ${(l[i]?.[j] ?? 0).toFixed(4)} from the row-column dot product.`,
                codeLineNumber: i === j ? 3 : 5,
                layout: "grid",
                meta: { rows: n, cols: n, n, matrix: flatten(matrix), factor: flatten(l), success: false, maxError: 0 },
            };
            step += 1;
        }
    }

    let maxError = 0;
    if (success) {
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                let reconstructed = 0;
                for (let k = 0; k < n; k += 1) {
                    reconstructed += (l[i]?.[k] ?? 0) * (l[j]?.[k] ?? 0);
                }
                maxError = Math.max(maxError, Math.abs(reconstructed - (matrix[i]?.[j] ?? 0)));
            }
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(l, computed, null),
        edges: [],
        description: success
            ? `Factorization complete: A = L * L^T with maximum entry error ${maxError.toExponential(2)}.`
            : `Factorization failed: ${failure}`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: n,
            cols: n,
            n,
            matrix: flatten(matrix),
            factor: flatten(l),
            success,
            maxError,
        },
    };
}

/** The Cholesky decomposition module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Cholesky factorization is the square-root version of LU for symmetric positive-definite matrices. It fills a lower-triangular matrix one entry at a time so that multiplying that triangle by its transpose rebuilds the original matrix. Positive definiteness guarantees every square root and division is well defined.",
        invariants: [
            "The factor L is lower triangular: entries above the diagonal stay zero.",
            "Every diagonal entry of L is positive.",
            "After the first i rows, the leading i by i block of L times its transpose equals that block of A.",
        ],
        correctness:
            "For each entry the algorithm enforces the defining equation sum over k of L[i][k] times L[j][k] equals A[i][j]. For a diagonal entry this gives L[i][i] squared equal to the remaining diagonal residual, which is positive exactly when the leading minor is positive definite. For an off-diagonal entry it solves linearly for L[i][j]. By induction over rows and columns every equation of A = L L^T is satisfied when the loop finishes.",
        complexityRationale:
            "Computing each of the roughly n squared/2 entries requires a dot product of up to n terms, costing O(n^3) time overall. Storing the triangular factor uses O(n^2) space.",
        uses: [
            "Solving symmetric positive-definite linear systems",
            "Generating correlated Gaussian samples in Monte Carlo methods",
            "Least-squares normal equations and Kalman filters",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, Chapter 4",
            "Higham, Accuracy and Stability of Numerical Algorithms, Chapter 11",
        ],
        workedExample:
            "For A = [[4, 2], [2, 10]], the diagonal gives L[0][0] = 2 and L[1][1] = sqrt(10 - 1) = 3. The off-diagonal gives L[1][0] = 2 / 2 = 1. Multiplying L = [[2, 0], [1, 3]] by its transpose recovers A exactly.",
    },
    id: "cholesky-decomposition",
    name: "Cholesky Decomposition",
    category: "numerical-optimization",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        matrix: [
            [4, 2, 2],
            [2, 10, 1],
            [2, 1, 9],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "allocate a zero lower-triangular matrix L",
        "for each row i from zero to n minus one",
        "for each column j from zero to i",
        "subtract the dot product of rows i and j up to column j",
        "if i equals j set L[i][j] to the square root of the residual",
        "else set L[i][j] to the residual divided by L[j][j]",
        "fail if a diagonal residual is not positive",
        "done: report L so that A equals L times its transpose",
    ],
};

export default module;
