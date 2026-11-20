/**
 * jacobi-eigenvalue-algorithm.ts - Jacobi Eigenvalue Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Jacobi eigenvalue algorithm diagonalizes a real symmetric matrix by
 * repeatedly applying plane rotations that annihilate one off-diagonal entry
 * at a time. Each rotation preserves symmetry and the eigenvalues, and the
 * accumulated rotations give the eigenvectors. Once the off-diagonal entries
 * are driven below tolerance, the diagonal holds the eigenvalues.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(sweeps * n^2) with sweeps typically O(log n) to convergence
 *   Space: O(n^2) for the working matrix and eigenvector matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the working matrix becoming diagonal.
 *   - The two rows and columns mixed by the current rotation are highlighted.
 *   - meta carries the matrix, eigenvectors, eigenvalues, and off-diagonal norm.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function flatten(matrix: number[][]): number[] {
    const out: number[] = [];
    for (const row of matrix) for (const value of row) out.push(value);
    return out;
}

function makeCells(a: number[][], p: number, q: number, done: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < a.length; row += 1) {
        for (let col = 0; col < (a[row]?.length ?? 0); col += 1) {
            let state: EntityState = "unvisited";
            if (!done && (row === p || row === q) && (col === p || col === q)) state = "comparing";
            else if (done && row === col) state = "sorted";
            const value = a[row]?.[col] ?? 0;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: Math.abs(value) < 1e-12 ? "0" : value.toFixed(3),
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

function offDiagonalNorm(a: number[][]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < (a[i]?.length ?? 0); j += 1) {
            if (i !== j) sum += (a[i]?.[j] ?? 0) ** 2;
        }
    }
    return Math.sqrt(sum);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; sweeps?: number; tolerance?: number } | null) ?? {};
    const raw = Array.isArray(task.matrix) ? task.matrix : [];
    const source: number[][] =
        raw.length > 0
            ? raw.map((row) => (Array.isArray(row) ? row.map((v) => Number(v)) : []))
            : [
                  [4, 1, 0],
                  [1, 3, 1],
                  [0, 1, 2],
              ];
    const n = source.length;
    const a: number[][] = source.map((row) => row.slice(0, n));
    const v: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    const maxSweeps = Math.max(1, Math.min(100, Math.floor(Number(task.sweeps ?? 40)) || 40));
    const tolerance = typeof task.tolerance === "number" ? task.tolerance : 1e-12;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(a, -1, -1, false),
        edges: [],
        description: `Jacobi diagonalization of a ${n} by ${n} symmetric matrix; off-diagonal norm ${offDiagonalNorm(a).toExponential(2)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n, n, matrix: flatten(a), vectors: flatten(v), eigenvalues: a.map((row, i) => row[i] ?? 0), offNorm: offDiagonalNorm(a), sweeps: 0 },
    };
    step += 1;

    let converged = false;
    for (let sweep = 0; sweep < maxSweeps && !converged; sweep += 1) {
        for (let p = 0; p < n - 1; p += 1) {
            for (let q = p + 1; q < n; q += 1) {
                const apq = a[p]?.[q] ?? 0;
                if (Math.abs(apq) < 1e-15) {
                    continue;
                }
                const theta = ((a[q]?.[q] ?? 0) - (a[p]?.[p] ?? 0)) / (2 * apq);
                const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(1 + theta * theta));
                const c = 1 / Math.sqrt(1 + t * t);
                const s = t * c;

                for (let k = 0; k < n; k += 1) {
                    if (k === p || k === q) continue;
                    const akp = a[k]?.[p] ?? 0;
                    const akq = a[k]?.[q] ?? 0;
                    a[k]![p] = a[p]![k] = c * akp - s * akq;
                    a[k]![q] = a[q]![k] = s * akp + c * akq;
                }
                a[p]![p] = (a[p]?.[p] ?? 0) - t * apq;
                a[q]![q] = (a[q]?.[q] ?? 0) + t * apq;
                a[p]![q] = a[q]![p] = 0;

                for (let k = 0; k < n; k += 1) {
                    const vkp = v[k]?.[p] ?? 0;
                    const vkq = v[k]?.[q] ?? 0;
                    v[k]![p] = c * vkp - s * vkq;
                    v[k]![q] = s * vkp + c * vkq;
                }

                yield {
                    stepNumber: step,
                    entities: makeCells(a, p, q, false),
                    edges: [],
                    description: `Sweep ${sweep + 1}: rotated rows ${p} and ${q} to zero their off-diagonal entry; off-norm ${offDiagonalNorm(a).toExponential(2)}.`,
                    codeLineNumber: 4,
                    layout: "grid",
                    meta: { rows: n, cols: n, n, matrix: flatten(a), vectors: flatten(v), eigenvalues: a.map((row, i) => row[i] ?? 0), offNorm: offDiagonalNorm(a), sweeps: sweep + 1 },
                };
                step += 1;
            }
        }
        converged = offDiagonalNorm(a) < tolerance;
    }

    yield {
        stepNumber: step,
        entities: makeCells(a, -1, -1, true),
        edges: [],
        description: converged
            ? `Diagonalized after ${step - 1} rotation(s); eigenvalues are the diagonal entries.`
            : `Stopped before full convergence; remaining off-diagonal norm ${offDiagonalNorm(a).toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: n, cols: n, n, matrix: flatten(a), vectors: flatten(v), eigenvalues: a.map((row, i) => row[i] ?? 0), offNorm: offDiagonalNorm(a), sweeps: step - 1, converged },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Jacobi's method removes the off-diagonal entries of a symmetric matrix one rotation at a time. Each rotation tilts two coordinate axes so that the coupling between them disappears, and the accumulated tilt reveals the eigenvectors. As the couplings are swept away, the matrix becomes diagonal and the numbers left on the diagonal are the eigenvalues.",
        invariants: [
            "Every rotation preserves symmetry, so the working matrix stays symmetric.",
            "A plane rotation is orthogonal, so eigenvalues and the Frobenius norm are unchanged.",
            "Once an off-diagonal entry is annihilated, later rotations in the same sweep need not revisit it.",
        ],
        correctness:
            "The rotation angle is chosen so that the transformed entry at (p,q) equals zero, which follows from the defining relation between the tangent and the diagonal difference. Because the rotation is orthogonal, A is replaced by J^T A J with the same eigenvalues, and accumulating V as V J keeps A_original times V equal to V times the working matrix. Repeated sweeps drive the sum of squared off-diagonal entries monotonically down; when it vanishes the working matrix is diagonal and its entries are eigenvalues with columns of V as eigenvectors.",
        complexityRationale:
            "One sweep examines about n squared/2 off-diagonal entries and each rotation touches O(n) entries of A and V, costing O(n^3) per sweep in a naive implementation, or O(n^2) per rotation; practical sweeps are few, so the stated bound reflects the per-sweep cost. Storing A and V uses O(n^2) space.",
        uses: [
            "Computing all eigenvalues and eigenvectors of small dense symmetric matrices",
            "Principal component analysis and covariance diagonalization",
            "Seeding bidiagonalization methods in symmetric eigensolvers",
        ],
        references: [
            "Jacobi, Uber ein leichtes Verfahren, 1846",
            "Golub and Van Loan, Matrix Computations, Chapter 8",
        ],
        workedExample:
            "For A = [[1,1],[1,3]] the largest off-diagonal entry is 1. The rotation angle gives tangent about 0.414, cosine about 0.924, and sine about 0.383. Applying the rotation produces a diagonal matrix with entries about 0.586 and 3.414, which are exactly the two eigenvalues, and the accumulated rotation supplies the matching eigenvectors.",
    },
    id: "jacobi-eigenvalue-algorithm",
    name: "Jacobi Eigenvalue Algorithm",
    category: "numerical-optimization",
    complexity: { time: "O(sweeps * n^3)", space: "O(n^2)" },
    defaultInput: {
        matrix: [
            [4, 1, 0],
            [1, 3, 1],
            [0, 1, 2],
        ],
        sweeps: 40,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "copy the symmetric matrix into A and set V to the identity",
        "repeat sweeps until the off-diagonal norm is small",
        "for each pair of indices p less than q",
        "compute the rotation that zeroes entry A[p][q]",
        "apply the rotation to rows and columns p and q of A",
        "apply the same rotation to columns p and q of V",
        "after each sweep measure the remaining off-diagonal norm",
        "done: report the diagonal of A as eigenvalues and columns of V as eigenvectors",
    ],
};

export default module;
