/**
 * explicit-euler-method.ts - Explicit Euler Method for Ordinary Differential Equations
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The explicit Euler method advances an initial value problem y' = f(t, y) one
 * small step at a time using the current slope: y_{n+1} = y_n + h*f(t_n, y_n).
 * It is the simplest one-step integrator. The local truncation error is O(h^2)
 * and the global error over a fixed interval is O(h), so halving the step
 * roughly halves the error.
 *
 * This module demonstrates the model problem y' = lambda*y, whose exact
 * solution y0*exp(lambda*t) is known in closed form. The exact mathematical
 * step shown is the Euler update and the comparison against that solution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps) derivative evaluations
 *   Space: O(steps) to store the trajectory for visualization
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per time level shows the numerical value y at that time.
 *   - The newest value is yellow; the final trajectory is green.
 *   - Time, exact value, and absolute error are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface EulerData {
    lambda: number;
    y0: number;
    h: number;
    trajectory: Array<{ n: number; t: number; y: number; exact: number; error: number }>;
}

/** Integrate y' = lambda*y with explicit Euler and compare to exp. */
export function explicitEuler(lambda: number, y0: number, h: number, steps: number): EulerData {
    const count = Math.max(0, Math.floor(steps));
    const trajectory: EulerData["trajectory"] = [];
    let y = y0;
    for (let n = 0; n <= count; n += 1) {
        const t = n * h;
        const exact = y0 * Math.exp(lambda * t);
        trajectory.push({ n, t, y, exact, error: Math.abs(y - exact) });
        y = y + h * lambda * y;
    }
    return { lambda, y0, h, trajectory };
}

/** Build trajectory bars, revealing values up to `visible`. */
function makeBars(trajectory: EulerData["trajectory"], visible: number, active: boolean, state: EntityState = "idle"): VisualEntity[] {
    return trajectory.map((entry, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `t=${entry.t.toFixed(2)}:${entry.y.toFixed(4)}`,
        value: entry.y,
        state: index === visible && active ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, time: entry.t },
    }));
}

/** The explicit Euler generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { lambda?: number; y0?: number; h?: number; steps?: number } | null) ?? {};
    const lambda = typeof task.lambda === "number" ? task.lambda : -1;
    const y0 = typeof task.y0 === "number" ? task.y0 : 1;
    const h = typeof task.h === "number" && task.h !== 0 ? task.h : 0.1;
    const steps = typeof task.steps === "number" ? Math.max(0, Math.floor(task.steps)) : 10;
    const data = explicitEuler(lambda, y0, h, steps);
    const total = data.trajectory.length;

    let step = 0;
    for (let visible = 0; visible < total; visible += 1) {
        const entry = data.trajectory[visible]!;
        const last = visible === total - 1;
        yield {
            stepNumber: step++,
            entities: makeBars(data.trajectory, visible, !last, last ? "sorted" : "idle"),
            edges: [],
            description: last
                ? `Final value ${entry.y.toFixed(6)} at t=${entry.t.toFixed(2)}; exact ${entry.exact.toFixed(6)}, error ${entry.error.toExponential(2)}.`
                : `Step ${entry.n}: y(${entry.t.toFixed(2)}) = ${entry.y.toFixed(6)} from y + h*lambda*y.`,
            codeLineNumber: last ? 6 : 3,
            layout: "array",
            meta: {
                lambda,
                y0,
                h,
                steps,
                n: entry.n,
                t: entry.t,
                y: entry.y,
                exact: entry.exact,
                error: entry.error,
            },
        };
    }
}

/** The explicit Euler module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Use the slope you can see right now to take one small step forward, then repeat. A tiny time step keeps the error small because the slope does not change much over a short interval. It is the first method students meet because the update is just the current value plus the step size times the derivative.",
        invariants: [
            "Each value is computed only from the immediately previous value and its slope.",
            "For the decay problem with lambda below zero and small h, values stay positive and shrink.",
            "The global error at a fixed time is proportional to the step size h.",
        ],
        correctness:
            "Taylor expansion gives y(t+h) = y(t) + h*y'(t) + (h squared / 2)*y''(xi), so dropping the remainder leaves a local error of order h squared. Over a fixed interval of length T there are T/h steps, and the errors accumulate to order h, which is first-order convergence. For the model problem y' = lambda*y the update is y_{n+1} = (1 + lambda*h)*y_n, so y_n = (1 + lambda*h)^n*y0, which tends to exp(lambda*T) as h tends to zero.",
        complexityRationale:
            "Each of the steps evaluates the derivative once and does a constant amount of arithmetic, O(steps) time. Storing the whole trajectory for playback uses O(steps) space.",
        uses: [
            "Introductory numerical solutions of differential equations",
            "Simple physical simulations and particle motion",
            "A baseline integrator for comparing higher-order methods",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, Section 5.2",
            "Press et al., Numerical Recipes, Chapter 17",
        ],
        workedExample:
            "For y' = -y with y(0) = 1 and h = 0.1, the updates give y(0.1) = 0.9 and y(0.2) = 0.81, versus exact values 0.9048 and 0.8187. After ten steps the estimate is about 0.3487 against the exact exp(-1) of 0.3679, an error that shrinks linearly with h.",
    },
    id: "explicit-euler-method",
    name: "Explicit Euler Method",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { lambda: -1, y0: 1, h: 0.1, steps: 10 },
    visualType: "array",
    run,
    pseudocode: [
        "set y to the initial value at time zero",
        "for each time step up to the requested count",
        "evaluate the derivative lambda times y",
        "advance y by step size times that derivative",
        "advance the time by one step size",
        "compare with the closed-form exponential solution",
        "record the absolute error at this time",
        "done: report the final trajectory and error",
    ],
};

export default module;
