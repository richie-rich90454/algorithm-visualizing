/**
 * svd-one-sided-jacobi.ts - One-Sided Jacobi Singular Value Decomposition
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The one-sided Jacobi method computes the singular value decomposition of a
 * real matrix by orthogonalizing its columns. Each Jacobi rotation annihilates
 * the inner product between a pair of columns, accumulating the rotations in a
 * right singular vector matrix V. When all column pairs are orthogonal, the
 * column norms are the singular values and the normalized columns are the left
 * singular vectors U, giving A = U Sigma V transpose.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(sweeps * m * n^2) for a matrix with m rows and n columns
 *   Space: O(m * n + n^2) for the working matrix and V
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current column norms (candidate singular values).
 *   - A pair being rotated is yellow; the converged spectrum is green.
 *   - meta carries U, Sigma, V and reconstruction and orthogonality errors.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function column(matrix: number[][], index: number): number[] {
    return matrix.map((row) => row[index] ?? 0);
}

function dot(left: number[], right: number[]): number {
    return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function makeBars(values: number[], state: EntityState, active: Set<number>): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: active.has(index) ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** Compute a thin SVD of a real matrix by one-sided Jacobi rotations. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; sweeps?: number; tolerance?: number } | null) ?? {};
    const source: number[][] =
        Array.isArray(task.matrix) && task.matrix.length > 0 && Array.isArray(task.matrix[0])
            ? task.matrix.map((row) => [...row])
            : [
                  [1, 2],
                  [3, 4],
                  [5, 6],
              ];
    const rows = source.length;
    const cols = source[0]?.length ?? 0;
    const sweeps = typeof task.sweeps === "number" ? Math.max(1, Math.floor(task.sweeps)) : 12;
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-12;

    const B: number[][] = source.map((row) => [...row]);
    const V: number[][] = Array.from({ length: cols }, (_, row) =>
        Array.from({ length: cols }, (_, col) => (row === col ? 1 : 0)),
    );
    const norms = (): number[] => Array.from({ length: cols }, (_, index) => Math.sqrt(dot(column(B, index), column(B, index))));
    const activePair = new Set<number>();

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(norms(), "idle", activePair),
        edges: [],
        description: `Orthogonalizing the columns of a ${rows} by ${cols} matrix with one-sided Jacobi rotations.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { sweep: 0, singularValues: norms(), U: [] as number[], V: V.flat(), rows, cols, reconstructionError: 0, orthogonalityError: 0 },
    };
    step += 1;

    let usedSweeps = 0;
    for (let sweep = 0; sweep < sweeps; sweep += 1) {
        let rotated = false;
        for (let p = 0; p < cols; p += 1) {
            for (let q = p + 1; q < cols; q += 1) {
                const bp = column(B, p);
                const bq = column(B, q);
                const alpha = dot(bp, bp);
                const beta = dot(bq, bq);
                const gamma = dot(bp, bq);
                if (Math.abs(gamma) <= tolerance * Math.sqrt(alpha * beta) || alpha === 0 || beta === 0) {
                    continue;
                }
                const zeta = (beta - alpha) / (2 * gamma);
                const magnitude = Math.sqrt(1 + zeta * zeta);
                const t = zeta === 0 ? 1 : Math.sign(zeta) / (Math.abs(zeta) + magnitude);
                const c = 1 / Math.sqrt(1 + t * t);
                const s = c * t;
                for (let r = 0; r < rows; r += 1) {
                    const left = B[r]![p]!;
                    const right = B[r]![q]!;
                    B[r]![p] = c * left - s * right;
                    B[r]![q] = s * left + c * right;
                }
                for (let r = 0; r < cols; r += 1) {
                    const left = V[r]![p]!;
                    const right = V[r]![q]!;
                    V[r]![p] = c * left - s * right;
                    V[r]![q] = s * left + c * right;
                }
                rotated = true;
                activePair.clear();
                activePair.add(p);
                activePair.add(q);
            }
        }
        usedSweeps = sweep + 1;
        yield {
            stepNumber: step,
            entities: makeBars(norms(), "comparing", activePair),
            edges: [],
            description: `Sweep ${usedSweeps}: rotated column pairs until their inner products vanished.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { sweep: usedSweeps, singularValues: norms(), U: [] as number[], V: V.flat(), rows, cols, reconstructionError: 0, orthogonalityError: 0 },
        };
        step += 1;
        if (!rotated) {
            break;
        }
    }
    activePair.clear();

    const rawNorms = norms();
    const order = Array.from({ length: cols }, (_, index) => index).sort(
        (a, b) => (rawNorms[b] ?? 0) - (rawNorms[a] ?? 0),
    );
    const singular = order.map((index) => rawNorms[index] ?? 0);
    const sortedB: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    const sortedV: number[][] = Array.from({ length: cols }, () => Array.from({ length: cols }, () => 0));
    for (let r = 0; r < rows; r += 1) {
        for (let k = 0; k < cols; k += 1) sortedB[r]![k] = B[r]![order[k]!] ?? 0;
    }
    for (let r = 0; r < cols; r += 1) {
        for (let k = 0; k < cols; k += 1) sortedV[r]![k] = V[r]![order[k]!] ?? 0;
    }
    const U: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    for (let r = 0; r < rows; r += 1) {
        for (let k = 0; k < cols; k += 1) {
            U[r]![k] = singular[k]! > 0 ? (sortedB[r]![k] ?? 0) / singular[k]! : 0;
        }
    }
    let reconstructionError = 0;
    for (let r = 0; r < rows; r += 1) {
        for (let cIndex = 0; cIndex < cols; cIndex += 1) {
            let sum = 0;
            for (let k = 0; k < cols; k += 1) {
                sum += (U[r]![k] ?? 0) * (singular[k] ?? 0) * (sortedV[cIndex]![k] ?? 0);
            }
            reconstructionError = Math.max(reconstructionError, Math.abs(sum - (source[r]![cIndex] ?? 0)));
        }
    }
    let orthogonalityError = 0;
    for (let a = 0; a < cols; a += 1) {
        for (let b = 0; b < cols; b += 1) {
            let sum = 0;
            for (let r = 0; r < cols; r += 1) sum += (sortedV[r]![a] ?? 0) * (sortedV[r]![b] ?? 0);
            orthogonalityError = Math.max(orthogonalityError, Math.abs(sum - (a === b ? 1 : 0)));
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(singular, "sorted", activePair),
        edges: [],
        description: `Converged in ${usedSweeps} sweep(s); singular values [${singular.map((value) => value.toFixed(4)).join(", ")}].`,
        codeLineNumber: 8,
        layout: "array",
        meta: {
            sweep: usedSweeps,
            singularValues: singular,
            U: U.flat(),
            V: sortedV.flat(),
            rows,
            cols,
            reconstructionError,
            orthogonalityError,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The singular vectors of a matrix are directions that the matrix maps to mutually perpendicular outputs. One-sided Jacobi finds them by rotating pairs of columns until their dot product is zero, exactly the way a tilt-wrench straightens a skewed pair of sticks. The amount of rotation is accumulated in V, and the final column lengths are the singular values.",
        invariants: [
            "Every rotation is orthogonal, so the product of all rotations keeps V orthogonal.",
            "Each rotation reduces the sum of squared off-diagonal column inner products.",
            "At convergence the columns are mutually orthogonal and their norms are the singular values.",
        ],
        correctness:
            "A Jacobi rotation zeroes the inner product of the chosen column pair by a planar rotation chosen from the ratio of their norms and inner product. Because the transformation is orthogonal, applying it to both the working matrix and V preserves B equals A times V. When all off-diagonal inner products vanish, B has orthogonal columns, so B transpose B is diagonal; its diagonal entries are the squared singular values and V is the right singular vector matrix. Reconstructing U from the normalized columns gives A equals U Sigma V transpose.",
        complexityRationale:
            "One sweep examines all column pairs and updates two columns of length m for each pair, costing O(m n squared). A small constant number of sweeps is typical, and the working matrix plus V occupy O(m n plus n squared) space.",
        uses: [
            "Computing singular values for principal component analysis",
            "Low-rank matrix approximation and image compression",
            "Numerically robust least squares and pseudoinverse computations",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, Chapter 8",
            "Demmel and Veselic, Jacobi's Method is More Accurate than QR, 1992",
        ],
        workedExample:
            "For the matrix [[1,2],[3,4],[5,6]], the first sweep rotates the two columns so their inner product becomes zero. A few sweeps leave column norms near 9.525 and 0.514, the singular values, and the normalized columns form U while the accumulated rotations form V.",
    },
    id: "svd-one-sided-jacobi",
    name: "One-Sided Jacobi SVD",
    category: "numerical-optimization",
    complexity: { time: "O(sweeps * m * n^2)", space: "O(m*n + n^2)" },
    defaultInput: {
        matrix: [
            [1, 2],
            [3, 4],
            [5, 6],
        ],
        sweeps: 12,
        tolerance: 1e-12,
    },
    visualType: "array",
    run,
    pseudocode: [
        "set the working matrix to A and V to the identity",
        "repeat for a bounded number of sweeps",
        "for every pair of columns compute their norms and inner product",
        "choose a Jacobi rotation that zeroes that inner product",
        "apply the rotation to both columns of the working matrix",
        "apply the same rotation to the corresponding columns of V",
        "stop a sweep early when no pair needed a rotation",
        "set singular values to column norms and U to normalized columns",
        "done: report U, Sigma, V and the reconstruction error",
    ],
};

export default module;
