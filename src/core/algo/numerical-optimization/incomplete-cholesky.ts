/**
 * incomplete-cholesky.ts - Incomplete Cholesky IC(0) Preconditioner
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Incomplete Cholesky builds an approximate factor L of a sparse symmetric
 * positive-definite matrix while forbidding any fill-in outside the original
 * sparsity pattern of A. The resulting M = L L^T matches A exactly on every
 * stored position, but ignores fill that exact Cholesky would create. M is a
 * popular preconditioner for conjugate-gradient solvers because it is cheap
 * to build and apply while clustering the eigenvalues of M inverse times A.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * p^2) where p is the largest row width of the pattern
 *   Space: O(nnz) for the stored lower triangle
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the lower factor L; positions outside the pattern stay blank.
 *   - The pivot being updated is gold; finished stored entries turn green.
 *   - meta carries the factor, the sparsity pattern, and the pattern error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function flatten(matrix: number[][]): number[] {
    const out: number[] = [];
    for (const row of matrix) for (const value of row) out.push(value);
    return out;
}

function makeCells(
    lower: number[][],
    pattern: boolean[][],
    computed: boolean[][],
    pivot: [number, number] | null,
): VisualEntity[] {
    const n = lower.length;
    const cells: VisualEntity[] = [];
    for (let row = 0; row < n; row += 1) {
        for (let col = 0; col < n; col += 1) {
            const stored = pattern[row]?.[col] === true && col <= row;
            const isPivot = pivot !== null && pivot[0] === row && pivot[1] === col;
            let state: EntityState = "unvisited";
            if (isPivot) {
                state = "comparing";
            } else if (stored && computed[row]?.[col] === true) {
                state = "sorted";
            } else if (!stored && col < row) {
                state = "error";
            }
            const value = stored ? (lower[row]?.[col] ?? 0) : 0;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: stored ? value.toFixed(3) : "",
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, stored },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][] } | null) ?? {};
    const raw = Array.isArray(task.matrix) ? task.matrix : [];
    const matrix: number[][] =
        raw.length > 0
            ? raw.map((row) => (Array.isArray(row) ? row.map((v) => Number(v)) : []))
            : [
                  [4, 1, 1, 0],
                  [1, 4, 0, 1],
                  [1, 0, 4, 1],
                  [0, 1, 1, 4],
              ];
    const n = matrix.length;
    const lower: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    const computed: boolean[][] = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => false),
    );
    const pattern: boolean[][] = matrix.map((row) => row.map((value) => Math.abs(value) > 1e-14));

    const metaFor = (error: number, failed: boolean, dropped: number) => ({
        rows: n,
        cols: n,
        n,
        matrix: flatten(matrix),
        factor: flatten(lower),
        pattern: flatten(pattern.map((row) => row.map((v) => (v ? 1 : 0)))),
        patternError: error,
        failed,
        dropped,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(lower, pattern, computed, null),
        edges: [],
        description: `Building an IC(0) preconditioner for a ${n} by ${n} sparse matrix with no fill-in.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: metaFor(0, false, 0),
    };
    step += 1;

    let failed = false;
    for (let row = 0; row < n && !failed; row += 1) {
        for (let col = 0; col < row; col += 1) {
            if (!pattern[row]?.[col]) continue;
            let sum = matrix[row]?.[col] ?? 0;
            for (let k = 0; k < col; k += 1) {
                if ((pattern[row]?.[k] ?? false) && (pattern[col]?.[k] ?? false)) {
                    sum -= (lower[row]?.[k] ?? 0) * (lower[col]?.[k] ?? 0);
                }
            }
            const pivot = lower[col]?.[col] ?? 0;
            if (Math.abs(pivot) < 1e-14) {
                failed = true;
                break;
            }
            lower[row]![col] = sum / pivot;
            computed[row]![col] = true;
            yield {
                stepNumber: step,
                entities: makeCells(lower, pattern, computed, [row, col]),
                edges: [],
                description: `Stored entry L[${row}][${col}] = ${(lower[row]?.[col] ?? 0).toFixed(4)}; nonpattern fill is discarded.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: metaFor(0, false, 0),
            };
            step += 1;
        }
        if (failed) break;
        let diag = matrix[row]?.[row] ?? 0;
        for (let k = 0; k < row; k += 1) {
            if (pattern[row]?.[k]) diag -= (lower[row]?.[k] ?? 0) ** 2;
        }
        if (diag <= 0) {
            failed = true;
            yield {
                stepNumber: step,
                entities: makeCells(lower, pattern, computed, [row, row]),
                edges: [],
                description: `Diagonal residual ${diag.toExponential(2)} is not positive: the incomplete factor broke down.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: metaFor(0, true, 0),
            };
            step += 1;
            break;
        }
        lower[row]![row] = Math.sqrt(diag);
        computed[row]![row] = true;
        yield {
            stepNumber: step,
            entities: makeCells(lower, pattern, computed, [row, row]),
            edges: [],
            description: `Diagonal L[${row}][${row}] = ${lower[row]![row].toFixed(4)} closes off row ${row}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: metaFor(0, false, 0),
        };
        step += 1;
    }

    let patternError = 0;
    let dropped = 0;
    if (!failed) {
        for (let row = 0; row < n; row += 1) {
            for (let col = 0; col < n; col += 1) {
                let product = 0;
                for (let k = 0; k <= Math.min(row, col); k += 1) {
                    product += (lower[row]?.[k] ?? 0) * (lower[col]?.[k] ?? 0);
                }
                const expected = matrix[row]?.[col] ?? 0;
                if (pattern[row]?.[col]) {
                    patternError = Math.max(patternError, Math.abs(product - expected));
                } else if (Math.abs(product - expected) > 1e-9) {
                    dropped += 1;
                }
            }
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(lower, pattern, computed, null),
        edges: [],
        description: failed
            ? `Incomplete factorization broke down.`
            : `IC(0) complete: exact on the ${n} by ${n} pattern, ${dropped} discarded fill entr${dropped === 1 ? "y" : "ies"}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: metaFor(patternError, failed, dropped),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Exact Cholesky may turn zeros of a sparse matrix into nonzeros, which destroys sparsity. Incomplete Cholesky simply refuses to store those new positions: it computes the same formulas but skips any term whose factor entry is absent. The product L L^T then agrees with A wherever A had a stored value, and the missing positions are the fill that was dropped.",
        invariants: [
            "The factor L is nonzero only where A is nonzero below the diagonal.",
            "On each stored position, the corresponding entry of L L^T equals the entry of A.",
            "Every stored diagonal of L is positive, so the preconditioner stays positive definite.",
        ],
        correctness:
            "For a stored off-diagonal entry (i,j), the update subtracts exactly the sum over stored k of L[i][k] L[j][k] and divides by L[j][j], which enforces sum over k up to j of L[i][k] L[j][k] equals A[i][j]. The diagonal update enforces the analogous sum of squares equals A[i][i]. Because entries outside the pattern are held at zero, those sums ignore fill, and the defining equations hold precisely on the pattern. This makes M = L L^T an exact match to A on its sparsity structure.",
        complexityRationale:
            "Each stored off-diagonal entry needs a short sum over previously stored entries in its row and column, bounded by the largest row width p, so the work is O(n p^2) and often close to O(nnz). Only the stored lower triangle is kept, giving O(nnz) space.",
        uses: [
            "Preconditioning conjugate-gradient solves of sparse SPD systems",
            "Finite-element and finite-difference discretizations of elliptic partial differential equations",
            "Incomplete factorization inside domain-decomposition solvers",
        ],
        references: [
            "Meijerink and van der Vorst, An Iterative Solution Method for Linear Systems, 1977",
            "Saad, Iterative Methods for Sparse Linear Systems, Chapter 10",
        ],
        workedExample:
            "For the four-by-four matrix with unit off-diagonals forming a cycle, L[1][0] = 0.5 and L[2][0] = 0.5, but position (2,1) is outside the pattern so it is never stored. The product L L^T equals A at every stored cell, while the dropped position (2,1) holds about 0.97 instead of zero, which is exactly the fill that was sacrificed.",
    },
    id: "incomplete-cholesky",
    name: "Incomplete Cholesky IC(0)",
    category: "numerical-optimization",
    complexity: { time: "O(n p^2)", space: "O(nnz)" },
    defaultInput: {
        matrix: [
            [4, 1, 1, 0],
            [1, 4, 0, 1],
            [1, 0, 4, 1],
            [0, 1, 1, 4],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "let the stored pattern be the nonzero positions of A",
        "for each row i from zero to n minus one",
        "for each stored column j below the diagonal",
        "set L[i][j] to the residual divided by L[j][j], skipping absent terms",
        "set the diagonal L[i][i] from the remaining row residual",
        "fail if a diagonal residual is not positive",
        "done: report L whose product matches A only on the stored pattern",
    ],
};

export default module;
