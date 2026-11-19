/**
 * qr-algorithm.ts - QR Algorithm for Eigenvalues
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The QR algorithm computes eigenvalues by repeated factorization. At each
 * step the current matrix is factored as Q R and the next iterate is R Q,
 * which is an orthogonal similarity transform and therefore preserves the
 * eigenvalues. For a symmetric matrix the iterates converge to a diagonal
 * matrix whose entries are the eigenvalues; accumulating the Q factors gives
 * the eigenvectors. This is the foundation of modern dense eigensolvers.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^3) using Householder QR per step
 *   Space: O(n^2) for the iterate and accumulated eigenvectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the iterate converging toward diagonal form.
 *   - The caption reports the shrinking off-diagonal norm.
 *   - meta carries the iterate, eigenvalue estimates, and iteration count.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function flatten(matrix: number[][]): number[] {
    const out: number[] = [];
    for (const row of matrix) for (const value of row) out.push(value);
    return out;
}

function multiply(a: number[][], b: number[][]): number[][] {
    const n = a.length;
    return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => {
            let sum = 0;
            for (let k = 0; k < n; k += 1) sum += (a[i]?.[k] ?? 0) * (b[k]?.[j] ?? 0);
            return sum;
        }),
    );
}

/** Householder QR factorization of a square matrix. */
function qr(a: number[][]): { q: number[][]; r: number[][] } {
    const n = a.length;
    const r = a.map((row) => [...row]);
    const q: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    for (let k = 0; k < n; k += 1) {
        let normX = 0;
        for (let i = k; i < n; i += 1) normX += (r[i]?.[k] ?? 0) ** 2;
        normX = Math.sqrt(normX);
        if (normX < 1e-14) {
            continue;
        }
        const alpha = (r[k]?.[k] ?? 0) >= 0 ? -normX : normX;
        const v: number[] = Array.from({ length: n }, () => 0);
        for (let i = k; i < n; i += 1) v[i] = r[i]?.[k] ?? 0;
        v[k] = (v[k] ?? 0) - alpha;
        let vNorm2 = 0;
        for (let i = k; i < n; i += 1) vNorm2 += (v[i] ?? 0) ** 2;
        if (vNorm2 < 1e-14) {
            continue;
        }
        for (let j = k; j < n; j += 1) {
            let d = 0;
            for (let i = k; i < n; i += 1) d += (v[i] ?? 0) * (r[i]?.[j] ?? 0);
            const f = (2 * d) / vNorm2;
            for (let i = k; i < n; i += 1) r[i]![j] = (r[i]?.[j] ?? 0) - f * (v[i] ?? 0);
        }
        for (let j = 0; j < n; j += 1) {
            let d = 0;
            for (let i = k; i < n; i += 1) d += (v[i] ?? 0) * (q[j]?.[i] ?? 0);
            const f = (2 * d) / vNorm2;
            for (let i = k; i < n; i += 1) q[j]![i] = (q[j]?.[i] ?? 0) - f * (v[i] ?? 0);
        }
    }
    return { q, r };
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

function makeCells(a: number[][], done: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < a.length; row += 1) {
        for (let col = 0; col < (a[row]?.length ?? 0); col += 1) {
            const value = a[row]?.[col] ?? 0;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: Math.abs(value) < 1e-12 ? "0" : value.toFixed(3),
                value,
                state: done && row === col ? "sorted" : "active",
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
    const task = (input as { matrix?: number[][]; iterations?: number; tolerance?: number } | null) ?? {};
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
    const maxIter = Math.max(1, Math.min(2000, Math.floor(Number(task.iterations ?? 120)) || 120));
    const tolerance = typeof task.tolerance === "number" ? task.tolerance : 1e-10;
    let a = source.map((row) => row.slice(0, n));
    let v: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(a, false),
        edges: [],
        description: `QR iteration on a ${n} by ${n} matrix; off-diagonal norm ${offDiagonalNorm(a).toExponential(2)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n, n, matrix: flatten(a), eigenvalues: a.map((row, i) => row[i] ?? 0), vectors: flatten(v), offNorm: offDiagonalNorm(a), iteration: 0 },
    };
    step += 1;

    let converged = false;
    for (let iteration = 1; iteration <= maxIter; iteration += 1) {
        // Wilkinson shift: eigenvalue of the bottom 2 by 2 block closest to the last diagonal entry.
        let shift = a[n - 1]?.[n - 1] ?? 0;
        if (n >= 2) {
            const bottomRight = a[n - 1]?.[n - 1] ?? 0;
            const off = a[n - 1]?.[n - 2] ?? 0;
            const d = ((a[n - 2]?.[n - 2] ?? 0) - bottomRight) / 2;
            const s = Math.hypot(d, off);
            if (s >= 1e-14) {
                shift = bottomRight - (off * off) / (d + (d >= 0 ? s : -s));
            }
        }
        const shifted = a.map((row, i) => row.map((value, j) => value - (i === j ? shift : 0)));
        const { q, r } = qr(shifted);
        a = multiply(r, q).map((row, i) => row.map((value, j) => value + (i === j ? shift : 0)));
        v = multiply(v, q);
        const offNorm = offDiagonalNorm(a);
        converged = offNorm < tolerance;

        yield {
            stepNumber: step,
            entities: makeCells(a, converged),
            edges: [],
            description: `Iteration ${iteration}: Wilkinson shift ${shift.toFixed(3)}, factored the shifted matrix as Q R, and formed R Q plus the shift; off-norm ${offNorm.toExponential(2)}.`,
            codeLineNumber: converged ? 5 : 3,
            layout: "grid",
            meta: { rows: n, cols: n, n, matrix: flatten(a), eigenvalues: a.map((row, i) => row[i] ?? 0), vectors: flatten(v), offNorm, iteration, converged },
        };
        step += 1;
        if (converged) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(a, true),
        edges: [],
        description: converged
            ? `Converged after ${step - 2} iteration(s); the diagonal entries are the eigenvalues.`
            : `Stopped after ${maxIter} iteration(s) before full convergence; off-diagonal norm ${offDiagonalNorm(a).toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: n, cols: n, n, matrix: flatten(a), eigenvalues: a.map((row, i) => row[i] ?? 0), vectors: flatten(v), offNorm: offDiagonalNorm(a), iteration: step - 2, converged },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The QR algorithm repeatedly factors the current matrix into an orthogonal part and an upper-triangular part, then multiplies them back in the opposite order. That reversal is an orthogonal similarity transform, so it leaves eigenvalues untouched while gradually pushing the off-diagonal entries toward zero. The diagonal that remains is the spectrum, and the product of the orthogonal factors gives the eigenvectors.",
        invariants: [
            "Each R Q step is an orthogonal similarity transform, so eigenvalues are preserved exactly.",
            "For a symmetric input, symmetry is preserved at every iteration.",
            "The sum of the diagonal entries, the trace, is unchanged from iteration to iteration.",
        ],
        correctness:
            "If A equals Q R then R Q equals Q transpose times A times Q, which is similar to A and has the same eigenvalues. Repeated application drives a symmetric matrix toward diagonal form because the subspaces associated with the largest eigenvalues are mapped toward the coordinate axes; in the limit the diagonal holds the eigenvalues. Accumulating V as the product of the Q factors gives A_original times V equals V times the final matrix, so the columns of V are eigenvectors.",
        complexityRationale:
            "Each iteration needs one Householder QR factorization costing O(n^3) and two matrix products also O(n^3), so the total is O(iterations * n^3). The current iterate and the accumulated eigenvector matrix use O(n^2) space.",
        uses: [
            "Computing the full spectrum of dense symmetric and nonsymmetric matrices",
            "Principal component analysis through covariance diagonalization",
            "The eigenvalue core of numerical libraries such as LAPACK",
        ],
        references: [
            "Francis, The QR Transformation, 1961",
            "Golub and Van Loan, Matrix Computations, Chapter 8",
        ],
        workedExample:
            "For the symmetric matrix [[4,1],[1,3]], the first QR factorization gives an orthogonal Q and triangular R; forming R Q produces a matrix with a smaller off-diagonal entry of about 0.1. Repeating the step a few more times makes the off-diagonal negligible, leaving diagonal entries near 4.618 and 2.382, the two eigenvalues.",
    },
    id: "qr-algorithm",
    name: "QR Algorithm (Eigenvalues)",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^3)", space: "O(n^2)" },
    defaultInput: {
        matrix: [
            [4, 1, 0],
            [1, 3, 1],
            [0, 1, 2],
        ],
        iterations: 120,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "set the iterate A to the input matrix and V to the identity",
        "for each iteration up to the budget",
        "choose a Wilkinson shift from the bottom two by two block",
        "factor the shifted matrix as Q times R using Householder reflectors",
        "replace A by R times Q plus the shift",
        "accumulate the eigenvector matrix as V times Q",
        "measure the off-diagonal norm and test convergence",
        "done: report the diagonal of A as eigenvalues and columns of V as eigenvectors",
    ],
};

export default module;
