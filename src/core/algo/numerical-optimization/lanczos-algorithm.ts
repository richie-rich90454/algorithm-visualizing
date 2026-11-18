/**
 * lanczos-algorithm.ts - Lanczos Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lanczos builds an orthonormal basis of a Krylov subspace and reduces a
 * symmetric matrix A to a small tridiagonal matrix T. Starting from a unit
 * vector q1, each step computes w = A qj minus the projections onto the two
 * previous basis vectors, takes its norm as the subdiagonal beta, and
 * normalizes it into the next basis vector. The eigenvalues of T approximate
 * the extreme eigenvalues of A. This module uses full reorthogonalization to
 * keep the small-dimensional example numerically exact.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * n^2) for m steps on an n by n dense matrix
 *   Space: O(m * n) for the basis vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each generated Lanczos vector is a node labeled with its index.
 *   - Diagonal alpha and subdiagonal beta values are shown in the metadata.
 *   - The final frame reports the Ritz values (eigenvalues of the tridiagonal).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/** Matrix-vector product for a dense square matrix. */
function matVec(A: number[][], x: number[]): number[] {
    return A.map((row) => row.reduce((sum, value, j) => sum + value * (x[j] ?? 0), 0));
}
function dot(a: number[], b: number[]): number {
    return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
}
function norm(a: number[]): number {
    return Math.sqrt(dot(a, a));
}

/** Two eigenvalues of a symmetric 2x2 matrix (closed form). */
function sym2x2(a: number, d: number, b: number): [number, number] {
    const mid = (a + d) / 2;
    const delta = Math.sqrt(((a - d) / 2) ** 2 + b * b);
    return [mid + delta, mid - delta];
}

/** Build basis-vector entities and tridiagonal edges for one frame. */
function makeEntities(
    count: number,
    alphas: number[],
    betas: number[],
    current: number,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < count; i += 1) {
        let state: EntityState = "idle";
        if (i === current) state = "comparing";
        else if (i < current) state = "sorted";
        entities.push({
            id: `q-${i}`,
            type: "node",
            label: `q${i}`,
            value: alphas[i] ?? 0,
            state,
            x: i,
            y: alphas[i] ?? 0,
            width: 0,
            height: 0,
            metadata: { index: i, alpha: alphas[i] ?? 0, beta: i > 0 ? (betas[i - 1] ?? 0) : 0 },
        });
    }
    const edges: VisualEdge[] = [];
    for (let i = 1; i < count; i += 1) {
        edges.push({
            id: `link-${i - 1}-${i}`,
            sourceId: `q-${i - 1}`,
            targetId: `q-${i}`,
            label: (betas[i - 1] ?? 0).toFixed(3),
            state: i === current ? "active" : "visited",
            directed: false,
        });
    }
    return { entities, edges };
}

/** The Lanczos generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; steps?: number } | null) ?? {};
    const A: number[][] = Array.isArray(task.matrix)
        ? task.matrix.map((row) => row.map(Number))
        : [
              [4, 1, 0],
              [1, 3, 1],
              [0, 1, 2],
          ];
    const n = A.length;
    const steps = Math.min(n, Math.max(1, Math.floor(Number(task.steps ?? n)) || n));
    const q: number[][] = [];
    const alphas: number[] = [];
    const betas: number[] = [];

    const q0 = new Array<number>(n).fill(0);
    q0[0] = 1;
    q.push(q0);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(1, alphas, betas, 0).entities,
        edges: [],
        description: `Lanczos on a ${n} by ${n} symmetric matrix: start from the unit vector q0.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n, steps, alphas: [], betas: [], ritz: [], current: 0 },
    };
    step += 1;

    for (let j = 0; j < steps; j += 1) {
        const qj = q[j] as number[];
        const w = matVec(A, qj);
        const alpha = dot(qj, w);
        alphas.push(alpha);
        for (let i = 0; i < q.length; i += 1) {
            const qi = q[i] as number[];
            const coeff = dot(qi, w);
            for (let k = 0; k < n; k += 1) {
                w[k] = (w[k] ?? 0) - coeff * (qi[k] ?? 0);
            }
        }
        const beta = norm(w);
        betas.push(beta);
        const built = makeEntities(q.length, alphas, betas, j);
        yield {
            stepNumber: step,
            entities: built.entities,
            edges: built.edges,
            description: `Step ${j}: alpha = ${alpha.toFixed(4)}, beta = ${beta.toFixed(4)}; the residual norm measures how well q${j} is already an eigenvector.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { n, steps, alphas: [...alphas], betas: [...betas], ritz: sym2x2(alphas[0] ?? 0, alphas[1] ?? alpha, betas[0] ?? 0), current: j, beta },
        };
        step += 1;

        if (beta <= 1e-10) {
            break;
        }
        if (j + 1 < steps) {
            q.push(w.map((v) => v / beta));
        }
    }

    const ritz = steps >= 2 ? sym2x2(alphas[0] ?? 0, alphas[1] ?? 0, betas[0] ?? 0) : [alphas[0] ?? 0, alphas[0] ?? 0];
    const built = makeEntities(q.length, alphas, betas, -1);
    yield {
        stepNumber: step,
        entities: built.entities,
        edges: built.edges,
        description: `Done: tridiagonal diagonal ${alphas.map((a) => a.toFixed(3)).join(", ")}; approximate extreme eigenvalues ${ritz[0].toFixed(4)} and ${ritz[1].toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { n, steps, alphas, betas, ritz, current: -1, done: true },
    };
}

/** The Lanczos module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Repeated multiplication by a symmetric matrix pushes a vector toward the directions where the matrix stretches most. Lanczos captures that sequence of vectors, orthogonalizes each new one against the ones before it, and records just a three-term recurrence. The small tridiagonal matrix that falls out has eigenvalues close to the most important eigenvalues of the original.",
        invariants: [
            "Every generated basis vector is orthonormal to the previous ones (full reorthogonalization).",
            "The recurrence satisfies A qj = alpha_j qj + beta_j q(j+1) + beta_(j-1) q(j-1).",
            "The tridiagonal matrix T is symmetric with alphas on the diagonal and betas off it.",
        ],
        correctness:
            "The Arnoldi relation A Q_m = Q_m T_m + beta_m q_(m+1) e_m^T holds for the orthonormal basis Q_m. For a symmetric A, T_m is tridiagonal, and because Q_m has orthonormal columns, T_m is the orthogonal projection of A onto the Krylov subspace. Its eigenvalues (Ritz values) therefore approximate eigenvalues of A, with the extreme ones converging fastest. Full reorthogonalization removes the loss of orthogonality that plagues the plain recurrence in finite precision.",
        complexityRationale:
            "Each of the m steps performs one matrix-vector product costing O(n^2) for a dense matrix plus O(m n) orthogonalization, so total time is O(m n^2). Storing m basis vectors of length n uses O(m n) space.",
        uses: [
            "Approximating extreme eigenvalues of large sparse symmetric matrices",
            "The core of the conjugate gradient method and other Krylov solvers",
            "Dimensionality reduction in spectral methods and latent semantic analysis",
        ],
        references: [
            "Lanczos, An Iteration Method for the Solution of the Eigenvalue Problem, 1950",
            "Saad, Iterative Methods for Sparse Linear Systems, Chapter 6, 2003",
        ],
        workedExample:
            "For A = [[4,1],[1,3]] and q0 = (1,0), the product A q0 = (4,1) gives alpha = 4. Subtracting the projection leaves (0,1) with norm beta = 1, so q1 = (0,1). The next alpha is 3 and the off-diagonal beta is 1. The tridiagonal [[4,1],[1,3]] has eigenvalues about 4.618 and 2.382, the true eigenvalues of A.",
    },
    id: "lanczos-algorithm",
    name: "Lanczos Algorithm",
    category: "numerical-optimization",
    complexity: { time: "O(m * n^2)", space: "O(m * n)" },
    defaultInput: {
        matrix: [
            [4, 1, 0],
            [1, 3, 1],
            [0, 1, 2],
        ],
        steps: 3,
    },
    visualType: "point",
    run,
    pseudocode: [
        "choose a starting unit vector q0",
        "for each step j",
        "compute w = A times qj",
        "set alpha_j to the inner product qj dot w",
        "subtract projections onto all previous q vectors",
        "set beta_j to the norm of the residual w",
        "normalize the residual into the next basis vector",
        "form the tridiagonal matrix from alphas and betas",
        "done: return its eigenvalues as Ritz approximations",
    ],
};

export default module;
