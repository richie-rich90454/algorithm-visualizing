/**
 * ldl-decomposition.ts - LDL^T Factorization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * LDL^T factors a symmetric matrix A into a unit lower-triangular matrix L,
 * a diagonal matrix D, and the transpose of L, so A = L D L^T. It is the
 * square-root-free cousin of Cholesky: it also works for symmetric indefinite
 * matrices as long as no leading pivot vanishes. Each column of L and the
 * matching diagonal entry of D are computed together from earlier columns.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) for an n by n matrix
 *   Space: O(n^2) for the factor L and the diagonal D
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show L below the diagonal, D on it, and zero above it.
 *   - The pivot being computed is gold; finished entries turn green.
 *   - meta carries L, D, the original matrix, and the reconstruction error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function flatten(matrix: number[][]): number[] {
    const out: number[] = [];
    for (const row of matrix) for (const value of row) out.push(value);
    return out;
}

/** Build grid cells from the current lower factor and diagonal. */
function makeCells(
    lower: number[][],
    diagonal: number[],
    computed: boolean[][],
    pivot: [number, number] | null,
): VisualEntity[] {
    const n = lower.length;
    const cells: VisualEntity[] = [];
    for (let row = 0; row < n; row += 1) {
        for (let col = 0; col < n; col += 1) {
            const isPivot = pivot !== null && pivot[0] === row && pivot[1] === col;
            const isComputed = computed[row]?.[col] === true;
            let state: EntityState = "unvisited";
            if (isPivot) {
                state = "comparing";
            } else if (isComputed) {
                state = "sorted";
            }
            const value = col < row ? (lower[row]?.[col] ?? 0) : col === row ? (diagonal[row] ?? 0) : 0;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: col <= row ? value.toFixed(3) : "",
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][] } | null) ?? {};
    const raw = Array.isArray(task.matrix) ? task.matrix : [];
    const matrix: number[][] =
        raw.length > 0
            ? raw.map((row) => (Array.isArray(row) ? row.map((v) => Number(v)) : []))
            : [
                  [4, 1, 0],
                  [1, 3, 1],
                  [0, 1, 2],
              ];
    const n = matrix.length;
    const lower: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    const diagonal: number[] = Array.from({ length: n }, () => 0);
    const computed: boolean[][] = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => false),
    );

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(lower, diagonal, computed, null),
        edges: [],
        description: `Factoring a ${n} by ${n} symmetric matrix as L times D times L transpose.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: n,
            cols: n,
            n,
            matrix: flatten(matrix),
            lower: flatten(lower),
            diagonal: diagonal.slice(),
            maxError: 0,
            failed: false,
        },
    };
    step += 1;

    let failed = false;
    for (let col = 0; col < n && !failed; col += 1) {
        let pivot = matrix[col]?.[col] ?? 0;
        for (let k = 0; k < col; k += 1) {
            const lck = lower[col]?.[k] ?? 0;
            pivot -= lck * lck * (diagonal[k] ?? 0);
        }
        if (Math.abs(pivot) < 1e-12) {
            failed = true;
            yield {
                stepNumber: step,
                entities: makeCells(lower, diagonal, computed, [col, col]),
                edges: [],
                description: `Pivot D[${col}] is nearly zero, so this leading minor is singular; LDL^T without pivoting fails.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: {
                    rows: n,
                    cols: n,
                    n,
                    matrix: flatten(matrix),
                    lower: flatten(lower),
                    diagonal: diagonal.slice(),
                    maxError: 0,
                    failed: true,
                },
            };
            step += 1;
            break;
        }
        diagonal[col] = pivot;
        computed[col]![col] = true;
        yield {
            stepNumber: step,
            entities: makeCells(lower, diagonal, computed, [col, col]),
            edges: [],
            description: `Pivot D[${col}] = ${pivot.toFixed(4)} after subtracting earlier column contributions.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: n,
                cols: n,
                n,
                matrix: flatten(matrix),
                lower: flatten(lower),
                diagonal: diagonal.slice(),
                maxError: 0,
                failed: false,
            },
        };
        step += 1;

        for (let row = col + 1; row < n; row += 1) {
            let sum = matrix[row]?.[col] ?? 0;
            for (let k = 0; k < col; k += 1) {
                sum -= (lower[row]?.[k] ?? 0) * (diagonal[k] ?? 0) * (lower[col]?.[k] ?? 0);
            }
            lower[row]![col] = sum / pivot;
            computed[row]![col] = true;
            yield {
                stepNumber: step,
                entities: makeCells(lower, diagonal, computed, [row, col]),
                edges: [],
                description: `Solve L[${row}][${col}] = ${(lower[row]?.[col] ?? 0).toFixed(4)} by dividing the residual by pivot D[${col}].`,
                codeLineNumber: 4,
                layout: "grid",
                meta: {
                    rows: n,
                    cols: n,
                    n,
                    matrix: flatten(matrix),
                    lower: flatten(lower),
                    diagonal: diagonal.slice(),
                    maxError: 0,
                    failed: false,
                },
            };
            step += 1;
        }
    }

    let maxError = 0;
    if (!failed) {
        for (let row = 0; row < n; row += 1) {
            for (let col = 0; col < n; col += 1) {
                let reconstructed = 0;
                const limit = Math.min(row, col);
                for (let k = 0; k <= limit; k += 1) {
                    const lr = k === row ? 1 : (lower[row]?.[k] ?? 0);
                    const lc = k === col ? 1 : (lower[col]?.[k] ?? 0);
                    reconstructed += lr * (diagonal[k] ?? 0) * lc;
                }
                maxError = Math.max(maxError, Math.abs(reconstructed - (matrix[row]?.[col] ?? 0)));
            }
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(lower, diagonal, computed, null),
        edges: [],
        description: failed
            ? `Factorization failed at a zero pivot.`
            : `Factorization complete: A = L D L^T with maximum entry error ${maxError.toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: n,
            cols: n,
            n,
            matrix: flatten(matrix),
            lower: flatten(lower),
            diagonal: diagonal.slice(),
            maxError,
            failed,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "LDL^T splits a symmetric matrix into a unit triangle, a diagonal, and the mirrored triangle. It is Cholesky with the square roots removed, so it can handle symmetric matrices that are indefinite. Each new column of L is computed from the columns already finished, making the factorization a clean left-to-right sweep.",
        invariants: [
            "L is unit lower triangular, so its diagonal is implicitly one and is stored in D instead.",
            "After finishing column j, the leading (j+1) by (j+1) block of L D L^T equals that block of A.",
            "Every computed pivot D[j] is nonzero, otherwise the sweep stops.",
        ],
        correctness:
            "For each column j the algorithm enforces the defining sum A[i][j] = sum over k up to j of L[i][k] D[k] L[j][k]. Setting i = j solves for the pivot D[j] as the diagonal residual; setting i > j then solves linearly for L[i][j] because L[j][j] = 1 and D[j] is already known. Induction over columns shows every entry equation holds, hence A = L D L^T. A zero pivot means the leading minor is singular and no pivoting-free factorization exists.",
        complexityRationale:
            "There are about n squared/2 entries to compute, each needing a dot product of up to n terms, so the time is O(n^3). The lower triangle and the diagonal together use O(n^2) storage.",
        uses: [
            "Solving symmetric indefinite linear systems without square roots",
            "Quadratic form analysis in optimization and statistics",
            "Block LDL solvers in sparse direct linear algebra packages",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, Chapter 4",
            "Higham, Accuracy and Stability of Numerical Algorithms, Chapter 11",
        ],
        workedExample:
            "For A = [[4,1],[1,3]] the first pivot is D[0] = 4 and L[1][0] = 1/4. The second pivot is D[1] = 3 - (1/4)^2 * 4 = 2.75. Multiplying L = [[1,0],[0.25,1]] by D = diag(4,2.75) by L transpose recovers A exactly.",
    },
    id: "ldl-decomposition",
    name: "LDL^T Decomposition",
    category: "numerical-optimization",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        matrix: [
            [4, 1, 0],
            [1, 3, 1],
            [0, 1, 2],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "allocate a zero lower triangle L and a zero diagonal D",
        "for each column j from zero to n minus one",
        "set D[j] to A[j][j] minus earlier L[j][k] squared times D[k]",
        "fail if the pivot D[j] is nearly zero",
        "for each row i below j set L[i][j] to the residual divided by D[j]",
        "the residual is A[i][j] minus earlier L[i][k] D[k] L[j][k]",
        "advance to the next column",
        "done: report L and D so that A equals L D L transpose",
    ],
};

export default module;
