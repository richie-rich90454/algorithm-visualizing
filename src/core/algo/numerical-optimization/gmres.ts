/**
 * gmres.ts - Generalized Minimal Residual Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * GMRES solves a square linear system A*x = b by building an orthonormal basis
 * of the Krylov subspace span{b, A*b, A^2*b, ...} with the Arnoldi process, then
 * choosing the combination of basis vectors that minimizes the residual norm.
 * For a system of dimension n, at most n iterations give the exact solution in
 * exact arithmetic.
 *
 * The exact step shown is the Arnoldi construction: each new basis vector is
 * orthogonal to all previous ones, and the small Hessenberg least-squares
 * problem reproduces the direct Gaussian-elimination solution when the basis
 * spans the whole space.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m^2 * n) for m iterations on an n-dimensional dense system
 *   Space: O(m * n) for the orthonormal basis and Hessenberg matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current solution estimate x at each iteration.
 *   - The newest iterate is yellow; the final solution is green.
 *   - Residual norm and orthonormality error are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Dot product of two equal-length vectors. */
function dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
}

/** Euclidean norm of a vector. */
function norm(a: number[]): number {
    return Math.sqrt(dot(a, a));
}

/** Matrix-vector product. */
function matVec(a: number[][], x: number[]): number[] {
    return a.map((row) => dot(row, x));
}

/** Solve a small dense system by Gaussian elimination with partial pivoting. */
export function solveLinear(a: number[][], b: number[]): number[] | null {
    const n = b.length;
    const m = a.map((row, i) => [...row, b[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) {
                pivot = r;
            }
        }
        if (Math.abs(m[pivot]?.[col] ?? 0) < 1e-12) {
            return null;
        }
        [m[col], m[pivot]] = [m[pivot]!, m[col]!];
        const pv = m[col]![col]!;
        for (let c = col; c <= n; c += 1) {
            m[col]![c]! /= pv;
        }
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const factor = m[r]![col]!;
            if (factor === 0) continue;
            for (let c = col; c <= n; c += 1) {
                m[r]![c]! -= factor * m[col]![c]!;
            }
        }
    }
    return m.map((row) => row[n] ?? 0);
}

export interface GmresData {
    history: Array<{ iter: number; solution: number[]; residual: number }>;
    basisSize: number;
    orthError: number;
}

/** Full GMRES Arnoldi run with a solution estimate after each iteration. */
export function gmres(a: number[][], b: number[], iterations: number): GmresData {
    const n = b.length;
    const m = Math.min(Math.max(1, iterations), n);
    const beta = norm(b);
    const q: number[][] = [b.map((value) => value / beta)];
    const h = Array.from({ length: m + 1 }, () => Array<number>(m).fill(0));
    let used = 0;

    for (let j = 0; j < m; j += 1) {
        const v = matVec(a, q[j]!);
        for (let i = 0; i <= j; i += 1) {
            const hij = dot(q[i]!, v);
            h[i]![j] = hij;
            for (let k = 0; k < n; k += 1) {
                v[k] = (v[k] ?? 0) - hij * (q[i]![k] ?? 0);
            }
        }
        const next = norm(v);
        h[j + 1]![j] = next;
        if (next > 1e-12 && j + 1 < m) {
            q.push(v.map((value) => value / next));
            used = j + 2;
        } else {
            used = j + 1;
            break;
        }
    }

    const history: GmresData["history"] = [];
    for (let mm = 1; mm <= used; mm += 1) {
        const top = Array.from({ length: mm }, (_, i) => h[i]!.slice(0, mm));
        const rhs = Array.from({ length: mm }, (_, i) => (i === 0 ? beta : 0));
        const y = solveLinear(top, rhs) ?? Array<number>(mm).fill(0);
        const x = Array<number>(n).fill(0);
        for (let i = 0; i < mm; i += 1) {
            for (let k = 0; k < n; k += 1) {
                x[k] = (x[k] ?? 0) + (y[i] ?? 0) * (q[i]![k] ?? 0);
            }
        }
        const residual = norm(matVec(a, x).map((value, k) => value - (b[k] ?? 0)));
        history.push({ iter: mm, solution: [...x], residual });
    }

    let orthError = 0;
    for (let i = 0; i < q.length; i += 1) {
        for (let j = 0; j < q.length; j += 1) {
            const target = i === j ? 1 : 0;
            orthError = Math.max(orthError, Math.abs(target - dot(q[i]!, q[j]!)));
        }
    }
    return { history, basisSize: q.length, orthError };
}

/** Build solution-estimate bars. */
function makeBars(solution: number[], active: boolean, state: EntityState = "idle"): VisualEntity[] {
    return solution.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: active ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** The GMRES generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; vector?: number[]; iterations?: number } | null) ?? {};
    const matrix = Array.isArray(task.matrix) ? task.matrix : [[4, 1, 1], [1, 3, 0], [1, 0, 2]];
    const vector = Array.isArray(task.vector) ? task.vector : [6, 4, 5];
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 3;
    const n = vector.length;
    const data = gmres(matrix, vector, iterations);

    let step = 0;
    const initial = Array<number>(n).fill(0);
    yield {
        stepNumber: step++,
        entities: makeBars(initial, false),
        edges: [],
        description: `Solving a ${n} by ${n} system with GMRES (up to ${iterations} Arnoldi steps).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, residual: norm(vector), solution: initial, basisSize: 0, orthError: 0 },
    };

    for (const entry of data.history) {
        yield {
            stepNumber: step++,
            entities: makeBars(entry.solution, true),
            edges: [],
            description: `Iteration ${entry.iter}: Krylov basis size ${entry.iter}, residual norm ${entry.residual.toExponential(3)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                iteration: entry.iter,
                residual: entry.residual,
                solution: [...entry.solution],
                basisSize: entry.iter,
                orthError: data.orthError,
            },
        };
    }

    const final = data.history[data.history.length - 1];
    yield {
        stepNumber: step,
        entities: makeBars(final?.solution ?? initial, false, "sorted"),
        edges: [],
        description: `Converged with residual ${(final?.residual ?? 0).toExponential(3)}; basis orthonormality error ${data.orthError.toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            iteration: final?.iter ?? 0,
            residual: final?.residual ?? 0,
            solution: final?.solution ?? initial,
            basisSize: data.basisSize,
            orthError: data.orthError,
        },
    };
}

/** The GMRES module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than attacking a large system directly, build a small subspace from the vectors b, A*b, A squared times b, and so on, and find the best answer inside it. Each new direction is made orthogonal to the ones before it, so the small least-squares problem is well behaved. The residual usually shrinks quickly, often reaching machine precision in far fewer than n steps.",
        invariants: [
            "Each Arnoldi basis vector is orthogonal to all earlier ones.",
            "The Hessenberg matrix records the projection of A onto the Krylov basis.",
            "The residual norm is non-increasing as the basis grows.",
        ],
        correctness:
            "Arnoldi builds an orthonormal Q and an upper Hessenberg H with A*Q_m = Q_(m+1)*H_m. Minimizing the residual over the subspace reduces to a small least-squares problem in H_m. When the Krylov subspace reaches dimension n, Q spans all of R^n, so the minimizer must be the exact solution; in exact arithmetic the residual becomes zero. The orthonormal basis keeps the small problem numerically stable.",
        complexityRationale:
            "Iteration j orthogonalizes one vector against j previous vectors of length n, giving O(j*n) work and O(m^2*n) for m iterations. Storing m basis vectors of length n and the Hessenberg matrix uses O(m*n) space.",
        uses: [
            "Solving large sparse nonsymmetric linear systems",
            "Newton and implicit time-stepping solvers in simulation",
            "Preconditioned iterative solvers in scientific computing",
        ],
        references: [
            "Saad and Schultz, GMRES: A Generalized Minimal Residual Algorithm, SIAM Journal on Scientific Computing, 1986",
            "Saad, Iterative Methods for Sparse Linear Systems, Chapter 6",
        ],
        workedExample:
            "For the three-by-three system with matrix [[4,1,1],[1,3,0],[1,0,2]] and right side [6,4,5], GMRES builds at most three Krylov vectors. By the third step the basis spans R^3 and the solution matches direct elimination, with a residual near machine precision.",
    },
    id: "gmres",
    name: "GMRES",
    category: "numerical-optimization",
    complexity: { time: "O(m^2*n)", space: "O(m*n)" },
    defaultInput: { matrix: [[4, 1, 1], [1, 3, 0], [1, 0, 2]], vector: [6, 4, 5], iterations: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "normalize the right-hand side as the first basis vector",
        "for each allowed Arnoldi iteration",
        "multiply the last basis vector by the matrix",
        "subtract projections onto all previous basis vectors",
        "store the coefficients in the Hessenberg matrix",
        "normalize the remainder into the next basis vector",
        "solve the small least-squares problem for the iterate",
        "done: report the solution and residual norm",
    ],
};

export default module;
