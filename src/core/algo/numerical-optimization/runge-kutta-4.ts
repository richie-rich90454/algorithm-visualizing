/**
 * runge-kutta-4.ts - Classical Fourth-Order Runge-Kutta Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Runge-Kutta 4 advances an ordinary differential equation y' = f(t, y) by
 * sampling the slope at the start, twice at the midpoint, and at the end of a
 * step, then taking a weighted average. The cancellation of lower-order error
 * terms makes the local error proportional to h to the fifth power and the
 * global error proportional to h to the fourth power.
 *
 * The demonstrator uses the linear equation y' = lambda * y, whose exact
 * solution y0 * exp(lambda * t) lets the visualization report the true error.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps) derivative evaluations (four per step)
 *   Space: O(steps) for the plotted trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the numerical solution at each time step.
 *   - The newest step is yellow; the completed trajectory is green.
 *   - The metadata reports t, y, the exact value, and the absolute error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** The demo ODE right-hand side. */
function f(lambda: number, _t: number, y: number): number {
    return lambda * y;
}

function makeBars(values: number[], active: number, state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: index === active && active !== -1 ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** The Runge-Kutta 4 generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { lambda?: number; y0?: number; tEnd?: number; steps?: number } | null) ?? {};
    const lambda = typeof task.lambda === "number" ? task.lambda : -1;
    const y0 = typeof task.y0 === "number" ? task.y0 : 1;
    const tEnd = typeof task.tEnd === "number" && task.tEnd > 0 ? task.tEnd : 2;
    const steps = typeof task.steps === "number" && task.steps >= 1 ? Math.floor(task.steps) : 8;
    const h = tEnd / steps;

    let t = 0;
    let y = y0;
    const values: number[] = [y0];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(values, -1, "idle"),
        edges: [],
        description: `Solving y' = ${lambda} * y from y(0) = ${y0} to t = ${tEnd} with ${steps} RK4 step(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { t: 0, y, exact: y0, error: 0, steps, h },
    };
    step += 1;

    for (let index = 0; index < steps; index += 1) {
        const k1 = f(lambda, t, y);
        const k2 = f(lambda, t + h / 2, y + (h / 2) * k1);
        const k3 = f(lambda, t + h / 2, y + (h / 2) * k2);
        const k4 = f(lambda, t + h, y + h * k3);
        y = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
        t = (index + 1) * h;
        values.push(y);
        const exact = y0 * Math.exp(lambda * t);
        yield {
            stepNumber: step,
            entities: makeBars(values, index + 1, "comparing"),
            edges: [],
            description: `Step ${index + 1}: at t = ${t.toFixed(4)}, RK4 gives y = ${y.toFixed(6)} with four slope samples.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { t, y, exact, error: Math.abs(y - exact), steps, h },
        };
        step += 1;
    }

    const exactFinal = y0 * Math.exp(lambda * tEnd);
    yield {
        stepNumber: step,
        entities: makeBars(values, -1, "sorted"),
        edges: [],
        description: `Final estimate y(${tEnd}) = ${y.toFixed(8)}; exact value ${exactFinal.toFixed(8)}; error ${Math.abs(y - exactFinal).toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { t: tEnd, y, exact: exactFinal, error: Math.abs(y - exactFinal), steps, h },
    };
}

/** The Runge-Kutta 4 module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A single slope measurement at the start of a step is only first-order accurate. RK4 samples the slope at the beginning, twice in the middle, and at the end, then combines them with weights 1, 2, 2, 1. The midpoint samples cancel the leading error terms, giving a much more accurate step for the same step size.",
        invariants: [
            "Each step uses four evaluations of the derivative function.",
            "For y' = lambda * y the method reduces to multiplying by a rational approximation of exp(lambda * h).",
            "The global error scales like the fourth power of the step size.",
        ],
        correctness:
            "Expanding each stage in a Taylor series and matching terms shows the weighted average agrees with the true Taylor expansion of y(t + h) through order h to the fourth, with local error O(h^5). Because a fixed interval uses O(1/h) steps, the accumulated global error is O(h^4). For the linear test equation the stability function matches exp(z) through fourth order.",
        complexityRationale:
            "Each of the steps evaluates the derivative four times, so time is O(steps). Storing the plotted trajectory uses O(steps) space; the integration itself only needs a few scalar values.",
        uses: [
            "Numerical integration of ordinary differential equations",
            "Orbit and trajectory simulation in engineering",
            "Solving reaction and kinetics models in chemistry and biology",
        ],
        references: [
            "Butcher, Numerical Methods for Ordinary Differential Equations, Chapter 2",
            "Press et al., Numerical Recipes, Chapter 17",
        ],
        workedExample:
            "For y' = -y, y(0) = 1, and one step of size 1, the four slopes are -1, -0.5, -0.75, and -0.25, giving y(1) about 0.375. The exact value is exp(-1) about 0.3679; smaller steps reduce the error by a factor of about sixteen each time the step size halves.",
    },
    id: "runge-kutta-4",
    name: "Runge-Kutta 4",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { lambda: -1, y0: 1, tEnd: 2, steps: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "set the initial time and value and choose a step size",
        "for each step",
        "compute the slope k1 at the start of the interval",
        "compute the slope k2 at the midpoint using k1",
        "compute the slope k3 at the midpoint using k2",
        "compute the slope k4 at the end using k3",
        "advance by h over six with weights one, two, two, one",
        "done: report the trajectory and final value",
    ],
};

export default module;
