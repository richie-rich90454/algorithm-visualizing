/**
 * gram-schmidt.ts - Classical Gram-Schmidt Orthonormalization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Classical Gram-Schmidt turns a set of linearly independent vectors into an
 * orthonormal basis. For each new vector it computes every projection against
 * the already accepted basis vectors using the ORIGINAL vector, subtracts all
 * of those projections at once, normalizes the remainder, and appends it to the
 * basis. The result is a factorization A = Q R with Q orthonormal and R upper
 * triangular.
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
 *   - Grid cells show the growing orthonormal basis Q row by row.
 *   - The row being processed is highlighted; finished rows are green.
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

function makeCells(q: number[][], done: number, active: number): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < q.length; row += 1) {
        for (let col = 0; col < (q[row]?.length ?? 0); col += 1) {
            let state: EntityState = "unvisited";
            if (row === active) state = "comparing";
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
        entities: makeCells(q, 0, -1),
        edges: [],
        description: `Classical Gram-Schmidt on ${n} vectors in ${dim} dimensions; no basis vector accepted yet.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: dim, n, q: flatten(q), r: flatten(r), active: -1, orthError: 0 },
    };
    step += 1;

    for (let j = 0; j < n; j += 1) {
        const original = (source[j] ?? []).slice(0, dim);
        for (let i = 0; i < j; i += 1) {
            r[i]![j] = dot(q[i] as number[], original);
        }
        const projected = Array.from({ length: dim }, (_, k) => {
            let sum = original[k] ?? 0;
            for (let i = 0; i < j; i += 1) {
                sum -= (r[i]?.[j] ?? 0) * (q[i]?.[k] ?? 0);
            }
            return sum;
        });
        r[j]![j] = norm(projected);
        q[j] = projected.map((value) => value / (r[j]![j] || 1));

        yield {
            stepNumber: step,
            entities: makeCells(q, j + 1, j),
            edges: [],
            description: `Vector ${j}: subtracted all ${j} projection(s) at once from the original, then normalized; norm ${(r[j]?.[j] ?? 0).toFixed(4)}.`,
            codeLineNumber: j === 0 ? 2 : j === n - 1 ? 4 : 3,
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
        entities: makeCells(q, n, -1),
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
            "Classical Gram-Schmidt builds an orthonormal basis one vector at a time. For a new vector it measures how much of each already accepted direction the vector contains, subtracts all of those components in one shot, and rescales what remains to unit length. The amounts subtracted form an upper-triangular matrix R, so the original vectors are recovered as Q times R.",
        invariants: [
            "Every accepted row of Q has unit length.",
            "Accepted rows are mutually orthogonal to the accuracy of floating-point arithmetic.",
            "After j steps those rows span the same space as the first j input vectors.",
        ],
        correctness:
            "Each projection coefficient is the inner product of the original vector with an orthonormal basis row, which is exactly the component along that direction. Subtracting every such component leaves a vector orthogonal to all previous rows. Normalizing makes it unit length, so induction gives an orthonormal basis spanning the same subspace. The record of coefficients gives A = Q R with R upper triangular because vector j only uses rows 0 through j.",
        complexityRationale:
            "For each of n vectors the method takes up to n inner products of length n, costing O(n^3) in total. Q and R each hold n squared entries, so space is O(n^2).",
        uses: [
            "Constructing orthogonal bases for least-squares and projection methods",
            "QR factorization used in eigenvalue algorithms",
            "Preconditioning and orthogonalizing features in numerical linear algebra",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, Chapter 5",
            "Higham, Accuracy and Stability of Numerical Algorithms, Chapter 19",
        ],
        workedExample:
            "For vectors (1,1,0), (1,0,1), (0,1,1), the first is normalized to (1,1,0)/sqrt(2). Projecting the second onto it gives 1/sqrt(2); subtracting leaves (0.5,-0.5,1) which is then normalized. The third is projected against both accepted rows and normalized, yielding three mutually orthogonal unit vectors.",
    },
    id: "gram-schmidt",
    name: "Gram-Schmidt Orthonormalization",
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
        "compute every coefficient R[i][j] as Q[i] dot the original vector j",
        "subtract all coefficients times their basis vectors from the original",
        "set R[j][j] to the norm of the remainder and normalize it into Q[j]",
        "done: report the orthonormal basis Q and the triangular matrix R",
    ],
};

export default module;
