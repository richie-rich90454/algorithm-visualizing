/**
 * minres.ts - Minimum Residual Method (MINRES)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MINRES solves a symmetric linear system A x = b, including indefinite ones,
 * by minimizing the residual norm over the growing Krylov subspace. A short
 * Lanczos recurrence with full reorthogonalization builds an orthonormal basis
 * and a small tridiagonal projection; solving that small least-squares problem
 * gives the iterate whose residual is as small as possible at each step.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * (n^2 + m * n)) for m iterations on an n by n matrix
 *   Space: O(m * n) for the Lanczos basis
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current approximate solution vector x.
 *   - The caption reports the residual norm, which never increases.
 *   - meta carries the solution, residual history, and iteration count.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** y = A x. */
function matVec(a: number[][], x: number[]): number[] {
    const n = x.length;
    const out = Array.from({ length: n }, () => 0);
    for (let i = 0; i < n; i += 1) {
        let sum = 0;
        for (let j = 0; j < n; j += 1) {
            sum += (a[i]?.[j] ?? 0) * (x[j] ?? 0);
        }
        out[i] = sum;
    }
    return out;
}

function dot(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) {
        sum += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return sum;
}

function norm(a: number[]): number {
    return Math.sqrt(dot(a, a));
}

/** Solve a small square system by Gaussian elimination with partial pivoting. */
function solveDense(a: number[][], b: number[]): number[] {
    const n = b.length;
    const m = a.map((row, i) => [...row, b[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) {
                pivot = r;
            }
        }
        const tmp = m[col] as number[];
        m[col] = m[pivot] as number[];
        m[pivot] = tmp;
        const diag = m[col]?.[col] ?? 0;
        if (Math.abs(diag) < 1e-14) {
            return Array.from({ length: n }, () => 0);
        }
        for (let r = col + 1; r < n; r += 1) {
            const factor = (m[r]?.[col] ?? 0) / diag;
            for (let c = col; c <= n; c += 1) {
                m[r]![c] = (m[r]?.[c] ?? 0) - factor * (m[col]?.[c] ?? 0);
            }
        }
    }
    const x = Array.from({ length: n }, () => 0);
    for (let i = n - 1; i >= 0; i -= 1) {
        let sum = m[i]?.[n] ?? 0;
        for (let j = i + 1; j < n; j += 1) {
            sum -= (m[i]?.[j] ?? 0) * (x[j] ?? 0);
        }
        x[i] = sum / (m[i]?.[i] ?? 1);
    }
    return x;
}

/** Solve min ||T y - rhs|| via the normal equations (T is small and (k+1) by k). */
function leastSquares(t: number[][], rhs: number[]): number[] {
    const k = t[0]?.length ?? 0;
    const gram = Array.from({ length: k }, () => Array.from({ length: k }, () => 0));
    const target = Array.from({ length: k }, () => 0);
    for (let i = 0; i < k; i += 1) {
        for (let j = 0; j < k; j += 1) {
            let sum = 0;
            for (let r = 0; r < t.length; r += 1) {
                sum += (t[r]?.[i] ?? 0) * (t[r]?.[j] ?? 0);
            }
            gram[i]![j] = sum;
        }
        let s = 0;
        for (let r = 0; r < t.length; r += 1) {
            s += (t[r]?.[i] ?? 0) * (rhs[r] ?? 0);
        }
        target[i] = s;
    }
    return solveDense(gram, target);
}

/** Build bar entities for an approximate solution vector. */
function makeBars(x: number[]): VisualEntity[] {
    return x.map((value, index) => ({
        id: `x-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: "active",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** The MINRES generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; b?: number[]; iterations?: number; tolerance?: number } | null) ?? {};
    const raw = Array.isArray(task.matrix) ? task.matrix : [];
    const matrix: number[][] =
        raw.length > 0
            ? raw.map((row) => (Array.isArray(row) ? row.map((v) => Number(v)) : []))
            : [
                  [4, 1, 0],
                  [1, 3, 1],
                  [0, 1, 2],
              ];
    const n = matrix.length;
    const b: number[] = Array.isArray(task.b) && task.b.length === n ? task.b.map(Number) : [1, 2, 3].slice(0, n);
    const maxIter = Math.min(n, Math.max(2, Math.floor(Number(task.iterations ?? 5)) || 5));
    const tolerance = typeof task.tolerance === "number" ? task.tolerance : 1e-10;

    let x = Array.from({ length: n }, () => 0);
    let residualVec = matVec(matrix, x).map((v, i) => (b[i] ?? 0) - v);
    const beta0 = norm(residualVec);
    const history: number[] = [beta0];

    yield {
        stepNumber: 0,
        entities: makeBars(x),
        edges: [],
        description: `MINRES on a ${n} by ${n} symmetric system; initial residual norm ${beta0.toExponential(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, iteration: 0, residual: beta0, residualHistory: [...history], solution: [...x], converged: beta0 < tolerance },
    };

    if (beta0 < tolerance) {
        yield {
            stepNumber: 1,
            entities: makeBars(x),
            edges: [],
            description: "The right-hand side is already zero; the solution is the zero vector.",
            codeLineNumber: 7,
            layout: "array",
            meta: { n, iteration: 0, residual: beta0, residualHistory: [...history], solution: [...x], converged: true },
        };
        return;
    }

    let vCur = residualVec.map((value) => value / beta0);
    const basis: number[][] = [vCur];
    let vPrev = Array.from({ length: n }, () => 0);
    let betaPrev = 0;
    let step = 1;
    let converged = false;
    const colData: Array<{ alpha: number; lower: number; upper: number }> = [];

    for (let j = 0; j < maxIter; j += 1) {
        const av = matVec(matrix, vCur);
        const alpha = dot(vCur, av);
        const w = av.map((value, i) => value - alpha * (vCur[i] ?? 0) - betaPrev * (vPrev[i] ?? 0));
        for (const q of basis) {
            const coeff = dot(q, w);
            for (let i = 0; i < n; i += 1) {
                w[i] = (w[i] ?? 0) - coeff * (q[i] ?? 0);
            }
        }
        const betaNext = norm(w);

        // Record this column, then assemble the (j+2) by (j+1) tridiagonal projection.
        colData.push({ alpha, lower: betaPrev, upper: betaNext });
        const rows = j + 2;
        const cols = j + 1;
        const tri = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
        for (let c = 0; c < cols; c += 1) {
            const entry = colData[c] as { alpha: number; lower: number; upper: number };
            tri[c]![c] = entry.alpha;
            if (c > 0) {
                tri[c - 1]![c] = entry.lower;
            }
            tri[c + 1]![c] = entry.upper;
        }

        const rhs = Array.from({ length: rows }, () => 0);
        rhs[0] = beta0;
        const y = leastSquares(tri, rhs);
        x = Array.from({ length: n }, (_, i) =>
            basis.reduce((sum, q, idx) => sum + (q[i] ?? 0) * (y[idx] ?? 0), 0),
        );
        residualVec = matVec(matrix, x).map((v, i) => (b[i] ?? 0) - v);
        const residual = norm(residualVec);
        history.push(residual);

        yield {
            stepNumber: step,
            entities: makeBars(x),
            edges: [],
            description: `Iteration ${j + 1}: minimized residual to ${residual.toExponential(3)} over a ${j + 1}-dimensional Krylov space.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { n, iteration: j + 1, residual, residualHistory: [...history], solution: [...x], converged: residual < tolerance },
        };
        step += 1;

        if (residual < tolerance) {
            converged = true;
            break;
        }
        if (betaNext < 1e-14) {
            break;
        }
        vPrev = vCur;
        vCur = w.map((value) => value / betaNext);
        basis.push(vCur);
        betaPrev = betaNext;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x),
        edges: [],
        description: converged
            ? `Converged after ${step - 1} iteration(s) with residual ${(history[history.length - 1] ?? 0).toExponential(3)}.`
            : `Stopped after ${step - 1} iteration(s); final residual ${(history[history.length - 1] ?? 0).toExponential(3)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { n, iteration: step - 1, residual: history[history.length - 1] ?? 0, residualHistory: [...history], solution: [...x], converged },
    };
}

/** The MINRES module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "MINRES searches for the approximate solution that makes the residual as small as possible among all vectors reachable by repeatedly applying the symmetric matrix to the starting residual. Instead of storing a growing set of full vectors, a short three-term recurrence keeps the work bounded, while the residual is guaranteed never to get worse from one iteration to the next.",
        invariants: [
            "The Lanczos basis vectors are orthonormal (full reorthogonalization enforces this).",
            "The projection tridiagonal matrix is symmetric because the original matrix is symmetric.",
            "The residual norm is non-increasing because each iterate minimizes it over a larger Krylov subspace.",
        ],
        correctness:
            "After j steps the Lanczos basis spans the Krylov subspace of dimension j and the tridiagonal matrix is the orthogonal projection of A onto it. Minimizing the small least-squares problem beta times the first basis vector minus the projection is equivalent to minimizing the true residual norm over that subspace, because multiplication by the orthonormal basis preserves norms. Since the subspaces grow, the minimum residual can only decrease.",
        complexityRationale:
            "Each iteration performs one matrix-vector product costing O(n^2), plus reorthogonalization against at most m basis vectors costing O(m n). The small least-squares solve costs O(m^3). Storing the basis uses O(m n) space.",
        uses: [
            "Solving large symmetric indefinite systems in finite-element analysis",
            "Saddle-point problems in fluid dynamics and constrained optimization",
            "Least-squares problems where only matrix-vector products are available",
        ],
        references: [
            "Paige and Saunders, Solution of Sparse Indefinite Systems of Linear Equations, 1975",
            "Greenbaum, Iterative Methods for Solving Linear Systems, Chapter 3",
        ],
        workedExample:
            "For the symmetric system with A = [[4,1],[1,3]] and b = [1,2], the initial residual is b itself with norm about 2.24. The first Lanczos step projects A onto a one-dimensional space and produces a solution whose residual is already much smaller; the second step spans the whole space and drives the residual to numerical zero.",
    },
    id: "minres",
    name: "MINRES (Minimum Residual)",
    category: "numerical-optimization",
    complexity: { time: "O(m * (n^2 + m * n))", space: "O(m * n)" },
    defaultInput: {
        matrix: [
            [4, 1, 0],
            [1, 3, 1],
            [0, 1, 2],
        ],
        b: [1, 2, 3],
        iterations: 5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "compute the initial residual r equals b minus A x and its norm beta",
        "set the first Lanczos vector to r divided by beta",
        "for each iteration build w equals A v minus alpha v minus beta previous v",
        "reorthogonalize w against all basis vectors",
        "form the tridiagonal projection and solve the small least-squares problem",
        "rebuild the iterate as the basis times the least-squares solution",
        "record the new residual norm and test for convergence",
        "advance the Lanczos recurrence with the next beta",
        "done: report the iterate with the smallest residual",
    ],
};

export default module;
