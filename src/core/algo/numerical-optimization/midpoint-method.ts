/**
 * midpoint-method.ts - Explicit Midpoint Method for Ordinary Differential Equations
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The explicit midpoint method is a second-order Runge-Kutta step. Instead of
 * using only the slope at the start of a step, it samples the slope at the
 * midpoint obtained by a half Euler step, then advances across the whole step
 * with that midpoint slope. Its local error is O(h^3) and its global error is
 * O(h^2), one order better than explicit Euler at the cost of one extra
 * derivative evaluation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(steps) derivative evaluations, two per step
 *   Space: O(steps) for the trajectory record
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One bar per step shows the computed value of y.
 *   - The most recent step is yellow; the finished trajectory is green.
 *   - meta carries the time grid, the exact solution, and the endpoint error.
 *
 * The model problem y' = -2ty with y(0) = 1 is solved exactly for at most 200
 * steps; the analytic solution exp(-t^2) supplies a genuine error check.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    t0?: number;
    t1?: number;
    y0?: number;
    steps?: number;
}

/** The model differential equation y' = -2 t y. */
function derivative(t: number, y: number): number {
    return -2 * t * y;
}

/** Analytic solution of y' = -2ty through (t0, y0). */
function analytic(t: number, t0: number, y0: number): number {
    return y0 * Math.exp(t0 * t0 - t * t);
}

/** Build bars for the trajectory values found so far. */
function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: done ? ("sorted" as EntityState) : index === active ? ("comparing" as EntityState) : ("idle" as EntityState),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const t0 = typeof task.t0 === "number" && Number.isFinite(task.t0) ? task.t0 : 0;
    const requestedT1 = typeof task.t1 === "number" && Number.isFinite(task.t1) ? task.t1 : 1;
    const t1 = requestedT1 > t0 ? requestedT1 : t0 + 1;
    const y0 = typeof task.y0 === "number" && Number.isFinite(task.y0) ? task.y0 : 1;
    const steps = typeof task.steps === "number" && Number.isFinite(task.steps)
        ? Math.max(1, Math.min(200, Math.round(task.steps)))
        : 10;

    const h = (t1 - t0) / steps;
    const times = Array.from({ length: steps + 1 }, (_, i) => t0 + i * h);
    const values = [y0];
    const exactValues = times.map((t) => analytic(t, t0, y0));

    const meta = (active: number, done: boolean) => {
        const last = values.length - 1;
        return {
            steps,
            stepSize: h,
            t0,
            t1,
            times: [...times],
            values: [...values],
            exactValues: [...exactValues],
            currentTime: times[active < 0 ? last : active] ?? t0,
            currentValue: values[active < 0 ? last : active] ?? y0,
            finalValue: values[last] ?? y0,
            analyticFinal: exactValues[last] ?? y0,
            globalError: Math.abs((values[last] ?? y0) - (exactValues[last] ?? y0)),
            active,
            done,
        };
    };

    yield {
        stepNumber: 0,
        entities: makeBars(values, -1, false),
        edges: [],
        description: `Solving y' = -2ty on [${t0}, ${t1}] with ${steps} midpoint steps of size ${h.toFixed(5)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(-1, false),
    };

    for (let i = 0; i < steps; i += 1) {
        const t = times[i] ?? t0;
        const y = values[i] ?? y0;
        const k1 = derivative(t, y);
        const k2 = derivative(t + h / 2, y + (h * k1) / 2);
        const next = y + h * k2;
        values.push(next);
        yield {
            stepNumber: i + 1,
            entities: makeBars(values, i + 1, false),
            edges: [],
            description: `Step ${i + 1}: slope at midpoint ${(t + h / 2).toFixed(5)} is ${k2.toFixed(6)}, so y advances to ${next.toFixed(6)}.`,
            codeLineNumber: i === steps - 1 ? 4 : 3,
            layout: "array",
            meta: meta(i + 1, false),
        };
    }

    yield {
        stepNumber: steps + 1,
        entities: makeBars(values, -1, true),
        edges: [],
        description: `Midpoint result y(${t1}) = ${(values[steps] ?? y0).toFixed(8)} versus exact ${(exactValues[steps] ?? y0).toFixed(8)}; error ${Math.abs((values[steps] ?? y0) - (exactValues[steps] ?? y0)).toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: meta(-1, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Euler takes one slope at the start of a step and can drift badly. The midpoint method looks ahead half a step, evaluates the slope there, and uses that single better slope for the whole step. The extra evaluation cancels the leading error term of Euler, so halving the step size cuts the error by about four instead of two.",
        invariants: [
            "Each step samples the derivative at t plus half the step size.",
            "The midpoint value used for that sample is the Euler prediction y plus half the step times the starting slope.",
            "For the model problem the exact solution exp(-t squared) is known at every grid point.",
        ],
        correctness:
            "Expanding y(t plus h) in a Taylor series about t gives y plus h f plus h squared over two times the total derivative, and so on. The midpoint update y plus h times f evaluated at t plus h over two with the Euler predicted value agrees with that expansion through terms of order h squared, so the local truncation error is order h cubed. Over a fixed interval of order one over h steps the errors accumulate to order h squared. Comparing against the exact exp(-t squared) solution measures this directly, and halving h quarters the observed error.",
        complexityRationale:
            "Every step evaluates the derivative twice and does constant arithmetic, so time is proportional to the number of steps. Recording the trajectory and the exact grid values uses space proportional to the number of steps.",
        uses: [
            "Integrating smooth ordinary differential equations in simulation code",
            "A teaching bridge between explicit Euler and full Runge-Kutta methods",
            "Real-time physics updates where one extra derivative evaluation is cheap",
        ],
        references: [
            "Butcher, Numerical Methods for Ordinary Differential Equations, chapters on Runge-Kutta methods",
            "Numerical Recipes, section on Runge-Kutta integration",
        ],
        workedExample:
            "From t equals zero with y equals one and step size one, the starting slope is zero, the midpoint prediction is still one, and the slope at t equals one half is minus one. The update gives y(1) about zero, compared with the exact exp(-1) about 0.3679; with ten steps the error falls to roughly 0.0003, showing second-order convergence.",
    },
    id: "midpoint-method",
    name: "Explicit Midpoint Method",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { t0: 0, t1: 1, y0: 1, steps: 10 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the interval, initial value, and step count",
        "set the step size h and record y at the start",
        "for each step compute k1 as f(t, y)",
        "compute k2 as f(t + h/2, y + h*k1/2)",
        "advance y to y + h*k2 and advance t by h",
        "compare the computed endpoint with the exact solution",
        "done: report the trajectory and the global error",
    ],
};

export default module;
