/**
 * coordinate-descent.ts - Coordinate Descent for a Convex Quadratic
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Coordinate descent minimizes a function one variable at a time. For the
 * convex quadratic f(x) = 1/2 x^T Q x - b^T x with Q symmetric positive
 * definite, minimizing along coordinate i while the others are held fixed has
 * a closed-form solution: x_i equals (b_i minus the off-diagonal terms) over
 * Q_ii. Cycling through the coordinates drives the gradient to zero and
 * therefore solves Q x = b.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) per coordinate update and O(iterations * n^2) overall
 *   Space: O(n) for the iterate and O(n^2) for the matrix Q
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current values of the coordinate vector x.
 *   - The coordinate being optimized is yellow and others are green.
 *   - The objective and gradient norm are reported in meta at every step.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(x: number[], active = -1, finalState = false): VisualEntity[] {
    return x.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `x${index}=${value.toFixed(4)}`,
        value,
        state: finalState ? "sorted" : index === active ? "comparing" : "visited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function objective(q: number[][], b: number[], x: number[], n: number): number {
    let quad = 0;
    let linear = 0;
    for (let i = 0; i < n; i += 1) {
        linear += (b[i] ?? 0) * (x[i] ?? 0);
        for (let j = 0; j < n; j += 1) {
            quad += (x[i] ?? 0) * (q[i]?.[j] ?? 0) * (x[j] ?? 0);
        }
    }
    return 0.5 * quad - linear;
}

function gradientNorm(q: number[][], b: number[], x: number[], n: number): number {
    let worst = 0;
    for (let i = 0; i < n; i += 1) {
        let value = -(b[i] ?? 0);
        for (let j = 0; j < n; j += 1) value += (q[i]?.[j] ?? 0) * (x[j] ?? 0);
        worst = Math.max(worst, Math.abs(value));
    }
    return worst;
}

/** Coordinate descent generator for a convex quadratic. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { q?: number[][]; b?: number[]; iterations?: number; tolerance?: number } | null
    ) ?? {};
    const q = Array.isArray(task.q)
        ? task.q.map((row) => [...row])
        : [
              [4, 1],
              [1, 3],
          ];
    const b = Array.isArray(task.b) ? [...task.b] : [1, 2];
    const iterations =
        typeof task.iterations === "number" ? Math.max(0, Math.floor(task.iterations)) : 25;
    const tolerance =
        typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-12;
    const n = q.length;
    const x = new Array<number>(n).fill(0);
    let step = 0;
    const meta = (coordinate: number, updates: number, converged: boolean) => ({
        n,
        coordinate,
        updates,
        x: [...x],
        objective: objective(q, b, x, n),
        gradientNorm: gradientNorm(q, b, x, n),
        converged,
    });

    yield {
        stepNumber: step,
        entities: makeBars(x),
        edges: [],
        description: `Minimize the quadratic from x = 0 with ${n} coordinate(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(-1, 0, false),
    };
    step += 1;

    let updates = 0;
    let converged = gradientNorm(q, b, x, n) < tolerance;
    outer: for (let sweep = 0; sweep < iterations && !converged; sweep += 1) {
        for (let i = 0; i < n; i += 1) {
            const diagonal = q[i]?.[i] ?? 0;
            if (diagonal === 0) {
                yield {
                    stepNumber: step,
                    entities: makeBars(x, i),
                    edges: [],
                    description: `Coordinate ${i} has a zero diagonal and cannot be minimized exactly.`,
                    codeLineNumber: 2,
                    layout: "array",
                    meta: meta(i, updates, false),
                };
                break outer;
            }
            let sum = b[i] ?? 0;
            for (let j = 0; j < n; j += 1) {
                if (j !== i) sum -= (q[i]?.[j] ?? 0) * (x[j] ?? 0);
            }
            x[i] = sum / diagonal;
            updates += 1;
            converged = gradientNorm(q, b, x, n) < tolerance;
            yield {
                stepNumber: step,
                entities: makeBars(x, i),
                edges: [],
                description: `Sweep ${sweep + 1}, coordinate ${i}: set x[${i}] to ${(x[i] ?? 0).toFixed(6)} by minimizing along that axis.`,
                codeLineNumber: 3,
                layout: "array",
                meta: meta(i, updates, converged),
            };
            step += 1;
            if (converged) break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, -1, true),
        edges: [],
        description: `Solution x = [${x.map((value) => value.toFixed(6)).join(", ")}] with objective ${objective(q, b, x, n).toFixed(8)} after ${updates} update(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: meta(-1, updates, converged),
    };
}

/** The coordinate descent module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than changing every variable at once, freeze all but one and move that single variable to its best value. Then move to the next variable and repeat. For a bowl-shaped quadratic, the best value along one axis is just a ratio of the current gradient pieces, so each step is cheap and the objective keeps decreasing until no single-coordinate move can help.",
        invariants: [
            "At each update only one coordinate changes; all others are held fixed.",
            "For the quadratic the coordinate update sets the corresponding gradient component to zero.",
            "Because Q is positive definite, each exact coordinate minimization cannot increase the objective.",
        ],
        correctness:
            "Fixing all coordinates except i gives a one-dimensional convex quadratic in x_i. Its derivative is Q_ii x_i plus the sum of Q_ij x_j for j not i minus b_i, and setting it to zero yields the update used here. After a full cycle every partial derivative of f has been zeroed in turn; a point with zero gradient minimizes a convex quadratic, and zero gradient is exactly Q x equals b. Thus the iterates converge to the unique minimizer when Q is positive definite.",
        complexityRationale:
            "One coordinate update evaluates a sum over n entries of Q, costing O(n), so a full sweep costs O(n^2) and k sweeps cost O(k n^2). The iterate needs O(n) space and the matrix Q needs O(n^2).",
        uses: [
            "Large-scale convex optimization with separable updates",
            "Lasso and sparse regression coordinate solvers",
            "Distributed optimization where each worker owns a coordinate block",
        ],
        references: [
            "Bertsekas, Nonlinear Programming, Section 2.5",
            "Wright, Coordinate Descent Algorithms, 2015",
        ],
        workedExample:
            "For Q = [[4,1],[1,3]] and b = [1,2] starting at (0,0), the first update sets x0 = 1/4 = 0.25. The second sets x1 = (2 - 0.25)/3 = 0.5833. Repeating converges to x0 = 1/11 and x1 = 7/11, which solve Q x = b exactly.",
    },
    id: "coordinate-descent",
    name: "Coordinate Descent",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^2)", space: "O(n^2)" },
    defaultInput: {
        q: [
            [4, 1],
            [1, 3],
        ],
        b: [1, 2],
        iterations: 25,
        tolerance: 1e-12,
    },
    visualType: "array",
    run,
    pseudocode: [
        "start the coordinate vector at zero",
        "repeat sweeps until the gradient is tiny",
        "for each coordinate hold all others fixed",
        "set it to b_i minus the off-diagonal terms divided by Q_ii",
        "after each update recompute the objective and gradient",
        "a zero gradient means Q x equals b",
        "done: report the minimizing vector",
    ],
};

export default module;
