/**
 * givens-rotation.ts - Givens Rotation QR Factorization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Givens rotation factors a matrix as A = Q R by applying a sequence of plane
 * rotations that zero out one entry below the diagonal at a time. Each rotation
 * mixes just two rows, which makes the method attractive for sparse matrices
 * and parallel hardware where only a few entries change per step. The rotations
 * are accumulated into the orthogonal matrix Q.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) for an n by n matrix
 *   Space: O(n^2) for Q and R
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show R becoming upper triangular one entry at a time.
 *   - The two rows mixed by the current rotation are highlighted.
 *   - meta carries Q, R, and the factorization error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function flatten(matrix: number[][]): number[] {
    const out: number[] = [];
    for (const row of matrix) for (const value of row) out.push(value);
    return out;
}

function makeCells(r: number[][], pivotRow: number, pivotCol: number, done: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < r.length; row += 1) {
        for (let col = 0; col < (r[row]?.length ?? 0); col += 1) {
            let state: EntityState = "unvisited";
            if (!done && (row === pivotRow || row === pivotCol) && col === pivotCol) state = "comparing";
            else if (col >= row) state = done ? "sorted" : "idle";
            const value = r[row]?.[col] ?? 0;
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

function factorizationError(a: number[][], q: number[][], r: number[][]): number {
    const n = a.length;
    let worst = 0;
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let qr = 0;
            let qtq = 0;
            for (let k = 0; k < n; k += 1) {
                qr += (q[i]?.[k] ?? 0) * (r[k]?.[j] ?? 0);
                qtq += (q[k]?.[i] ?? 0) * (q[k]?.[j] ?? 0);
            }
            worst = Math.max(worst, Math.abs(qr - (a[i]?.[j] ?? 0)), Math.abs(qtq - (i === j ? 1 : 0)));
        }
    }
    return worst;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][] } | null) ?? {};
    const raw = Array.isArray(task.matrix) ? task.matrix : [];
    const source: number[][] =
        raw.length > 0
            ? raw.map((row) => (Array.isArray(row) ? row.map((v) => Number(v)) : []))
            : [
                  [12, -51, 4],
                  [6, 167, -68],
                  [-4, 24, -41],
              ];
    const n = source.length;
    const r: number[][] = source.map((row) => row.slice(0, n));
    const q: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(r, -1, -1, false),
        edges: [],
        description: `Givens QR on a ${n} by ${n} matrix; R begins as A and Q as the identity.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n, n, r: flatten(r), q: flatten(q), error: 0 },
    };
    step += 1;

    for (let col = 0; col < n; col += 1) {
        for (let row = n - 1; row > col; row -= 1) {
            const a = r[col]?.[col] ?? 0;
            const b = r[row]?.[col] ?? 0;
            if (Math.abs(b) < 1e-14) {
                continue;
            }
            const radius = Math.hypot(a, b);
            const c = a / radius;
            const s = -b / radius;
            for (let k = col; k < n; k += 1) {
                const rj = r[col]?.[k] ?? 0;
                const ri = r[row]?.[k] ?? 0;
                r[col]![k] = c * rj - s * ri;
                r[row]![k] = s * rj + c * ri;
            }
            for (let k = 0; k < n; k += 1) {
                const qj = q[k]?.[col] ?? 0;
                const qi = q[k]?.[row] ?? 0;
                q[k]![col] = c * qj - s * qi;
                q[k]![row] = s * qj + c * qi;
            }
            yield {
                stepNumber: step,
                entities: makeCells(r, row, col, false),
                edges: [],
                description: `Rotated rows ${col} and ${row} with c = ${c.toFixed(3)}, s = ${s.toFixed(3)}; entry (${row}, ${col}) is now zero.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { rows: n, cols: n, n, r: flatten(r), q: flatten(q), error: 0 },
            };
            step += 1;
        }
    }

    const error = factorizationError(source, q, r);
    yield {
        stepNumber: step,
        entities: makeCells(r, -1, -1, true),
        edges: [],
        description: `Factorization complete: A = Q R and Q is orthogonal, with maximum error ${error.toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: n, cols: n, n, r: flatten(r), q: flatten(q), error },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Givens rotation is a rotation in the plane of two coordinate axes chosen so that one chosen entry becomes zero. Applying a sequence of these tiny rotations clears every entry below the diagonal of a matrix, leaving an upper-triangular R. Multiplying the same rotations into an accumulating matrix builds Q, and because rotations preserve lengths Q is orthogonal.",
        invariants: [
            "Each rotation leaves the already cleared entries of earlier columns untouched.",
            "Q stays orthogonal because it is a product of plane rotations.",
            "The number of below-diagonal nonzeros strictly decreases with each nontrivial rotation.",
        ],
        correctness:
            "A plane rotation with c squared plus s squared equal to one is orthogonal, so left-multiplying R by it preserves the product Q R when Q is updated on the right by its transpose. Choosing c = a over the radius and s = minus b over the radius makes the rotated second entry s a plus c b equal to zero while replacing the first by the radius. Clearing columns from left to right never reintroduces nonzeros in earlier columns, so the final R is upper triangular and A = Q R.",
        complexityRationale:
            "There are about n squared/2 below-diagonal entries, and clearing each touches two full rows of R and two columns of Q, costing O(n) each, for O(n^3) total time. Q and R each use O(n^2) space.",
        uses: [
            "QR factorization of sparse matrices where only a few rows interact",
            "Parallel and GPU linear algebra with local row rotations",
            "Least-squares solving and eigenvalue iteration in numerical libraries",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, Chapter 5",
            "Higham, Accuracy and Stability of Numerical Algorithms, Chapter 19",
        ],
        workedExample:
            "For the 2 by 2 matrix [[3,1],[4,2]], the entry 4 below the diagonal is cleared with radius 5, c = 3/5, and s = -4/5. Rotating the rows gives R with a zero in position (1,0) and diagonal entry 5. Applying the same rotation to the columns of the identity builds Q so that Q times R recovers the original matrix.",
    },
    id: "givens-rotation",
    name: "Givens Rotation QR",
    category: "numerical-optimization",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        matrix: [
            [12, -51, 4],
            [6, 167, -68],
            [-4, 24, -41],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "set R to A and Q to the identity matrix",
        "for each column from zero to n minus one",
        "for each row below the diagonal from the bottom up",
        "form the rotation that clears R[row][column]",
        "apply the rotation to rows column and row of R",
        "apply the transpose rotation to columns column and row of Q",
        "done: report the upper-triangular R and orthogonal Q with A equal to Q R",
    ],
};

export default module;
