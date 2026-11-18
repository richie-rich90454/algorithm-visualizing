/**
 * householder-qr.ts - Householder QR Decomposition
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Householder QR factors a real matrix A into an orthogonal matrix Q and an
 * upper triangular matrix R with A = Q R. For each column it builds a reflection
 * that maps the subcolumn below the diagonal onto a multiple of the first basis
 * vector, zeroing everything beneath the diagonal entry. Applying the same
 * reflections to the identity matrix accumulates Q. Householder reflections
 * are numerically stable and are the standard dense QR method.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m n^2) for an m by n matrix with m >= n
 *   Space: O(m^2 + m n) for Q and R
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows R on the left, a spacer, and Q on the right.
 *   - The column being reflected is yellow in both R and Q.
 *   - The final frame is green and reports the reconstruction error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    rMatrix: number[][],
    qMatrix: number[][],
    rows: number,
    n: number,
    activeColumn = -1,
    finalState = false,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const value = rMatrix[i]?.[j] ?? 0;
            entities.push({
                id: `cell-r-${i}-${j}`,
                type: "cell",
                label: value.toFixed(3),
                value,
                state: finalState ? "sorted" : j === activeColumn ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, part: "R" },
            });
        }
        entities.push({
            id: `cell-spacer-${i}`,
            type: "cell",
            label: "",
            value: 0,
            state: "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: i, col: n, part: "spacer" },
        });
        for (let j = 0; j < rows; j += 1) {
            const value = qMatrix[i]?.[j] ?? 0;
            entities.push({
                id: `cell-q-${i}-${j}`,
                type: "cell",
                label: value.toFixed(3),
                value,
                state: finalState ? "sorted" : j < n && j === activeColumn ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: n + 1 + j, part: "Q" },
            });
        }
    }
    return entities;
}

/** Maximum absolute entry of A - Q R. */
function reconstructionError(a: number[][], q: number[][], r: number[][], rows: number, n: number): number {
    let worst = 0;
    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let sum = 0;
            for (let k = 0; k < rows; k += 1) sum += (q[i]?.[k] ?? 0) * (r[k]?.[j] ?? 0);
            worst = Math.max(worst, Math.abs(sum - (a[i]?.[j] ?? 0)));
        }
    }
    return worst;
}

/** Maximum absolute entry of Q transpose times Q minus the identity. */
function orthogonalityError(q: number[][], rows: number): number {
    let worst = 0;
    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < rows; j += 1) {
            let sum = 0;
            for (let k = 0; k < rows; k += 1) sum += (q[k]?.[i] ?? 0) * (q[k]?.[j] ?? 0);
            worst = Math.max(worst, Math.abs(sum - (i === j ? 1 : 0)));
        }
    }
    return worst;
}

/** Householder QR generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number[][] } | null) ?? {};
    const source = Array.isArray(task.a)
        ? task.a.map((row) => [...row])
        : [
              [12, -51, 4],
              [6, 167, -68],
              [-4, 24, -41],
          ];
    const rows = source.length;
    const n = rows > 0 ? (source[0]?.length ?? 0) : 0;
    const r = source.map((row) => [...row]);
    const q: number[][] = Array.from({ length: rows }, (_, i) =>
        Array.from({ length: rows }, (_, j) => (i === j ? 1 : 0)),
    );
    const cols = n + 1 + rows;
    let step = 0;
    const meta = (column: number, finished: boolean) => ({
        rows,
        cols,
        n,
        column,
        r: r.flat(),
        q: q.flat(),
        reconstructionError: reconstructionError(source, q, r, rows, n),
        orthogonalityError: orthogonalityError(q, rows),
        finished,
    });

    yield {
        stepNumber: step,
        entities: makeCells(r, q, rows, n),
        edges: [],
        description: rows === 0 ? "Empty matrix - nothing to factor." : "Start with R equal to A and Q equal to the identity.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...meta(-1, false), rows: Math.max(1, rows), cols: Math.max(1, cols) },
    };
    step += 1;
    if (rows === 0) return;

    for (let k = 0; k < n; k += 1) {
        const vector: number[] = [];
        for (let i = k; i < rows; i += 1) vector.push(r[i]?.[k] ?? 0);
        const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
        if (norm === 0) continue;
        const sign = (vector[0] ?? 0) >= 0 ? -1 : 1;
        const alpha = sign * norm;
        const v = [...vector];
        v[0] = (v[0] ?? 0) - alpha;
        const vNormSquared = v.reduce((sum, value) => sum + value * value, 0);
        if (vNormSquared === 0) continue;
        const scale = 1 / Math.sqrt(vNormSquared);
        for (let i = 0; i < v.length; i += 1) v[i] = (v[i] ?? 0) * scale;

        for (let j = k; j < n; j += 1) {
            let dot = 0;
            for (let i = k; i < rows; i += 1) dot += (v[i - k] ?? 0) * (r[i]?.[j] ?? 0);
            for (let i = k; i < rows; i += 1) {
                const cell = r[i];
                if (cell) cell[j] = (cell[j] ?? 0) - 2 * (v[i - k] ?? 0) * dot;
            }
        }
        for (let row = 0; row < rows; row += 1) {
            let dot = 0;
            for (let i = k; i < rows; i += 1) dot += (q[row]?.[i] ?? 0) * (v[i - k] ?? 0);
            for (let i = k; i < rows; i += 1) {
                const cell = q[row];
                if (cell) cell[i] = (cell[i] ?? 0) - 2 * dot * (v[i - k] ?? 0);
            }
        }

        yield {
            stepNumber: step,
            entities: makeCells(r, q, rows, n, k),
            edges: [],
            description: `Column ${k}: reflect the subcolumn onto the axis, zeroing entries below the diagonal and updating Q.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { ...meta(k, false), reflector: [...v] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(r, q, rows, n, -1, true),
        edges: [],
        description: `A = Q R with reconstruction error ${reconstructionError(source, q, r, rows, n).toExponential(2)} and Q orthogonal to ${orthogonalityError(q, rows).toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: meta(-1, true),
    };
}

/** The Householder QR module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A reflection is a mirror that flips a vector across a chosen line or plane. For each column, choose the mirror that sends everything below the diagonal straight onto the axis, so those entries become zero. Apply that same mirror to an accumulating identity matrix, and after one reflection per column the matrix is upper triangular and the accumulator is orthogonal.",
        invariants: [
            "A Householder reflector H is symmetric and satisfies H times H equals the identity, so it preserves lengths.",
            "After step k the first k columns of R are zero below the diagonal.",
            "Q stays orthogonal because it is a product of orthogonal reflectors, and A equals Q R throughout up to the reflectors already applied.",
        ],
        correctness:
            "The reflector v is built so that (I - 2 v v transpose) maps the subcolumn x to minus the sign of x0 times its norm times the first basis vector, so the entries below the diagonal become zero. Each reflector is orthogonal, so their product Q is orthogonal. Applying the reflectors to A produces R, and because each reflector is its own inverse, A equals Q R. Inductively one column is zeroed per step, leaving R upper triangular.",
        complexityRationale:
            "For each of the n columns the reflector is applied to the remaining m-k rows and n-k columns of R and to m rows of Q, costing O((m-k)(n-k) + m(m-k)) operations. Summed over k this is O(m n^2) when m is at least n, and storing Q and R uses O(m^2 + m n) space.",
        uses: [
            "Solving least-squares problems stably",
            "A preprocessing step for QR-based eigenvalue algorithms",
            "Orthogonalization in numerical linear algebra libraries",
        ],
        references: [
            "Householder, Unitary Triangularization of a Nonsymmetric Matrix, 1958",
            "Golub and Van Loan, Matrix Computations, Chapter 5",
        ],
        workedExample:
            "For the classic matrix with rows [12, -51, 4], [6, 167, -68], [-4, 24, -41], the first reflector zeroing the first subcolumn yields a new first column near [-14, 0, 0]. After three reflections R is upper triangular with diagonal about -14, -175, -13, and Q times R reconstructs A to machine precision.",
    },
    id: "householder-qr",
    name: "Householder QR Decomposition",
    category: "numerical-optimization",
    complexity: { time: "O(m n^2)", space: "O(m^2 + m n)" },
    defaultInput: {
        a: [
            [12, -51, 4],
            [6, 167, -68],
            [-4, 24, -41],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "set R to A and Q to the identity matrix",
        "for each column k build the reflector from the subcolumn",
        "choose the sign that avoids cancellation in the reflector",
        "apply the reflector to columns k onward of R",
        "apply the same reflector to columns k onward of Q",
        "after all columns R is upper triangular and Q is orthogonal",
        "done: verify A equals Q R",
    ],
};

export default module;
