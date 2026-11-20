/**
 * sherman-morrison-formula.ts - Sherman-Morrison Rank-One Inverse Update
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Sherman-Morrison formula computes the inverse of A plus the rank-one
 * matrix u times the transpose of v from the inverse of A alone:
 * (A + u v^T)^-1 = A^-1 - A^-1 u v^T A^-1 / (1 + v^T A^-1 u).
 * It turns a fresh O(n^3) inversion into a handful of matrix-vector products
 * and one outer product, which is valuable when a model is updated one
 * observation at a time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) for the initial inverse, then O(n^2) for the update
 *   Space: O(n^2) for the matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the inverse matrix before and after the rank-one update.
 *   - The caption reports the scalar denominator and the verification error.
 *   - meta carries the original inverse, the updated inverse, and the error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function flatten(matrix: number[][]): number[] {
    const out: number[] = [];
    for (const row of matrix) for (const value of row) out.push(value);
    return out;
}

/** Invert a small square matrix by Gauss-Jordan elimination. */
function inverse(a: number[][]): number[][] | null {
    const n = a.length;
    const aug = a.map((row, i) => [
        ...row,
        ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    ]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(aug[r]?.[col] ?? 0) > Math.abs(aug[pivot]?.[col] ?? 0)) pivot = r;
        }
        const tmp = aug[col] as number[];
        aug[col] = aug[pivot] as number[];
        aug[pivot] = tmp;
        const d = aug[col]?.[col] ?? 0;
        if (Math.abs(d) < 1e-12) {
            return null;
        }
        for (let c = 0; c < 2 * n; c += 1) aug[col]![c] = (aug[col]![c] ?? 0) / d;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const factor = aug[r]?.[col] ?? 0;
            for (let c = 0; c < 2 * n; c += 1) aug[r]![c] = (aug[r]![c] ?? 0) - factor * (aug[col]![c] ?? 0);
        }
    }
    return aug.map((row) => row.slice(n));
}

function matVec(a: number[][], x: number[]): number[] {
    return a.map((row) => row.reduce((sum, value, j) => sum + value * (x[j] ?? 0), 0));
}

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
}

function makeCells(matrix: number[][], done: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < (matrix[row]?.length ?? 0); col += 1) {
            const value = matrix[row]?.[col] ?? 0;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: value.toFixed(3),
                value,
                state: done ? "sorted" : "active",
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
    const task = (input as { matrix?: number[][]; u?: number[]; v?: number[] } | null) ?? {};
    const raw = Array.isArray(task.matrix) ? task.matrix : [];
    const matrix: number[][] =
        raw.length > 0
            ? raw.map((row) => (Array.isArray(row) ? row.map((value) => Number(value)) : []))
            : [
                  [4, 1],
                  [1, 3],
              ];
    const n = matrix.length;
    const u: number[] = Array.isArray(task.u) && task.u.length === n ? task.u.map(Number) : [1, 0].slice(0, n);
    const v: number[] = Array.isArray(task.v) && task.v.length === n ? task.v.map(Number) : [0, 1].slice(0, n);

    const aInv = inverse(matrix);
    if (aInv === null) {
        yield {
            stepNumber: 0,
            entities: makeCells(matrix, false),
            edges: [],
            description: "The base matrix is singular, so its inverse and the rank-one update do not exist.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: n, cols: n, n, inverse: [], updated: [], denominator: 0, error: 0, singular: true },
        };
        return;
    }

    yield {
        stepNumber: 0,
        entities: makeCells(aInv, false),
        edges: [],
        description: `Computed the inverse of the ${n} by ${n} base matrix; now applying the rank-one update u v^T.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: n, cols: n, n, inverse: flatten(aInv), updated: flatten(aInv), denominator: 0, error: 0, singular: false },
    };

    const aInvU = matVec(aInv, u);
    const vAInv = Array.from({ length: n }, (_, j) =>
        aInv.reduce((sum, row, i) => sum + (v[i] ?? 0) * (row[j] ?? 0), 0),
    );
    const denominator = 1 + dot(v, aInvU);

    yield {
        stepNumber: 1,
        entities: makeCells(aInv, false),
        edges: [],
        description: `Formed A^-1 u, v^T A^-1, and the denominator 1 + v^T A^-1 u = ${denominator.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: n, cols: n, n, inverse: flatten(aInv), updated: flatten(aInv), denominator, error: 0, singular: false },
    };

    if (Math.abs(denominator) < 1e-12) {
        yield {
            stepNumber: 2,
            entities: makeCells(aInv, true),
            edges: [],
            description: "The denominator is zero, so A plus u v^T is singular and has no inverse.",
            codeLineNumber: 4,
            layout: "grid",
            meta: { rows: n, cols: n, n, inverse: flatten(aInv), updated: flatten(aInv), denominator, error: 0, singular: true },
        };
        return;
    }

    const updated = aInv.map((row, i) =>
        row.map((value, j) => value - ((aInvU[i] ?? 0) * (vAInv[j] ?? 0)) / denominator),
    );
    let error = 0;
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let product = 0;
            for (let k = 0; k < n; k += 1) {
                const perturbed = (matrix[i]?.[k] ?? 0) + (u[i] ?? 0) * (v[k] ?? 0);
                product += perturbed * (updated[k]?.[j] ?? 0);
            }
            error = Math.max(error, Math.abs(product - (i === j ? 1 : 0)));
        }
    }

    yield {
        stepNumber: 2,
        entities: makeCells(updated, true),
        edges: [],
        description: `Updated inverse satisfies (A + u v^T) times itself equals I with maximum error ${error.toExponential(2)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: n, cols: n, n, inverse: flatten(aInv), updated: flatten(updated), denominator, error, singular: false },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When a matrix changes by adding a rank-one outer product, its inverse does not need to be recomputed from scratch. The Sherman-Morrison formula corrects the old inverse by subtracting a scaled outer product built from the two update vectors. A single scalar denominator decides whether the new matrix is invertible, making the update far cheaper than a fresh inversion.",
        invariants: [
            "The denominator 1 + v^T A^-1 u is nonzero exactly when the updated matrix is invertible.",
            "The original inverse is left untouched while the correction is formed.",
            "If u and v are zero the correction vanishes and the inverse is unchanged.",
        ],
        correctness:
            "Multiplying A + u v^T by the proposed inverse expands to A A^-1 minus A A^-1 u v^T A^-1 over the denominator plus u v^T A^-1 minus u v^T A^-1 u v^T A^-1 over the denominator. The middle two terms cancel, leaving I plus a factor of u v^T A^-1 multiplied by (1 - (1 + v^T A^-1 u) over the denominator), which is zero. Therefore the product is the identity, so the expression is the inverse whenever the denominator is nonzero.",
        complexityRationale:
            "Inverting the base matrix costs O(n^3) once. Each subsequent update needs two matrix-vector products and one outer product, all O(n^2), and stores a few n by n matrices for O(n^2) space.",
        uses: [
            "Recursive least squares and online model updating",
            "Low-rank corrections in optimization and quasi-Newton methods",
            "Efficient recomputation of inverses after a single observation",
        ],
        references: [
            "Sherman and Morrison, Adjustment of an Inverse Matrix, 1950",
            "Golub and Van Loan, Matrix Computations, Chapter 2",
        ],
        workedExample:
            "For A = [[4,1],[1,3]] with u = [1,0] and v = [0,1], the inverse of A is [[0.3,-0.1],[-0.1,0.4]] divided appropriately. The denominator 1 + v^T A^-1 u equals 1.1, and subtracting the scaled outer product gives the exact inverse of [[4,2],[1,3]], verified by multiplying the two matrices to obtain the identity.",
    },
    id: "sherman-morrison-formula",
    name: "Sherman-Morrison Formula",
    category: "numerical-optimization",
    complexity: { time: "O(n^3) initial, O(n^2) update", space: "O(n^2)" },
    defaultInput: {
        matrix: [
            [4, 1],
            [1, 3],
        ],
        u: [1, 0],
        v: [0, 1],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the inverse of the base matrix A",
        "form the vector A inverse times u",
        "form the row vector v transpose times A inverse",
        "compute the denominator one plus v dot A inverse times u",
        "if the denominator is zero report that the update is singular",
        "subtract the outer product divided by the denominator from A inverse",
        "done: report the updated inverse and its verification error",
    ],
};

export default module;
