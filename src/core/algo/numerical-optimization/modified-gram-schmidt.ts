/**
 * modified-gram-schmidt.ts - Modified Gram-Schmidt Orthonormalization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Modified Gram-Schmidt is a numerically stable reorganization of the
 * classical procedure. Instead of computing all projection coefficients from
 * the untouched input vector, it subtracts each projection immediately and
 * uses the already-updated vector for the next coefficient. The two methods
 * are algebraically identical in exact arithmetic, but the modified form
 * loses far less orthogonality in finite precision on ill-conditioned inputs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) for n vectors in n dimensions
 *   Space: O(n^2) for Q and R
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the orthonormal basis Q as it is updated in place.
 *   - The active sub-step is highlighted while projections are subtracted one at a time.
 *   - meta carries Q, R, and the orthonormality error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function dot(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += (a[i] ?? 0) * (b[i] ?? 0);
    return sum;
}

function norm(a: number[]): number {
    return Math.sqrt(dot(a, a));
}

function flatten(matrix: number[][]): number[] {
    const out: number[] = [];
    for (const row of matrix) for (const value of row) out.push(value);
    return out;
}

function makeCells(q: number[][], done: number, active: number, inner: number): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < q.length; row += 1) {
        for (let col = 0; col < (q[row]?.length ?? 0); col += 1) {
            let state: EntityState = "unvisited";
            if (row === active && inner >= 0) state = "comparing";
            else if (row < done) state = "sorted";
            const value = q[row]?.[col] ?? 0;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: state === "unvisited" ? "" : value.toFixed(3),
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
    const source: number[][] =
        raw.length > 0
            ? raw.map((row) => (Array.isArray(row) ? row.map((v) => Number(v)) : []))
            : [
                  [1, 1, 0],
                  [1, 0, 1],
                  [0, 1, 1],
              ];
    const n = source.length;
    const dim = source[0]?.length ?? n;
    const q: number[][] = source.map((row) => row.slice(0, dim));
    const r: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(q, 0, -1, -1),
        edges: [],
        description: `Modified Gram-Schmidt on ${n} vectors in ${dim} dimensions; projections will be removed one at a time.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: dim, n, q: flatten(q), r: flatten(r), active: -1, orthError: 0 },
    };
    step += 1;

    for (let j = 0; j < n; j += 1) {
        for (let i = 0; i < j; i += 1) {
            r[i]![j] = dot(q[i] as number[], q[j] as number[]);
            q[j] = (q[j] as number[]).map((value, k) => value - (r[i]?.[j] ?? 0) * (q[i]?.[k] ?? 0));
            yield {
                stepNumber: step,
                entities: makeCells(q, j, j, i),
                edges: [],
                description: `Vector ${j}: removed its component along basis row ${i} using the vector as updated so far.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { rows: n, cols: dim, n, q: flatten(q), r: flatten(r), active: j, orthError: 0 },
            };
            step += 1;
        }
        r[j]![j] = norm(q[j] as number[]);
        q[j] = (q[j] as number[]).map((value) => value / (r[j]![j] || 1));
        yield {
            stepNumber: step,
            entities: makeCells(q, j + 1, j, -1),
            edges: [],
            description: `Vector ${j}: normalized the remaining component; its norm is ${(r[j]?.[j] ?? 0).toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: n, cols: dim, n, q: flatten(q), r: flatten(r), active: j, orthError: 0 },
        };
        step += 1;
    }

    let orthError = 0;
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const product = dot(q[i] as number[], q[j] as number[]);
            orthError = Math.max(orthError, Math.abs(product - (i === j ? 1 : 0)));
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(q, n, -1, -1),
        edges: [],
        description: `Orthonormal basis complete; maximum deviation from Q^T Q = I is ${orthError.toExponential(2)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: n, cols: dim, n, q: flatten(q), r: flatten(r), active: -1, orthError, source: flatten(source) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Modified Gram-Schmidt orthogonalizes one vector by peeling off components along each accepted basis direction in sequence, updating the working vector after every removal. Because the next coefficient is measured on the already-reduced vector, rounding errors do not accumulate the way they do when all coefficients are taken from the original vector. It produces the same Q and R on paper but is the form used in practice.",
        invariants: [
            "After removing the component along row i, the working vector is orthogonal to row i.",
            "Each accepted row of Q has unit length once normalized.",
            "The running vector always lies in the span of the original vector and the rows processed so far.",
        ],
        correctness:
            "Removing the projection along an orthonormal row subtracts exactly the component in that direction, leaving a vector orthogonal to it. Because this is done for every accepted row in turn and later coefficients use the reduced vector, the final remainder is orthogonal to all prior rows. Normalizing yields a unit vector, so by induction Q is orthonormal and spans the same subspace as the inputs, and the recorded coefficients give A = Q R with R upper triangular.",
        complexityRationale:
            "Each of the n vectors is projected onto up to n rows with inner products of length n, so the total work is O(n^3). The Q and R matrices occupy O(n^2) space.",
        uses: [
            "Stable QR factorization in production numerical libraries",
            "Orthogonalizing basis vectors in Krylov and iterative solvers",
            "Least-squares and eigenvalue computations requiring reliable orthogonality",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, Chapter 5",
            "Daniel et al., Reorthogonalization and Stable Algorithms, 1968",
        ],
        workedExample:
            "For vectors (1,1,0), (1,0,1), (0,1,1), the first is normalized. For the second, the coefficient along the first row is computed, subtracted immediately, and only then is the coefficient along the next accepted row considered. This sequential update keeps the third vector's orthogonality error smaller than the classical all-at-once version on ill-conditioned data.",
    },
    id: "modified-gram-schmidt",
    name: "Modified Gram-Schmidt",
    category: "numerical-optimization",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        matrix: [
            [1, 1, 0],
            [1, 0, 1],
            [0, 1, 1],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "copy the input vectors into Q and allocate a zero matrix R",
        "for each vector j from zero to n minus one",
        "for each prior basis row i compute R[i][j] as Q[i] dot the current Q[j]",
        "subtract that projection from Q[j] immediately before continuing",
        "set R[j][j] to the norm of Q[j] and divide Q[j] by it",
        "done: report the orthonormal basis Q and the triangular matrix R",
    ],
};

export default module;
