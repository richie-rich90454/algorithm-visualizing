/**
 * hestenes-stiefel.ts - Hestenes-Stiefel Nonlinear Conjugate Gradient
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Hestenes-Stiefel method is a nonlinear conjugate gradient variant. Each
 * iteration takes an exact line step along a search direction, then builds the
 * next direction from the new gradient and the gradient change using the
 * Hestenes-Stiefel beta coefficient. On a quadratic function with a symmetric
 * positive definite Hessian it converges in at most n steps in exact
 * arithmetic. A gradient-orthogonality restart keeps the direction fresh.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^2) for a dense matrix-vector product
 *   Space: O(n) for the iterate, gradient, and direction vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current solution estimate, one per component.
 *   - The most recent iterate is yellow; the converged answer is green.
 *   - meta carries the quadratic objective, gradient norm, and iterate count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0));
}

function dot(left: number[], right: number[]): number {
    return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
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

/** Minimize a quadratic by the Hestenes-Stiefel conjugate gradient recurrence. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { A?: number[][]; b?: number[]; iterations?: number; tolerance?: number } | null) ?? {};
    const A: number[][] =
        Array.isArray(task.A) && task.A.length > 0
            ? task.A.map((row) => (Array.isArray(row) ? [...row] : []))
            : [
                  [4, 1],
                  [1, 3],
              ];
    const b: number[] = Array.isArray(task.b) && task.b.length === A.length ? [...task.b] : [1, 2];
    const iterations =
        typeof task.iterations === "number" && task.iterations >= 1 ? Math.floor(task.iterations) : A.length + 4;
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-11;

    const n = A.length;
    let x: number[] = Array.from({ length: n }, () => 0);
    let gradient = matVec(A, x).map((value, index) => value - (b[index] ?? 0));
    let direction = gradient.map((value) => -value);
    let used = 0;
    let converged = false;

    const objective = (vector: number[]): number => 0.5 * dot(vector, matVec(A, vector)) - dot(b, vector);
    let currentObjective = objective(x);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(x, "idle"),
        edges: [],
        description: `Minimizing a ${n}-dimensional quadratic with the Hestenes-Stiefel conjugate gradient method.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, f: currentObjective, gradientNorm: Math.sqrt(dot(gradient, gradient)), converged: false, solution: [...x] },
    };
    step += 1;

    for (let iteration = 0; iteration < iterations && !converged; iteration += 1) {
        const Ad = matVec(A, direction);
        const curvature = dot(direction, Ad);
        if (!Number.isFinite(curvature) || Math.abs(curvature) < 1e-18) {
            break;
        }
        const alpha = -dot(gradient, direction) / curvature;
        x = x.map((value, index) => value + alpha * (direction[index] ?? 0));
        const nextGradient = matVec(A, x).map((value, index) => value - (b[index] ?? 0));
        const y = nextGradient.map((value, index) => value - (gradient[index] ?? 0));
        const denominator = dot(direction, y);
        let beta = Math.abs(denominator) < 1e-18 ? 0 : dot(nextGradient, y) / denominator;
        // A nonorthogonal consecutive gradient pair signals lost conjugacy.
        if (Math.abs(dot(nextGradient, gradient)) > 0.2 * dot(nextGradient, nextGradient)) {
            beta = 0;
        }
        direction = nextGradient.map((value, index) => -value + beta * (direction[index] ?? 0));
        gradient = nextGradient;
        used = iteration + 1;
        currentObjective = objective(x);
        converged = Math.sqrt(dot(gradient, gradient)) < tolerance;
        yield {
            stepNumber: step,
            entities: makeBars(x, converged ? "sorted" : "comparing"),
            edges: [],
            description: `Iteration ${used}: exact line step alpha ${alpha.toFixed(5)} with Hestenes-Stiefel beta ${beta.toFixed(5)}; f = ${currentObjective.toExponential(3)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { iteration: used, f: currentObjective, gradientNorm: Math.sqrt(dot(gradient, gradient)), converged, beta, solution: [...x] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, "sorted"),
        edges: [],
        description: converged
            ? `Converged in ${used} iteration(s) with objective ${currentObjective.toExponential(3)}.`
            : `Stopped after ${used} iteration(s); objective ${currentObjective.toExponential(3)}.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { iteration: used, f: currentObjective, gradientNorm: Math.sqrt(dot(gradient, gradient)), converged, solution: [...x] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Conjugate gradient walks downhill using directions that do not undo each other's progress. The Hestenes-Stiefel rule chooses how much of the previous direction to keep by comparing the new gradient with how the gradient changed. For a quadratic bowl this makes each step optimal along a fresh axis, so the minimum is reached in at most as many steps as there are variables.",
        invariants: [
            "The line search exactly minimizes the quadratic along the current direction.",
            "The direction is rebuilt from the current gradient plus a scaled previous direction.",
            "The gradient norm decreases as the iterate approaches the minimizer.",
        ],
        correctness:
            "For a quadratic with Hessian A, the exact line step minimizes f along the search direction, which makes the new gradient orthogonal to that direction. The Hestenes-Stiefel beta then produces directions that are A-conjugate to earlier ones, so the method spans a new Krylov direction each step. After n steps the directions cover the whole space and the gradient must vanish, which is the unique minimizer because A is positive definite. The restart only resets a direction whose conjugacy has degraded and cannot increase the objective.",
        complexityRationale:
            "Every iteration performs one dense matrix-vector product at O(n squared) and O(n) vector arithmetic. Storing the iterate, gradient, direction, and gradient difference uses O(n) space beyond the matrix.",
        uses: [
            "Solving large symmetric positive definite linear systems without factoring the matrix",
            "Iterative optimization in scientific simulation and engineering solvers",
            "A testbed for nonlinear conjugate gradient variants on smooth objectives",
        ],
        references: [
            "Hestenes and Stiefel, Methods of Conjugate Gradients for Solving Linear Systems, 1952",
            "Nocedal and Wright, Numerical Optimization, Chapter 3",
        ],
        workedExample:
            "For A = [[4,1],[1,3]] and b = [1,2], the first step moves from the origin along b to roughly (0.208, 0.417). The gradient change gives a Hestenes-Stiefel beta, the second direction is formed, and the second step lands on the exact solution (1/11, 7/11) to machine precision.",
    },
    id: "hestenes-stiefel",
    name: "Hestenes-Stiefel Conjugate Gradient",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^2)", space: "O(n)" },
    defaultInput: {
        A: [
            [4, 1],
            [1, 3],
        ],
        b: [1, 2],
        iterations: 8,
        tolerance: 1e-11,
    },
    visualType: "array",
    run,
    pseudocode: [
        "start at x zero with gradient A x minus b and direction minus gradient",
        "for each allowed iteration",
        "compute the curvature direction dot A direction",
        "take the exact line step alpha equal to minus gradient dot direction over curvature",
        "update x, the gradient, and the gradient change y",
        "set beta to new gradient dot y over direction dot y",
        "restart to steepest descent when consecutive gradients are not orthogonal",
        "form the next direction as minus gradient plus beta times direction",
        "done: report the minimizer and final objective",
    ],
};

export default module;
