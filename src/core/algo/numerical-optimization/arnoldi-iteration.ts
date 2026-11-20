/**
 * arnoldi-iteration.ts - Arnoldi Iteration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Arnoldi iteration builds an orthonormal basis Q of the Krylov subspace
 * span{q1, A*q1, A^2*q1, ...} and an upper Hessenberg matrix H such that
 * A*Q_m = Q_(m+1)*H_m. At step j it multiplies the previous basis vector by A,
 * subtracts its projections onto all existing basis vectors (modified Gram-
 * Schmidt), and normalizes the remainder into the next basis vector.
 *
 * For a symmetric matrix, H reduces to a tridiagonal matrix and its eigenvalues
 * (Ritz values) approximate eigenvalues of A. This module performs the real
 * dense iteration and reports the Arnoldi relation residual and orthogonality
 * error.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m^2 * n) for m steps on an n-dimensional dense matrix
 *   Space: O(m * n) for the basis and Hessenberg matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the newest orthonormal basis vector q_j.
 *   - The vector being normalized is yellow; the finished basis is green.
 *   - Relation residual and orthogonality error are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface ArnoldiResult {
    q: number[][];
    h: number[][];
    residual: number;
    orthError: number;
    breakdown: boolean;
}

/** Dot product of two equal-length vectors. */
function dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
}

function norm(a: number[]): number {
    return Math.sqrt(dot(a, a));
}

function matVec(a: number[][], x: number[]): number[] {
    return a.map((row) => dot(row, x));
}

/** Full modified-Gram-Schmidt Arnoldi factorization. */
export function arnoldi(a: number[][], q1: number[], m: number): ArnoldiResult {
    const n = q1.length;
    const steps = Math.max(1, Math.min(Math.floor(m), n));
    const initialNorm = norm(q1);
    const q: number[][] = [q1.map((value) => value / initialNorm)];
    const h = Array.from({ length: n + 1 }, () => Array<number>(steps).fill(0));
    let breakdown = false;

    for (let j = 0; j < steps; j += 1) {
        let v = matVec(a, q[j]!);
        for (let i = 0; i <= j; i += 1) {
            const hij = dot(q[i]!, v);
            h[i]![j] = hij;
            v = v.map((value, k) => value - hij * (q[i]![k] ?? 0));
        }
        const next = norm(v);
        h[j + 1]![j] = next;
        if (next < 1e-12 || j + 1 >= steps) {
            if (next < 1e-12) breakdown = true;
            break;
        }
        q.push(v.map((value) => value / next));
    }

    // Verify A*q_j = sum_i h_ij*q_i (+ h_(j+1,j)*q_(j+1) when that vector
    // was stored). For the last column the stored basis has no q_(j+1), so
    // its remainder must have norm equal to h_(j+1,j).
    let residual = 0;
    for (let j = 0; j < Math.min(q.length, steps); j += 1) {
        const left = matVec(a, q[j]!);
        const projected = Array<number>(n).fill(0);
        for (let i = 0; i < q.length; i += 1) {
            const coefficient = h[i]![j] ?? 0;
            for (let row = 0; row < n; row += 1) {
                projected[row] = (projected[row] ?? 0) + coefficient * (q[i]![row] ?? 0);
            }
        }
        const remainder = left.map((value, row) => value - (projected[row] ?? 0));
        if (j === q.length - 1) {
            residual = Math.max(residual, Math.abs(norm(remainder) - Math.abs(h[j + 1]![j] ?? 0)));
        } else {
            for (let row = 0; row < n; row += 1) {
                residual = Math.max(residual, Math.abs(remainder[row] ?? 0));
            }
        }
    }

    let orthError = 0;
    for (let i = 0; i < q.length; i += 1) {
        for (let j = 0; j < q.length; j += 1) {
            const target = i === j ? 1 : 0;
            orthError = Math.max(orthError, Math.abs(target - dot(q[i]!, q[j]!)));
        }
    }
    return { q, h, residual, orthError, breakdown };
}

/** Bars for a basis vector. */
function makeBars(vector: number[], state: EntityState): VisualEntity[] {
    return vector.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, component: value },
    }));
}

/** The Arnoldi iteration generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; q1?: number[]; steps?: number } | null) ?? {};
    const matrix = Array.isArray(task.matrix) ? task.matrix : [[4, 1, 0], [1, 3, 1], [0, 1, 2]];
    const q1 = Array.isArray(task.q1) ? task.q1 : [1, 0, 0];
    const steps = typeof task.steps === "number" ? Math.floor(task.steps) : 3;
    const result = arnoldi(matrix, q1, steps);
    const n = q1.length;

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(result.q[0] ?? Array<number>(n).fill(0), "unvisited"),
        edges: [],
        description: `Building an orthonormal Krylov basis for a ${n} by ${n} matrix (up to ${steps} steps).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, steps, basisSize: 1, residual: 0, orthError: 0 },
    };

    for (let j = 1; j < result.q.length; j += 1) {
        yield {
            stepNumber: step++,
            entities: makeBars(result.q[j]!, "comparing"),
            edges: [],
            description: `Step ${j}: multiplied by A, subtracted ${j} projection(s), and normalized into q_${j}.`,
            codeLineNumber: j === 1 ? 2 : 3,
            layout: "array",
            meta: {
                n,
                steps,
                step: j,
                basisSize: j + 1,
                residual: result.residual,
                orthError: result.orthError,
            },
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(result.q[result.q.length - 1] ?? [], "sorted"),
        edges: [],
        description: result.breakdown
            ? `Arnoldi broke down at step ${result.q.length}; the Krylov subspace is invariant with basis size ${result.q.length}.`
            : `Arnoldi built ${result.q.length} orthonormal vector(s); relation residual ${result.residual.toExponential(2)}, orthogonality error ${result.orthError.toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            n,
            steps,
            basisSize: result.q.length,
            residual: result.residual,
            orthError: result.orthError,
            breakdown: result.breakdown,
        },
    };
}

/** The Arnoldi iteration module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Keep applying the matrix to a starting vector, but after each application remove every component pointing in a direction you already have. What remains is a genuinely new direction. Normalize it and add it to the basis. The matrix expressed in this growing basis has a simple almost-triangular shape, which is why the method is so useful.",
        invariants: [
            "Every new basis vector is orthogonal to all previous ones.",
            "The columns of H record the projection of A times q_j onto the basis.",
            "The identity A*Q_m = Q_(m+1)*H_m holds up to the final remainder.",
        ],
        correctness:
            "Modified Gram-Schmidt subtracts the projection onto each previous unit vector, so the remainder is orthogonal to the span of the basis; normalizing keeps unit length. Therefore Q has orthonormal columns. By construction A*q_j equals the sum of h_ij*q_i over stored columns plus the normalization remainder h_(j+1,j)*q_(j+1), which is exactly the Hessenberg relation. If the remainder vanishes, the subspace is invariant and the factorization is exact.",
        complexityRationale:
            "Step j orthogonalizes against j vectors of length n and multiplies one vector by A, costing O(j*n); summing over m steps gives O(m^2*n). Storing m basis vectors of length n plus H uses O(m*n) space.",
        uses: [
            "The orthogonalization core of GMRES and other Krylov solvers",
            "Ritz-value approximation of eigenvalues for large sparse matrices",
            "Model reduction and latent-space construction in simulation",
        ],
        references: [
            "Arnoldi, The Principle of Minimized Iterations in the Solution of the Matrix Eigenvalue Problem, 1951",
            "Saad, Iterative Methods for Sparse Linear Systems, Chapter 6",
        ],
        workedExample:
            "For the symmetric matrix [[4,1,0],[1,3,1],[0,1,2]] starting from [1,0,0], the second basis vector is the part of A*[1,0,0] = [4,1,0] orthogonal to [1,0,0], normalized. Continuing gives three orthonormal vectors and a tridiagonal H whose diagonal entries approximate the matrix action.",
    },
    id: "arnoldi-iteration",
    name: "Arnoldi Iteration",
    category: "numerical-optimization",
    complexity: { time: "O(m^2*n)", space: "O(m*n)" },
    defaultInput: { matrix: [[4, 1, 0], [1, 3, 1], [0, 1, 2]], q1: [1, 0, 0], steps: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "normalize the starting vector as the first basis column",
        "for each Arnoldi step up to m",
        "multiply the newest basis vector by the matrix",
        "subtract the projection onto every existing basis column",
        "store those coefficients in the Hessenberg matrix",
        "normalize the remainder into the next basis column",
        "stop early if the remainder is effectively zero",
        "done: report the basis, Hessenberg matrix, and errors",
    ],
};

export default module;
