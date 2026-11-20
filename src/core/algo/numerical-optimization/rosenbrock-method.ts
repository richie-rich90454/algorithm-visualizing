/**
 * rosenbrock-method.ts - Rosenbrock Two-Stage Method for Stiff ODEs
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rosenbrock methods linearize the ODE at each step and solve small linear
 * systems instead of iterating an implicit method to convergence. This two
 * stage ROS2 variant uses the same linearly implicit matrix for both stages,
 * so only one factorization per step is needed. Its L-stable choice of gamma
 * makes it suitable for stiff equations where explicit Runge-Kutta methods
 * would need tiny steps.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps) for a scalar equation, one solved 1 by 1 system per stage
 *   Space: O(1) besides the emitted frames
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar shows the current solution value at each accepted step.
 *   - Stage increments k1 and k2 appear in the frame metadata.
 *   - The final frame reports the error against the known exact solution.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Equation = "stiff" | "decay" | "linear";

/** Right-hand side and the exact solution used for verification. */
function problem(equation: Equation, lambda: number, y0: number): {
    f: (t: number, y: number) => number;
    jac: number;
    exact: (t: number) => number;
} {
    if (equation === "decay") {
        return { f: (_t, y) => -lambda * y, jac: -lambda, exact: (t) => y0 * Math.exp(-lambda * t) };
    }
    if (equation === "linear") {
        return { f: () => 1, jac: 0, exact: (t) => y0 + t };
    }
    return {
        f: (t, y) => -lambda * (y - Math.cos(t)) - Math.sin(t),
        jac: -lambda,
        exact: (t) => Math.cos(t),
    };
}

function buildEntity(y: number, state: EntityState): VisualEntity[] {
    return [
        {
            id: "y",
            type: "bar" as const,
            label: y.toFixed(5),
            value: y,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { variable: "y" },
        },
    ];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        equation?: Equation;
        lambda?: number;
        y0?: number;
        t0?: number;
        tEnd?: number;
        h?: number;
    } | null) ?? {};
    const equation: Equation = task.equation === "decay" || task.equation === "linear" ? task.equation : "stiff";
    const lambda = typeof task.lambda === "number" ? task.lambda : 50;
    const y0 = typeof task.y0 === "number" ? task.y0 : 1;
    const t0 = typeof task.t0 === "number" ? task.t0 : 0;
    const tEnd = typeof task.tEnd === "number" ? task.tEnd : 1;
    const h = typeof task.h === "number" && task.h > 0 ? task.h : 0.02;
    const { f, jac, exact } = problem(equation, lambda, y0);
    const gamma = 1 - 1 / Math.SQRT2;
    const a21 = 1;
    const c21 = -2;
    const b2 = gamma - 0.5;
    const b1 = 1 - b2;

    let t = t0;
    let y = y0;
    let step = 0;
    yield {
        stepNumber: step++,
        entities: buildEntity(y, "idle"),
        edges: [],
        description: `Integrating a ${equation} ODE from t=${t0} to t=${tEnd} with Rosenbrock ROS2.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { equation, lambda, t, y, exact: exact(t), phase: "start" },
    };

    const steps = Math.max(0, Math.round((tEnd - t0) / h));
    for (let i = 0; i < steps; i += 1) {
        const den = 1 - h * gamma * jac;
        const k1 = f(t, y) / den;
        const secondValue = f(t + h, y + h * a21 * k1);
        const k2 = (secondValue + h * jac * c21 * k1) / den;
        y = y + h * (b1 * k1 + b2 * k2);
        t = t0 + (i + 1) * h;
        const reference = exact(t);
        yield {
            stepNumber: step++,
            entities: buildEntity(y, "active"),
            edges: [],
            description: `Step ${i + 1}: t=${t.toFixed(3)}, y=${y.toFixed(6)}, error ${Math.abs(y - reference).toExponential(2)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { equation, t, y, k1, k2, exact: reference, error: Math.abs(y - reference), phase: "step" },
        };
    }

    const finalExact = exact(t);
    yield {
        stepNumber: step++,
        entities: buildEntity(y, "sorted"),
        edges: [],
        description: `ROS2 finished at t=${t.toFixed(3)}: y=${y.toFixed(6)}, exact ${finalExact.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { equation, t, y, exact: finalExact, error: Math.abs(y - finalExact), steps, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Implicit methods tame stiff equations but normally require solving a nonlinear system at every step. Rosenbrock methods replace that nonlinear solve with one linearized solve using the Jacobian. Both stages reuse the same matrix, so the method behaves like a stabilized explicit step with the stability of an implicit one.",
        invariants: [
            "Both stages solve with the same matrix (I minus h gamma J).",
            "The stage coefficients satisfy the second-order accuracy conditions.",
            "The chosen gamma makes the method L-stable for large negative eigenvalues.",
        ],
        correctness:
            "Expanding the update on the scalar test equation y' = lambda y gives y_next = 1 + z + z^2/2 + O(z^3) with z = h lambda, so the method has order two. As z tends to minus infinity the update tends to zero, which is L-stability; stiff transients are therefore damped instead of oscillating. The two-stage construction evaluates the right side at advanced arguments while keeping the Jacobian fixed, which is the defining Rosenbrock idea.",
        complexityRationale:
            "Each step computes two right-hand side values and solves one scalar linear system per stage, a constant amount of work, so the total is O(steps) with O(1) working memory.",
        uses: [
            "Integrating stiff chemical kinetics systems",
            "Circuit simulation and other differentially stiff models",
            "A teaching bridge between explicit Runge-Kutta and fully implicit solvers",
        ],
        references: [
            "Rosenbrock, Some General Implicit Processes for Numerical Solution of Differential Equations, 1963",
            "Hairer and Wanner, Solving Ordinary Differential Equations II: Stiff Problems",
        ],
        workedExample:
            "For y' = -50(y - cos t) - sin t with y(0) = 1, the exact solution is cos t. A ROS2 step with h = 0.02 damps the fast transient in one step and advances the smooth cos t component with second-order accuracy.",
    },
    id: "rosenbrock-method",
    name: "Rosenbrock Two-Stage Method (ROS2)",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(1)" },
    defaultInput: { equation: "stiff", lambda: 50, y0: 1, t0: 0, tEnd: 1, h: 0.02 },
    visualType: "array",
    run,
    pseudocode: [
        "choose gamma, a21, c21 and the weights b1 and b2",
        "form the common matrix M equal to I minus h gamma times the Jacobian",
        "solve M k1 equal to f at the current point",
        "solve M k2 equal to f at the advanced point plus h c21 J k1",
        "advance y by h times b1 k1 plus b2 k2",
        "advance t by h and repeat until the end time",
        "done: report the final value and its error",
    ],
};

export default module;
