/**
 * adams-bashforth.ts - Fourth-Order Adams-Bashforth Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adams-Bashforth is an explicit linear multistep method for ordinary
 * differential equations. The fourth-order rule advances the solution using a
 * weighted combination of the last four derivative values, so after a Runge
 * Kutta start it needs only one new derivative evaluation per step. This demo
 * applies it to the linear equation y' = lambda y, whose exact solution is known.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps) derivative evaluations
 *   Space: O(steps) for the stored time series
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per time step shows the computed solution value.
 *   - Runge Kutta startup values are yellow; Adams-Bashforth values are blue.
 *   - The final bar is green and metadata reports the error against the exact
 *     exponential.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build the solution time series bars. */
function makeBars(ys: number[], visible: number, kind: "startup" | "multistep" | "done"): VisualEntity[] {
    return ys.map((value, index) => {
        let state: EntityState = "unvisited";
        if (index <= visible) {
            if (kind === "done" && index === visible) {
                state = "sorted";
            } else if (index <= 3) {
                state = "comparing";
            } else {
                state = "active";
            }
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value === 0 && index > visible ? "-" : value.toFixed(5),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, time: index },
        };
    });
}

/** One classical fourth-order Runge Kutta step for y' = lambda y. */
function rk4(y: number, lambda: number, h: number): number {
    const k1 = lambda * y;
    const k2 = lambda * (y + (h * k1) / 2);
    const k3 = lambda * (y + (h * k2) / 2);
    const k4 = lambda * (y + h * k3);
    return y + (h * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
}

/** The Adams-Bashforth generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { lambda?: number; y0?: number; h?: number; steps?: number } | null) ?? {};
    const lambda = typeof task.lambda === "number" ? task.lambda : 1;
    const y0 = typeof task.y0 === "number" ? task.y0 : 1;
    const h = typeof task.h === "number" && task.h > 0 ? task.h : 0.1;
    const steps = typeof task.steps === "number" && task.steps >= 4
        ? Math.max(4, Math.floor(task.steps))
        : 8;

    const ys = new Array<number>(steps + 1).fill(0);
    ys[0] = y0;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(ys, 0, "startup"),
        edges: [],
        description: `Solving y' = ${lambda} y with step size ${h}; the exact solution is y0 times exp(lambda t).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, time: 0, y: y0, exact: y0, error: 0, method: "initial", steps },
    };
    step += 1;

    for (let i = 1; i <= steps; i += 1) {
        if (i <= 3) {
            ys[i] = rk4(ys[i - 1] ?? 0, lambda, h);
        } else {
            const f3 = lambda * (ys[i - 1] ?? 0);
            const f2 = lambda * (ys[i - 2] ?? 0);
            const f1 = lambda * (ys[i - 3] ?? 0);
            const f0 = lambda * (ys[i - 4] ?? 0);
            ys[i] = (ys[i - 1] ?? 0) + (h * (55 * f3 - 59 * f2 + 37 * f1 - 9 * f0)) / 24;
        }
        if (!Number.isFinite(ys[i])) {
            ys[i] = ys[i - 1] ?? 0;
        }
        const time = i * h;
        const exact = y0 * Math.exp(lambda * time);
        const error = Math.abs((ys[i] ?? 0) - exact);
        const last = i === steps;
        yield {
            stepNumber: step,
            entities: makeBars(ys, i, last ? "done" : i <= 3 ? "startup" : "multistep"),
            edges: [],
            description: last
                ? `Final value ${(ys[i] ?? 0).toFixed(6)} at t = ${time.toFixed(2)}; absolute error ${error.toExponential(2)}.`
                : `Step ${i}: ${i <= 3 ? "Runge Kutta startup" : "Adams-Bashforth four-step"} gives y = ${(ys[i] ?? 0).toFixed(6)} at t = ${time.toFixed(2)}.`,
            codeLineNumber: i <= 3 ? 2 : 4,
            layout: "array",
            meta: {
                step: i,
                time,
                y: ys[i] ?? 0,
                exact,
                error,
                method: i <= 3 ? "RK4" : "AB4",
                steps,
                series: [...ys.slice(0, i + 1)],
            },
        };
        step += 1;
    }
}

/** The Adams-Bashforth module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A single-step method such as Runge Kutta uses only the newest slope to advance. A multistep method remembers several past slopes and combines them, which reaches the same order with fewer derivative evaluations. Adams-Bashforth uses only past slopes, so it is explicit and easy to implement once three startup values are available.",
        invariants: [
            "The first three values are produced by fourth-order Runge Kutta.",
            "Each Adams-Bashforth step uses exactly the four most recent derivative values.",
            "For the linear test equation the computed values approach y0 times exp(lambda t).",
        ],
        correctness:
            "Each derivative is integrated over one step and the integrand is replaced by the cubic polynomial interpolating the last four derivative values. That interpolation is exact for polynomials of degree three, so the local truncation error is O(h^5) and the accumulated global error is O(h^4). The Runge Kutta startup is itself fourth order, so it does not degrade the global order.",
        complexityRationale:
            "After startup each step evaluates the right-hand side once and combines four stored values, so the work is O(steps) derivative calls and O(steps) storage for the reported series.",
        uses: [
            "Integrating ordinary differential equations in scientific simulation",
            "Ordinary differential equations in chemical kinetics and population models",
            "A predictor in Adams-Bashforth-Moulton predictor-corrector pairs",
        ],
        references: [
            "Hairer, Norsett, and Wanner, Solving Ordinary Differential Equations I, 1993",
            "Burden and Faires, Numerical Analysis, Section 5.4",
        ],
        workedExample:
            "With lambda = 1, y0 = 1, and h = 0.1, three Runge Kutta steps give about 1.34986 at t = 0.3. The first Adams-Bashforth step uses the four slopes near 1.35 and yields about 1.49179 at t = 0.4, close to exp(0.4) = 1.49182.",
    },
    id: "adams-bashforth",
    name: "Adams-Bashforth (Order 4)",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { lambda: 1, y0: 1, h: 0.1, steps: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "set y zero to the initial value",
        "compute the first three values with fourth-order Runge Kutta",
        "form the four most recent derivative values",
        "estimate the next value as y plus h over 24 times (55 f3 - 59 f2 + 37 f1 - 9 f0)",
        "store the new value and discard the oldest derivative",
        "repeat until the final time is reached",
        "compare each value with the exact exponential solution",
        "done: report the computed time series and its error",
    ],
};

export default module;
