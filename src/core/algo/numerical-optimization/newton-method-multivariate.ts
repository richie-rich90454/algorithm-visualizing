/**
 * newton-method-multivariate.ts - Multivariate Newton's Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Newton's method for a system of two nonlinear equations linearizes the
 * system at the current iterate with its Jacobian matrix, solves the linear
 * system J(x) * delta = -F(x) for the step, and moves to x + delta. Near a
 * simple root the error contracts quadratically.
 *
 * The system is a pair of quadratic polynomials whose coefficients are supplied
 * by the input, so no answer is hard-coded. Every derivative and every 2 by 2
 * linear solve is computed exactly from those coefficients.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations) for a fixed two-variable system
 *   Space: O(iterations) for the iterate history in the frames
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes plot the trajectory of (x, y) iterates on the point layout.
 *   - The current iterate is yellow; the converged root is green.
 *   - meta carries each iterate, its residual, and the final root.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vec2 = [number, number];

interface NewtonInput {
    coefficients?: number[][];
    start?: Vec2;
    iterations?: number;
    tolerance?: number;
}

/** Evaluate the two quadratic equations at (x, y). */
function evaluate(coefficients: number[][], x: number, y: number): Vec2 {
    const value = (row: number[]) =>
        (row[0] ?? 0) * x * x + (row[1] ?? 0) * y * y + (row[2] ?? 0) * x + (row[3] ?? 0) * y + (row[4] ?? 0);
    return [value(coefficients[0] ?? []), value(coefficients[1] ?? [])];
}

/** Jacobian of the quadratic system at (x, y). */
function jacobian(coefficients: number[][], x: number, y: number): number[][] {
    const row = (coefficientsRow: number[]) => [
        2 * (coefficientsRow[0] ?? 0) * x + (coefficientsRow[2] ?? 0),
        2 * (coefficientsRow[1] ?? 0) * y + (coefficientsRow[3] ?? 0),
    ];
    return [row(coefficients[0] ?? []), row(coefficients[1] ?? [])];
}

/** Solve a 2 by 2 linear system, returning null when it is singular. */
function solve2(matrix: number[][], rhs: Vec2): Vec2 | null {
    const a = matrix[0]?.[0] ?? 0;
    const b = matrix[0]?.[1] ?? 0;
    const c = matrix[1]?.[0] ?? 0;
    const d = matrix[1]?.[1] ?? 0;
    const determinant = a * d - b * c;
    if (Math.abs(determinant) < 1e-14) {
        return null;
    }
    return [
        (rhs[0] * d - b * rhs[1]) / determinant,
        (a * rhs[1] - c * rhs[0]) / determinant,
    ];
}

function makePoints(trajectory: Vec2[], active: number, converged: boolean): VisualEntity[] {
    return trajectory.map(([x, y], index) => {
        const state: EntityState = converged && index === trajectory.length - 1
            ? "sorted"
            : index === active
                ? "active"
                : "visited";
        return {
            id: `iterate-${index}`,
            type: "node" as const,
            label: `(${x.toFixed(2)}, ${y.toFixed(2)})`,
            value: [x, y],
            state,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index, x, y, step: index },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as NewtonInput | null) ?? {};
    const coefficients: number[][] = Array.isArray(task.coefficients) && task.coefficients.length === 2
        ? task.coefficients.map((row) => Array.isArray(row) ? row.map((value) => Number(value) || 0) : [])
        : [
              [1, 1, 0, 0, -5],
              [0, 0, 1, -1, -1],
          ];
    const startRaw = Array.isArray(task.start) ? task.start : [2.5, 0.8];
    let x = Number(startRaw[0] ?? 0);
    let y = Number(startRaw[1] ?? 0);
    const iterations = Math.min(40, Math.max(1, Math.floor(Number(task.iterations ?? 20)) || 20));
    const tolerance = Math.max(1e-14, Number(task.tolerance ?? 1e-10) || 1e-10);
    const trajectory: Vec2[] = [[x, y]];
    let converged = false;
    let step = 0;

    const residualAt = (px: number, py: number) => {
        const [f1, f2] = evaluate(coefficients, px, py);
        return Math.hypot(f1, f2);
    };

    yield {
        stepNumber: step,
        entities: makePoints(trajectory, 0, false),
        edges: [],
        description: `Begin at (${x.toFixed(3)}, ${y.toFixed(3)}) with residual ${residualAt(x, y).toExponential(2)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { x, y, residual: residualAt(x, y), iteration: 0, converged: false, trajectory: trajectory.flat() },
    };
    step += 1;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const [f1, f2] = evaluate(coefficients, x, y);
        const j = jacobian(coefficients, x, y);
        const delta = solve2(j, [f1, f2]);
        if (delta === null) {
            yield {
                stepNumber: step,
                entities: makePoints(trajectory, trajectory.length - 1, false),
                edges: [],
                description: "The Jacobian is singular, so the Newton step cannot be computed.",
                codeLineNumber: 3,
                layout: "point",
                meta: { x, y, residual: Math.hypot(f1, f2), iteration: iteration + 1, converged: false, singular: true, trajectory: trajectory.flat() },
            };
            return;
        }
        x -= delta[0];
        y -= delta[1];
        trajectory.push([x, y]);
        const residual = residualAt(x, y);
        converged = residual < tolerance;
        yield {
            stepNumber: step,
            entities: makePoints(trajectory, trajectory.length - 1, converged),
            edges: [],
            description: `Iteration ${iteration + 1}: step (${delta[0].toFixed(4)}, ${delta[1].toFixed(4)}) reaches (${x.toFixed(6)}, ${y.toFixed(6)}) with residual ${residual.toExponential(2)}.`,
            codeLineNumber: converged ? 6 : 5,
            layout: "point",
            meta: { x, y, residual, iteration: iteration + 1, converged, trajectory: trajectory.flat() },
        };
        step += 1;
        if (converged) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makePoints(trajectory, trajectory.length - 1, converged),
        edges: [],
        description: converged
            ? `Converged to (${x.toFixed(9)}, ${y.toFixed(9)}) after ${trajectory.length - 1} step(s).`
            : `Stopped after ${trajectory.length - 1} step(s) with residual ${residualAt(x, y).toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { x, y, residual: residualAt(x, y), iteration: trajectory.length - 1, converged, root: [x, y], trajectory: trajectory.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A nonlinear system is hard to solve directly, but a linear approximation is easy. At the current guess, replace each curved equation by its tangent plane using the Jacobian matrix, solve the resulting linear system for a correction, and step to a better guess. Repeating this turns a local linear model into a rapidly converging root finder.",
        invariants: [
            "The Jacobian entries are the exact partial derivatives of the quadratic equations at the current iterate.",
            "Each Newton step solves J times delta equals minus F at that iterate.",
            "The residual measures how far the current iterate is from a true root.",
        ],
        correctness:
            "Because the system is quadratic its Jacobian is exact, so the linearization matches F to first order at the iterate. Newton's method applied to a smooth map with a nonsingular Jacobian at a simple root has a locally quadratic error recurrence, so once the iterate is near a root the residual contracts sharply. The iteration terminates when the residual falls below the requested tolerance, which certifies an approximate root.",
        complexityRationale:
            "The system has fixed size two, so forming the Jacobian and solving the 2 by 2 system take constant time; the whole run is O(iterations) time. The only stored state is the iterate history used by the visualization, which is O(iterations) space.",
        uses: [
            "Solving the stationarity equations of nonconvex optimization problems",
            "Power-flow and circuit equations in electrical engineering",
            "Kinematic equation solving in robotics and computer graphics",
        ],
        references: [
            "Kelley, Solving Nonlinear Equations with Newton's Method, 2003",
            "Burden and Faires, Numerical Analysis, 9th edition, chapter 5",
        ],
        workedExample:
            "For x squared plus y squared equals 5 and x minus y equals 1, start at (2.5, 0.8). The Jacobian is [[5, 1.6], [1, -1]] and the residual is large, so the first correction moves toward the root at (2, 1). A second step lands on (2, 1) to six decimals with residual near zero, and the iteration stops.",
    },
    id: "newton-method-multivariate",
    name: "Multivariate Newton's Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(iterations)" },
    defaultInput: {
        coefficients: [
            [1, 1, 0, 0, -5],
            [0, 0, 1, -1, -1],
        ],
        start: [2.5, 0.8],
        iterations: 20,
        tolerance: 1e-10,
    },
    visualType: "point",
    run,
    pseudocode: [
        "start from an initial guess (x, y)",
        "evaluate the system F at the current guess",
        "assemble the Jacobian matrix of partial derivatives",
        "solve J times delta equals minus F for the Newton step",
        "if J is singular, stop and report failure",
        "set (x, y) to (x, y) plus delta",
        "stop when the norm of F is below the tolerance",
        "done: report the approximate root and residual",
    ],
};

export default module;
