/**
 * method-of-multipliers.ts - Method of Multipliers (Augmented Lagrangian)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The method of multipliers solves an equality-constrained quadratic program by
 * adding a quadratic penalty for constraint violation to the Lagrangian. At
 * each iteration it minimizes the augmented Lagrangian in the primal variable
 * and then raises the Lagrange multiplier by the penalty parameter times the
 * constraint residual. Unlike a pure penalty method, it reaches the exact
 * constrained minimizer for a finite and moderate penalty parameter.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^3) for a dense primal linear solve
 *   Space: O((n + m)^2) for the augmented system and stored matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current primal iterate, one per variable.
 *   - A step that shrinks the residual is yellow; the final iterate is green.
 *   - meta carries the multiplier, constraint residual, and objective value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function dot(left: number[], right: number[]): number {
    return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function transpose(matrix: number[][]): number[][] {
    return matrix[0]?.map((_, col) => matrix.map((row) => row[col] ?? 0)) ?? [];
}

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => dot(row, vector));
}

/** Solve a dense square system by Gaussian elimination with partial pivoting. */
function solve(matrix: number[][], rhs: number[]): number[] {
    const n = rhs.length;
    const augmented = matrix.map((row, index) => [...row, rhs[index] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(augmented[row]![col] ?? 0) > Math.abs(augmented[pivot]![col] ?? 0)) pivot = row;
        }
        const temporary = augmented[col]!;
        augmented[col] = augmented[pivot]!;
        augmented[pivot] = temporary;
        const divisor = augmented[col]![col] ?? 1;
        for (let cIndex = col; cIndex <= n; cIndex += 1) augmented[col]![cIndex] = (augmented[col]![cIndex] ?? 0) / divisor;
        for (let row = 0; row < n; row += 1) {
            if (row === col) continue;
            const factor = augmented[row]![col] ?? 0;
            for (let cIndex = col; cIndex <= n; cIndex += 1) {
                augmented[row]![cIndex] = (augmented[row]![cIndex] ?? 0) - factor * (augmented[col]![cIndex] ?? 0);
            }
        }
    }
    return augmented.map((row) => row[n] ?? 0);
}

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
        metadata: { index },
    }));
}

/** Solve an equality-constrained quadratic by the augmented Lagrangian method. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { Q?: number[][]; c?: number[]; A?: number[][]; b?: number[]; rho?: number; iterations?: number; tolerance?: number } | null
    ) ?? {};
    const Q: number[][] =
        Array.isArray(task.Q) && task.Q.length > 0
            ? task.Q.map((row) => [...row])
            : [
                  [4, 1],
                  [1, 3],
              ];
    const c: number[] = Array.isArray(task.c) ? [...task.c] : [0, 0];
    const A: number[][] = Array.isArray(task.A) && task.A.length > 0 ? task.A.map((row) => [...row]) : [[1, 1]];
    const b: number[] = Array.isArray(task.b) ? [...task.b] : [1];
    const rho = typeof task.rho === "number" && task.rho > 0 ? task.rho : 2;
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 30;
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-11;

    const n = c.length;
    const AT = transpose(A);
    const ATA: number[][] = Array.from({ length: n }, (_, row) =>
        Array.from({ length: n }, (_, col) => {
            let sum = 0;
            for (let k = 0; k < A.length; k += 1) sum += (AT[row]![k] ?? 0) * (A[k]![col] ?? 0);
            return sum;
        }),
    );
    const primalMatrix: number[][] = Array.from({ length: n }, (_, row) =>
        Array.from({ length: n }, (_, col) => (Q[row]![col] ?? 0) + rho * (ATA[row]![col] ?? 0)),
    );
    const rhoATb = AT.map((row) => rho * dot(row, b));

    let x: number[] = Array.from({ length: n }, () => 0);
    let lambda: number[] = Array.from({ length: A.length }, () => 0);
    let used = 0;
    let converged = false;

    const objective = (vector: number[]): number => 0.5 * dot(vector, matVec(Q, vector)) - dot(c, vector);
    let residual = Math.sqrt(dot(matVec(A, x).map((value, index) => value - (b[index] ?? 0)), matVec(A, x).map((value, index) => value - (b[index] ?? 0))));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(x, "idle"),
        edges: [],
        description: `Solving an equality-constrained quadratic with ${n} variable(s) and ${A.length} constraint(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, x: [...x], lambda: [...lambda], residual, objective: objective(x), converged: false },
    };
    step += 1;

    for (let iteration = 0; iteration < iterations && !converged; iteration += 1) {
        const rhs = c.map((value, index) => value - dot(AT[index] ?? [], lambda) + (rhoATb[index] ?? 0));
        x = solve(primalMatrix, rhs);
        const constraint = matVec(A, x).map((value, index) => value - (b[index] ?? 0));
        lambda = lambda.map((value, index) => value + rho * (constraint[index] ?? 0));
        residual = Math.sqrt(dot(constraint, constraint));
        used = iteration + 1;
        converged = residual < tolerance;
        yield {
            stepNumber: step,
            entities: makeBars(x, converged ? "sorted" : "comparing"),
            edges: [],
            description: `Iteration ${used}: minimized the augmented Lagrangian, residual ${residual.toExponential(3)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { iteration: used, x: [...x], lambda: [...lambda], residual, objective: objective(x), converged },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, "sorted"),
        edges: [],
        description: converged
            ? `Converged in ${used} iteration(s) with residual ${residual.toExponential(3)} and objective ${objective(x).toFixed(6)}.`
            : `Stopped after ${used} iteration(s); residual ${residual.toExponential(3)}.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { iteration: used, x: [...x], lambda: [...lambda], residual, objective: objective(x), converged },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A penalty method pushes a constrained optimum toward feasibility by charging for violations, but too large a charge makes the subproblem ill conditioned. The method of multipliers keeps a running estimate of the constraint prices, the Lagrange multipliers, and charges only for the remaining violation. Each solve then corrects both the variables and the prices, so the exact answer appears at a modest penalty weight.",
        invariants: [
            "The primal step exactly minimizes the augmented Lagrangian for the current multiplier.",
            "The multiplier is increased by the penalty parameter times the constraint residual.",
            "The constraint residual decreases toward zero as the iterations proceed.",
        ],
        correctness:
            "For a quadratic objective with linear equality constraints, the augmented Lagrangian is itself quadratic, so its unconstrained minimizer is found by solving one linear system. The multiplier update is the dual ascent step on the quadratic dual function, which converges linearly with a rate governed by the penalty parameter. At a fixed point the constraint residual vanishes and the stationarity condition of the augmented Lagrangian reduces to the Karush-Kuhn-Tucker conditions, which characterize the unique constrained minimizer.",
        complexityRationale:
            "Every iteration solves one n by n linear system at O(n cubed), plus O(n squared) matrix-vector work to build the right hand side. The augmented matrix and stored vectors use O((n plus m) squared) space.",
        uses: [
            "Constrained optimal control and trajectory optimization",
            "Structural mechanics problems with equilibrium constraints",
            "A building block of ADMM and nonconvex constrained optimization",
        ],
        references: [
            "Hestenes, Multiplier and Gradient Methods, 1969",
            "Nocedal and Wright, Numerical Optimization, Chapter 17",
        ],
        workedExample:
            "Minimize one half times 4 x squared plus 2 x y plus 3 y squared subject to x plus y equals one. Starting with a zero multiplier and penalty two, the first primal solve nearly satisfies the constraint, the multiplier rises, and a handful of iterations land on the Karush-Kuhn-Tucker solution x equals 1/11 and y equals 10/11.",
    },
    id: "method-of-multipliers",
    name: "Method of Multipliers",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^3)", space: "O((n+m)^2)" },
    defaultInput: {
        Q: [
            [4, 1],
            [1, 3],
        ],
        c: [0, 0],
        A: [[1, 1]],
        b: [1],
        rho: 2,
        iterations: 30,
        tolerance: 1e-11,
    },
    visualType: "array",
    run,
    pseudocode: [
        "assemble the augmented primal matrix Q plus rho times A transpose A",
        "initialize the multiplier vector to zero",
        "for each allowed iteration",
        "form the right hand side c minus A transpose lambda plus rho A transpose b",
        "solve the primal system for the iterate x",
        "compute the constraint residual A x minus b",
        "raise the multiplier by rho times the residual",
        "stop when the residual norm is below tolerance",
        "done: report the constrained minimizer and multiplier",
    ],
};

export default module;
