/**
 * admm.ts - Alternating Direction Method of Multipliers for L1 Least Squares
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ADMM solves a convex problem by splitting it into two simpler subproblems and
 * coupling them with a scaled dual variable. This demo minimizes a diagonal
 * least-squares loss plus an L1 penalty: the x step is a cheap shrinkage of the
 * least-squares solution, the z step is soft thresholding, and the dual step
 * accumulates the disagreement between x and z. The diagonal choice makes every
 * step exact and easy to check by hand.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n) for a diagonal design matrix
 *   Space: O(n) for x, z, and the scaled dual variable
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show x, z, and u for each coordinate, grouped in three blocks.
 *   - The z block is yellow while it updates and green at convergence.
 *   - Objective, primal residual, and dual residual appear in the metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Soft thresholding: sign(v) times max(|v| - kappa, 0). */
function softThreshold(v: number, kappa: number): number {
    if (v > kappa) {
        return v - kappa;
    }
    if (v < -kappa) {
        return v + kappa;
    }
    return 0;
}

/** Build one bar per coordinate for x, then z, then u. */
function makeBars(x: number[], z: number[], u: number[], state: EntityState): VisualEntity[] {
    const groups = [
        { values: x, name: "x" },
        { values: z, name: "z" },
        { values: u, name: "u" },
    ];
    const entities: VisualEntity[] = [];
    for (const group of groups) {
        group.values.forEach((value, index) => {
            entities.push({
                id: `bar-${group.name}-${index}`,
                type: "bar" as const,
                label: `${group.name}=${value.toFixed(4)}`,
                value,
                state: group.name === "z" ? state : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index, group: group.name },
            });
        });
    }
    return entities;
}

/** Objective value of the split problem at x. */
function objective(diagonal: number[], b: number[], x: number[], lambda: number): number {
    let loss = 0;
    let penalty = 0;
    for (let i = 0; i < x.length; i += 1) {
        const scale = diagonal[i] ?? 0;
        const diff = (x[i] ?? 0) - (b[i] ?? 0);
        loss += 0.5 * scale * scale * diff * diff;
        penalty += lambda * Math.abs(x[i] ?? 0);
    }
    return loss + penalty;
}

/** Euclidean norm of a vector. */
function norm(v: number[]): number {
    return Math.sqrt(v.reduce((sum, value) => sum + value * value, 0));
}

/** The ADMM generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { diagonal?: number[]; b?: number[]; lambda?: number; rho?: number; iterations?: number; tol?: number } | null
    ) ?? {};
    const diagonal = Array.isArray(task.diagonal) ? [...task.diagonal] : [2, 3, 1];
    const b = Array.isArray(task.b) ? [...task.b] : [2, 1, 4];
    const n = Math.min(diagonal.length, b.length);
    const lambda = typeof task.lambda === "number" && task.lambda >= 0 ? task.lambda : 0.5;
    const rho = typeof task.rho === "number" && task.rho > 0 ? task.rho : 1;
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 40;
    const tol = typeof task.tol === "number" && task.tol > 0 ? task.tol : 1e-10;

    let x = new Array<number>(n).fill(0);
    let z = new Array<number>(n).fill(0);
    let u = new Array<number>(n).fill(0);
    const threshold = lambda / rho;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(x, z, u, "unvisited"),
        edges: [],
        description: `Minimizing a diagonal least-squares loss plus an L1 penalty of ${lambda} with penalty parameter ${rho}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            x: [...x], z: [...z], u: [...u], iteration: 0,
            objective: objective(diagonal, b, x, lambda),
            primalResidual: 0, dualResidual: 0, converged: false,
        },
    };
    step += 1;

    let converged = false;
    let used = 0;
    for (let iteration = 0; iteration < iterations && !converged; iteration += 1) {
        const previousZ = [...z];
        x = x.map((_, i) => {
            const scale = diagonal[i] ?? 0;
            return (scale * scale * (b[i] ?? 0) + rho * ((z[i] ?? 0) - (u[i] ?? 0))) / (scale * scale + rho);
        });
        z = x.map((value, i) => softThreshold(value + (u[i] ?? 0), threshold));
        used = iteration + 1;
        const primalResidual = norm(x.map((value, i) => value - (z[i] ?? 0)));
        const dualResidual = rho * norm(z.map((value, i) => value - (previousZ[i] ?? 0)));
        converged = primalResidual < tol && dualResidual < tol;
        const isLast = converged || iteration === iterations - 1;
        yield {
            stepNumber: step,
            entities: makeBars(x, z, u, isLast ? "sorted" : "comparing"),
            edges: [],
            description: isLast
                ? `${converged ? "Converged" : "Stopped"} in ${used} iteration(s) with x = ${x.map((value) => value.toFixed(5)).join(", ")}; primal residual ${primalResidual.toExponential(2)}.`
                : `Iteration ${used}: objective ${objective(diagonal, b, x, lambda).toFixed(6)}, primal residual ${primalResidual.toExponential(2)}.`,
            codeLineNumber: isLast ? 7 : 4,
            layout: "array",
            meta: {
                x: [...x], z: [...z], u: [...u], iteration: used,
                objective: objective(diagonal, b, x, lambda),
                primalResidual, dualResidual, converged,
            },
        };
        step += 1;
        u = u.map((value, i) => value + (x[i] ?? 0) - (z[i] ?? 0));
    }
}

/** The ADMM module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Some objectives are easier to optimize when the variable is split into two copies that are forced to agree. ADMM alternates between minimizing over each copy and nudging them together with a scaled dual variable. On a diagonal least-squares problem the first copy is a simple shrinkage and the second copy is just soft thresholding, so every step is a closed-form calculation.",
        invariants: [
            "The z update is exactly soft thresholding of x plus the scaled dual variable.",
            "The scaled dual variable accumulates the running difference between x and z.",
            "The objective never increases once the iterates settle.",
        ],
        correctness:
            "The x step minimizes the quadratic loss plus a quadratic penalty around z minus u, so it is an exact minimizer in closed form. The z step minimizes the L1 term plus the same quadratic penalty, which is soft thresholding. Alternating exact minimizations with the dual ascent step converges to a saddle point of the augmented Lagrangian for convex objectives, and agreement of x and z then enforces the original problem.",
        complexityRationale:
            "With a diagonal design matrix each coordinate update is a constant number of arithmetic operations, so one iteration is O(n). Storing x, z, and the dual vector uses O(n) space; a dense design would instead need a factorization per iteration.",
        uses: [
            "Distributed optimization across machines that hold different data shards",
            "L1 regularized regression and compressed sensing",
            "Image restoration and total variation denoising",
        ],
        references: [
            "Boyd et al., Distributed Optimization and Statistical Learning via ADMM, 2011",
            "Glowinski and Marroco, Sur l'Approximation par Elements Finis, 1975",
        ],
        workedExample:
            "With diagonal (2, 3, 1), b = (2, 1, 4), lambda = 0.5, and rho = 1, the exact solution is soft thresholding of b at lambda over the squared diagonal, giving x = (1.875, 0.9444, 3.5). ADMM approaches those values while z stays equal to x at convergence.",
    },
    id: "admm",
    name: "ADMM for L1 Least Squares",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n)", space: "O(n)" },
    defaultInput: { diagonal: [2, 3, 1], b: [2, 1, 4], lambda: 0.5, rho: 1, iterations: 40, tol: 1e-10 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize x, z, and the scaled dual u to zero",
        "repeat until primal and dual residuals are small",
        "minimize the quadratic loss plus the penalty to update x",
        "apply soft thresholding to x plus u to update z",
        "add the difference x minus z to the dual variable u",
        "compute the primal and dual convergence residuals",
        "stop when both residuals fall below the tolerance",
        "done: report x, z, and the objective value",
    ],
};

export default module;
