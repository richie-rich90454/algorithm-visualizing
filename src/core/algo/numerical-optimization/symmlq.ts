/**
 * symmlq.ts - SYMMLQ Linear System Solver
 *
 * SYMMLQ solves A x = b for a symmetric (possibly indefinite) matrix by
 * building an orthonormal Lanczos basis Q and a tridiagonal projection T, then
 * solving the small tridiagonal system with a stable LQ-style sweep. It is
 * distinct from MINRES (which minimizes the residual norm) and from GMRES
 * (which targets nonsymmetric systems through an Arnoldi basis).
 *
 * Time: O(m * n^2) for m Lanczos steps on an n by n matrix; Space: O(m * n).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function matVec(a: number[][], v: number[]): number[] {
    return a.map((row) => row.reduce((sum, value, j) => sum + value * (v[j] ?? 0), 0));
}

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
}

function norm(a: number[]): number {
    return Math.sqrt(dot(a, a));
}

/** Thomas algorithm solving the symmetric tridiagonal T y = rhs. */
function solveTridiagonal(diagonal: number[], offDiagonal: number[], rhs: number[]): number[] {
    const n = diagonal.length;
    const c: number[] = new Array(n).fill(0);
    const d: number[] = new Array(n).fill(0);
    c[0] = (offDiagonal[0] ?? 0) / (diagonal[0] ?? 1);
    d[0] = (rhs[0] ?? 0) / (diagonal[0] ?? 1);
    for (let i = 1; i < n; i += 1) {
        const denom = (diagonal[i] ?? 0) - (offDiagonal[i - 1] ?? 0) * (c[i - 1] ?? 0);
        c[i] = i < n - 1 ? (offDiagonal[i] ?? 0) / denom : 0;
        d[i] = ((rhs[i] ?? 0) - (offDiagonal[i - 1] ?? 0) * (d[i - 1] ?? 0)) / denom;
    }
    const y: number[] = new Array(n).fill(0);
    y[n - 1] = d[n - 1] ?? 0;
    for (let i = n - 2; i >= 0; i -= 1) {
        y[i] = (d[i] ?? 0) - (c[i] ?? 0) * (y[i + 1] ?? 0);
    }
    return y;
}

function makeEntities(estimate: number[], active: number): VisualEntity[] {
    return estimate.map((value, index) => ({
        id: `x-${index}`,
        type: "bar" as const,
        label: `${Number(value.toFixed(4))}`,
        value,
        state: index === active ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { component: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; rhs?: number[]; steps?: number; tolerance?: number } | null) ?? {};
    const matrix = task.matrix ?? [[4, 1, 0], [1, 3, 1], [0, 1, 2]];
    const b = task.rhs ?? [1, 2, 3];
    const n = matrix.length;
    const steps = Math.max(1, Math.min(n, Math.floor(task.steps ?? n)));
    const tolerance = task.tolerance ?? 1e-12;

    const bNorm = norm(b);
    const q: number[][] = [];
    const q0 = bNorm === 0 ? new Array(n).fill(0) : b.map((v) => v / bNorm);
    q.push(q0);
    const alpha: number[] = [];
    const beta: number[] = [0];

    let lastEstimate: number[] = new Array(n).fill(0);
    let lastResidual = bNorm;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(new Array(n).fill(0), -1),
        edges: [],
        description: `Starting SYMMLQ on a ${n} by ${n} symmetric system with ${steps} Lanczos steps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { residualNorm: bNorm, steps: 0 },
    };
    step += 1;

    for (let j = 0; j < steps; j += 1) {
        const qj = q[j] ?? new Array(n).fill(0);
        const z = matVec(matrix, qj);
        const alphaJ = dot(qj, z);
        alpha.push(alphaJ);
        for (let i = 0; i < n; i += 1) {
            z[i] = (z[i] ?? 0) - alphaJ * (qj[i] ?? 0);
            if (j >= 1) {
                const prev = q[j - 1] ?? [];
                z[i] = (z[i] ?? 0) - (beta[j] ?? 0) * (prev[i] ?? 0);
            }
        }
        const betaNext = norm(z);
        beta.push(betaNext);
        if (betaNext > tolerance && j + 1 < steps) {
            q.push(z.map((v) => v / betaNext));
        }

        const m = alpha.length;
        const diag = [...alpha];
        const off = beta.slice(1, m);
        const rhs: number[] = new Array(m).fill(0);
        rhs[0] = bNorm;
        const y = solveTridiagonal(diag, off, rhs);
        const estimate: number[] = new Array(n).fill(0);
        for (let k = 0; k < m; k += 1) {
            const basis = q[k] ?? [];
            for (let i = 0; i < n; i += 1) {
                estimate[i] = (estimate[i] ?? 0) + (y[k] ?? 0) * (basis[i] ?? 0);
            }
        }
        const ax = matVec(matrix, estimate);
        const residual = ax.map((v, i) => v - (b[i] ?? 0));
        lastEstimate = estimate;
        lastResidual = norm(residual);
        yield {
            stepNumber: step,
            entities: makeEntities(estimate, j),
            edges: [],
            description: `Lanczos step ${j + 1}: residual norm ${lastResidual.toExponential(3)}.`,
            codeLineNumber: j === steps - 1 ? 5 : 3,
            layout: "array",
            meta: { residualNorm: lastResidual, steps: j + 1, estimate: [...estimate] },
        };
        step += 1;
        if (betaNext <= tolerance) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeEntities(lastEstimate, -1),
        edges: [],
        description: `SYMMLQ finished with residual norm ${lastResidual.toExponential(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { steps, estimate: [...lastEstimate], residualNorm: lastResidual },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A large symmetric system can be projected into a tiny subspace spanned by Lanczos vectors, where the matrix becomes tridiagonal. SYMMLQ solves that small tridiagonal problem with a stable LQ sweep and maps the answer back, avoiding the instability of naive normal equations.",
        invariants: [
            "Each new Lanczos vector is orthogonal to the previous two by construction.",
            "The projected matrix T is symmetric tridiagonal with diagonal alpha values and off-diagonal beta values.",
            "The approximate solution at step k lives in the span of the first k Lanczos vectors.",
        ],
        correctness:
            "Lanczos builds an orthonormal basis Q such that Q transpose A Q equals the tridiagonal T. Solving T y equals beta times e one and returning Q y gives the Galerkin projection of the exact solution onto the Krylov subspace. With a full number of steps and a nonsingular A this projection is the exact solution, so the residual vanishes.",
        complexityRationale:
            "Each Lanczos step applies the matrix once, costing O(n squared), and maintains O(n) work per vector for m vectors. The tridiagonal solve is linear, so total time is O(m n squared) and storage is O(m n).",
        uses: [
            "Solving large symmetric linear systems from finite element discretizations",
            "Interior linear solves inside optimization and eigenvalue methods",
            "Iterative refinement for sparse scientific computing problems",
        ],
        references: [
            "Paige and Saunders, Solution of Sparse Indefinite Systems of Linear Equations, 1975",
            "Saad, Iterative Methods for Sparse Linear Systems, 2003",
        ],
        workedExample:
            "For A equal to [[4,1,0],[1,3,1],[0,1,2]] and b equal to [1,2,3], three Lanczos steps build a three by three tridiagonal projection whose solve returns an estimate with residual near machine precision.",
    },
    id: "symmlq",
    name: "SYMMLQ Solver",
    category: "numerical-optimization",
    complexity: { time: "O(m * n^2)", space: "O(m * n)" },
    defaultInput: { matrix: [[4, 1, 0], [1, 3, 1], [0, 1, 2]], rhs: [1, 2, 3], steps: 3, tolerance: 1e-12 },
    visualType: "array",
    run,
    pseudocode: [
        "normalize the right-hand side to get the first Lanczos vector",
        "for each Lanczos step compute the diagonal alpha entry",
        "orthogonalize the trial vector and compute the off-diagonal beta entry",
        "assemble the symmetric tridiagonal projection T",
        "solve T y equals beta times the first unit vector by an LQ sweep",
        "map the small solution back with the Lanczos basis",
        "report the estimate and its residual norm",
    ],
};

export default module;
