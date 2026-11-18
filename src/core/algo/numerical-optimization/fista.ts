/**
 * fista.ts - Fast Iterative Shrinkage-Thresholding Algorithm (FISTA)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * FISTA solves convex composite problems of the form minimize f(x) + g(x),
 * where f is smooth with an L-Lipschitz gradient and g is simple enough to
 * project with a proximal operator. It is proximal gradient descent plus a
 * momentum term that reuses the previous two iterates, which improves the
 * convergence rate from O(1/k) to O(1/k^2). This module uses a quadratic loss
 * f(x) = 1/2 ||A x - b||^2 and an L1 penalty g(x) = lambda ||x||_1, whose
 * proximal operator is componentwise soft thresholding. The update is
 * y = x_k + beta (x_k - x_{k-1}), x_{k+1} = soft(y - grad f(y) / L, lambda / L).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^2) for an n-column quadratic
 *   Space: O(n^2) for A^T A and O(n) for the iterate vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current coefficient vector x, one per dimension.
 *   - The coefficient updated this step is highlighted; zeros are idle.
 *   - The final frame reports the objective value and the solution vector.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FistaInput {
    A?: number[][];
    b?: number[];
    lambda?: number;
    L?: number;
    iterations?: number;
}

function matVec(M: number[][], x: number[]): number[] {
    return M.map((row) => row.reduce((sum, v, j) => sum + v * (x[j] ?? 0), 0));
}

function transpose(M: number[][]): number[][] {
    if (M.length === 0) return [];
    return M[0]!.map((_, j) => M.map((row) => row[j] ?? 0));
}

function matMul(A: number[][], B: number[][]): number[][] {
    return A.map((row) => B[0]!.map((_, j) => row.reduce((sum, v, k) => sum + v * (B[k]?.[j] ?? 0), 0)));
}

function soft(z: number, threshold: number): number {
    if (z > threshold) return z - threshold;
    if (z < -threshold) return z + threshold;
    return 0;
}

function makeBars(x: number[], highlight: number, done: boolean): VisualEntity[] {
    return x.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: `x${i}: ${value.toFixed(4)}`,
        value,
        state: done ? "sorted" as EntityState : i === highlight ? "comparing" as EntityState : "idle" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, coefficient: value },
    }));
}

/** The FISTA generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FistaInput | null) ?? {};
    const A: number[][] = Array.isArray(task.A) && task.A.length > 0
        ? task.A
        : [
              [1, 0],
              [0, 1],
          ];
    const m = A.length;
    const n = A[0]?.length ?? 1;
    const b: number[] = Array.isArray(task.b) && task.b.length === m ? task.b : [2, -3];
    const lambda = typeof task.lambda === "number" && task.lambda >= 0 ? task.lambda : 0.5;
    const iterations = Math.max(1, Math.min(200, Math.floor(task.iterations ?? 40)));
    const At = transpose(A);
    const ATA = matMul(At, A);
    const ATb = matVec(At, b);
    const L = typeof task.L === "number" && task.L > 0
        ? task.L
        : Math.max(1e-9, ...ATA.map((row) => row.reduce((sum, v) => sum + Math.abs(v), 0)));
    const stepSize = 1 / L;

    let xPrev = Array.from({ length: n }, () => 0);
    let x = [...xPrev];
    let t = 1;
    let step = 0;

    const objective = (vec: number[]): number => {
        const residual = matVec(A, vec).map((v, i) => v - (b[i] ?? 0));
        const data = 0.5 * residual.reduce((sum, r) => sum + r * r, 0);
        return data + lambda * vec.reduce((sum, v) => sum + Math.abs(v), 0);
    };
    const residualNorm = (vec: number[]): number => {
        const residual = matVec(A, vec).map((v, i) => v - (b[i] ?? 0));
        return Math.sqrt(residual.reduce((sum, r) => sum + r * r, 0));
    };
    const meta = (iteration: number, done: boolean) => ({
        iterations,
        dim: n,
        lambda,
        L,
        iteration,
        x: [...x],
        objective: objective(x),
        residual: residualNorm(x),
        t,
        done,
    });

    yield {
        stepNumber: step++,
        entities: makeBars(x, -1, false),
        edges: [],
        description: `Minimizing 1/2 ||A x - b||^2 plus L1 penalty ${lambda} with step size 1/L = ${stepSize.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, false),
    };

    for (let k = 0; k < iterations; k += 1) {
        const beta = (t - 1) / t;
        const y = x.map((xi, j) => xi + beta * (xi - (xPrev[j] ?? 0)));
        const grad = ATA.map((row, j) => row.reduce((sum, v, q) => sum + v * (y[q] ?? 0), 0) - (ATb[j] ?? 0));
        const candidate = y.map((yj, j) => yj - stepSize * (grad[j] ?? 0));
        const xNext = candidate.map((z) => soft(z, lambda / L));
        const tNext = (1 + Math.sqrt(1 + 4 * t * t)) / 2;
        xPrev = x;
        x = xNext;
        t = tNext;
        const changed = x.findIndex((v, j) => Math.abs(v - (xPrev[j] ?? 0)) > 1e-12);
        yield {
            stepNumber: step++,
            entities: makeBars(x, changed, false),
            edges: [],
            description: `Iteration ${k + 1}: momentum beta ${beta.toFixed(3)}, soft-thresholded update; objective ${objective(x).toFixed(6)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: meta(k + 1, false),
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, -1, true),
        edges: [],
        description: `After ${iterations} iterations the solution is [${x.map((v) => v.toFixed(4)).join(", ")}] with objective ${objective(x).toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: meta(iterations, true),
    };
}

/** The FISTA module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Proximal gradient descent takes one gradient step and then shrinks the result toward zero to handle the L1 penalty. FISTA adds momentum: it steps from a point extrapolated using the last two iterates instead of from the current one. That small change makes the objective fall much faster, from roughly one over the iteration count to one over its square, while keeping the same per-step cost.",
        invariants: [
            "The gradient step uses a step size no larger than one over the Lipschitz constant L.",
            "The proximal step applies soft thresholding with threshold lambda over L.",
            "The momentum coefficient comes from the recurrence t_{k+1} = (1 + sqrt(1 + 4 t_k^2)) / 2.",
        ],
        correctness:
            "For an L-Lipschitz smooth convex f, a proximal gradient step with step size 1/L is a descent step whose progress is bounded by the distance to the optimum. FISTA chooses the extrapolation coefficient so that a telescoping potential combining the objective gap and the squared distances of consecutive iterates decreases by a quantity proportional to the gap divided by t_k^2. Since t_k grows like k, the objective gap falls like 1/k^2. Soft thresholding is exactly the proximal operator of the L1 norm, so each update solves the required subproblem exactly.",
        complexityRationale:
            "Precomputing A^T A costs O(m n^2). Each iteration forms a matrix-vector product with A^T A, O(n^2), plus O(n) vector work, giving O(iterations * n^2) time. Storing A^T A uses O(n^2) memory and the iterate vectors use O(n).",
        uses: [
            "Sparse regression and LASSO in statistics and signal processing",
            "Compressed sensing image reconstruction",
            "Large-scale convex optimization with simple regularizers",
        ],
        references: [
            "Beck and Teboulle, A Fast Iterative Shrinkage-Thresholding Algorithm, 2009",
            "Nesterov, Introductory Lectures on Convex Optimization, 2004",
        ],
        workedExample:
            "With A as the 2 by 2 identity, b = (2, -3), lambda = 0.5, and L = 1, the problem separates by coordinate. The minimizer is the soft-thresholded measurement: (2 - 0.5, -3 + 0.5) = (1.5, -2.5). FISTA reaches values close to this pair after a few dozen iterations, and later iterations refine the remaining digits.",
    },
    id: "fista",
    name: "FISTA (Fast Iterative Shrinkage-Thresholding)",
    category: "numerical-optimization",
    complexity: { time: "O(k * n^2)", space: "O(n^2)" },
    defaultInput: {
        A: [
            [1, 0],
            [0, 1],
        ],
        b: [2, -3],
        lambda: 0.5,
        L: 1,
        iterations: 40,
    },
    visualType: "array",
    run,
    pseudocode: [
        "precompute A transpose A and A transpose b, choose L",
        "initialize x and the previous iterate to zero, set t to one",
        "for each iteration compute the momentum coefficient",
        "form the extrapolated point y from the last two iterates",
        "take a gradient step and apply soft thresholding",
        "update the momentum sequence t",
        "record the objective and the current coefficient vector",
        "done: report the final solution and objective value",
    ],
};

export default module;
