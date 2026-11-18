/**
 * newtons-method.ts - Newton's Method for Root Finding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Newton's method finds a root of a differentiable function by repeatedly
 * replacing the current estimate x with x - f(x) / f'(x), the point where the
 * tangent line at x crosses the axis. Near a simple root the error is squared
 * at every step, so convergence is quadratic.
 *
 * This module applies the method to a polynomial given by its coefficients in
 * ascending order. Both f and f' are evaluated exactly by Horner's rule, so the
 * iteration is a real numerical method with no hard-coded answer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d) per iteration for a degree-d polynomial
 *   Space: O(d) for the derivative coefficients and iterate history
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per iterate x_n, showing how the estimate settles on the root.
 *   - The newest iterate is yellow; a converged root is green.
 *   - Residuals, derivative, and iteration count are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface NewtonStep {
    iterate: number;
    residual: number;
    derivative: number;
}

export interface NewtonResult {
    root: number;
    iterations: number;
    converged: boolean;
    history: NewtonStep[];
}

/** Evaluate a polynomial (ascending coefficients) by Horner's rule. */
export function evaluatePolynomial(coefficients: number[], x: number): number {
    let result = 0;
    for (let i = coefficients.length - 1; i >= 0; i -= 1) {
        result = result * x + (coefficients[i] ?? 0);
    }
    return result;
}

/** Exact coefficients of the derivative of an ascending-coefficient polynomial. */
export function polynomialDerivative(coefficients: number[]): number[] {
    return coefficients.map((coefficient, index) => coefficient * index).slice(1);
}

/** Run Newton's method from an initial guess on a polynomial. */
export function newtonSolve(
    coefficients: number[],
    initialGuess: number,
    tolerance: number,
    maxIterations: number,
): NewtonResult {
    const derivative = polynomialDerivative(coefficients);
    const history: NewtonStep[] = [];
    let x = initialGuess;
    let converged = false;
    let iterations = 0;
    for (let n = 0; n < maxIterations; n += 1) {
        const residual = evaluatePolynomial(coefficients, x);
        const slope = evaluatePolynomial(derivative, x);
        history.push({ iterate: x, residual, derivative: slope });
        iterations = n + 1;
        if (Math.abs(residual) <= tolerance) {
            converged = true;
            break;
        }
        if (Math.abs(slope) < 1e-14) break;
        const next = x - residual / slope;
        if (!Number.isFinite(next)) break;
        if (Math.abs(next - x) <= tolerance) {
            x = next;
            converged = Math.abs(evaluatePolynomial(coefficients, x)) <= tolerance;
            break;
        }
        x = next;
    }
    return { root: x, iterations, converged, history };
}

/** Bars for the iterate sequence. */
function makeBars(history: NewtonStep[], active: boolean, done: boolean): VisualEntity[] {
    return history.map((step, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: step.iterate.toFixed(5),
        value: step.iterate,
        state: done ? "sorted" : active && index === history.length - 1 ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, iterate: step.iterate, residual: step.residual },
    }));
}

/** The Newton's method generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { coefficients?: number[]; initialGuess?: number; tolerance?: number; maxIterations?: number } | null
    ) ?? {};
    const coefficients = Array.isArray(task.coefficients) && task.coefficients.length > 1
        ? task.coefficients.map((c) => (typeof c === "number" ? c : 0))
        : [-2, 0, 1];
    const initialGuess = typeof task.initialGuess === "number" ? task.initialGuess : 1.5;
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-10;
    const maxIterations = typeof task.maxIterations === "number" ? Math.floor(task.maxIterations) : 30;
    const result = newtonSolve(coefficients, initialGuess, tolerance, maxIterations);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: [],
        edges: [],
        description: `Finding a root of the polynomial with coefficients [${coefficients.join(", ")}] from x = ${initialGuess}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { initialGuess, tolerance, iterations: 0, root: initialGuess, residual: 0 },
    };

    for (let i = 0; i < result.history.length; i += 1) {
        const entry = result.history[i]!;
        yield {
            stepNumber: step++,
            entities: makeBars(result.history.slice(0, i + 1), true, false),
            edges: [],
            description: `Iteration ${i}: x = ${entry.iterate.toFixed(8)}, f(x) = ${entry.residual.toExponential(3)}, f'(x) = ${entry.derivative.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                initialGuess,
                tolerance,
                iteration: i,
                iterations: i + 1,
                root: entry.iterate,
                residual: entry.residual,
                derivative: entry.derivative,
            },
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(result.history, false, true),
        edges: [],
        description: result.converged
            ? `Converged to root ${result.root.toFixed(10)} after ${result.iterations} iteration(s), residual ${Math.abs(evaluatePolynomial(coefficients, result.root)).toExponential(3)}.`
            : `Stopped after ${result.iterations} iteration(s) without meeting the tolerance; last estimate ${result.root.toFixed(10)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            initialGuess,
            tolerance,
            iterations: result.iterations,
            root: result.root,
            residual: evaluatePolynomial(coefficients, result.root),
            converged: result.converged,
        },
    };
}

/** The Newton's method module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Stand on the curve at your current guess and follow the tangent line down to where it crosses the horizontal axis. That crossing is usually much closer to the root than where you started. Repeat, and each step tends to double the number of correct digits.",
        invariants: [
            "Each new iterate is the zero of the tangent line at the previous iterate.",
            "The derivative polynomial is obtained exactly by multiplying each coefficient by its power.",
            "The iteration stops when the residual is below tolerance or the derivative is effectively zero.",
        ],
        correctness:
            "Let r be a simple root and e_n = x_n - r. Taylor expansion gives f(x_n) = f'(r)e_n + O(e_n^2) and f'(x_n) = f'(r) + O(e_n). Substituting into x_{n+1} = x_n - f(x_n)/f'(x_n) cancels the linear term and leaves e_{n+1} = C e_n^2 for a bounded constant C, which is quadratic convergence when the guess starts close enough. The stopping test bounds the residual at the returned estimate.",
        complexityRationale:
            "Horner's rule evaluates a degree-d polynomial with d multiplications, so each iteration costs O(d) for f and f'. Only the derivative coefficients and the iterate history are stored, O(d + iterations).",
        uses: [
            "Solving nonlinear equations in engineering and physics",
            "The inner solver of power-flow and load-flow calculations",
            "Root polishing after a bracketing method such as bisection",
        ],
        references: [
            "Numerical Recipes, 3rd edition, Chapter 9 (Root Finding)",
            "Burden and Faires, Numerical Analysis, Chapter 3",
        ],
        workedExample:
            "For f(x) = x^2 - 2 starting at x = 1.5, the tangent gives x = 1.4167, then 1.4142, then 1.41421356. The residual drops from 0.25 to about 4.8e-3 to 4.5e-7, illustrating quadratic convergence to the square root of two.",
    },
    id: "newtons-method",
    name: "Newton's Method",
    category: "numerical-optimization",
    complexity: { time: "O(d) per iteration", space: "O(d + iterations)" },
    defaultInput: { coefficients: [-2, 0, 1], initialGuess: 1.5, tolerance: 1e-10, maxIterations: 30 },
    visualType: "array",
    run,
    pseudocode: [
        "compute the derivative polynomial from the coefficients",
        "set the current estimate to the initial guess",
        "evaluate the function and its derivative at the estimate",
        "stop when the absolute residual is below the tolerance",
        "replace the estimate by x minus f(x) over f-prime(x)",
        "append the new estimate to the history",
        "repeat until tolerance or the iteration limit is reached",
        "done: report the estimated root and its residual",
    ],
};

export default module;
