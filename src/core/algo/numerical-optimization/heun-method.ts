/**
 * heun-method.ts - Heun's Method for Ordinary Differential Equations
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Heun's method, also called the improved Euler method, solves y' = f(t, y)
 * with a predictor and a corrector. The predictor takes one explicit Euler
 * step, the corrector evaluates the derivative again at the predicted point,
 * and the final update uses the trapezoid of the two derivatives. It is a
 * second-order Runge-Kutta method: the local error is O(h^3) and the global
 * error is O(h^2), a clear improvement over explicit Euler at one extra
 * derivative evaluation per step.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) derivative evaluations for n steps, two per step
 *   Space: O(n) for the table of times and values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid holds one row per step: t, k1, predictor, k2, and new y.
 *   - The row being corrected is yellow; completed rows are green.
 *   - The final frame reports the value and its error against the exact solution.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type FunctionName = "exp" | "linear" | "cos" | "constant";

const NAMES: FunctionName[] = ["exp", "linear", "cos", "constant"];
const COLS = ["step", "t", "k1", "predictor", "k2", "y"];

function derivative(name: FunctionName, t: number, y: number): number {
    switch (name) {
        case "exp":
            return y;
        case "linear":
            return t;
        case "cos":
            return Math.cos(t);
        case "constant":
            return 3;
    }
}

function exact(name: FunctionName, t: number, t0: number, y0: number): number {
    switch (name) {
        case "exp":
            return y0 * Math.exp(t - t0);
        case "linear":
            return y0 + (t * t - t0 * t0) / 2;
        case "cos":
            return y0 + Math.sin(t) - Math.sin(t0);
        case "constant":
            return y0 + 3 * (t - t0);
    }
}

function makeCells(rows: number[][], active: number, finished: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < rows.length; r += 1) {
        for (let c = 0; c < COLS.length; c += 1) {
            const value = rows[r]?.[c] ?? 0;
            const state: EntityState = finished ? "sorted" : r === active ? "comparing" : r < active ? "sorted" : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: c === 0 ? String(r) : value.toFixed(5),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, role: COLS[c] ?? "value" },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { fn?: string; t0?: number; y0?: number; tEnd?: number; n?: number } | null
    ) ?? {};
    const fn = NAMES.includes(task.fn as FunctionName) ? (task.fn as FunctionName) : "exp";
    const rawT0 = typeof task.t0 === "number" && Number.isFinite(task.t0) ? task.t0 : 0;
    const rawT1 = typeof task.tEnd === "number" && Number.isFinite(task.tEnd) ? task.tEnd : 1;
    const t0 = Math.min(rawT0, rawT1);
    const tEnd = Math.max(rawT0, rawT1);
    const y0 = typeof task.y0 === "number" && Number.isFinite(task.y0) ? task.y0 : 1;
    const requested = typeof task.n === "number" && Number.isFinite(task.n) ? Math.floor(task.n) : 10;
    const n = Math.max(1, Math.min(100, requested));
    const h = (tEnd - t0) / n;

    const ts: number[] = [t0];
    const ys: number[] = [y0];
    const rows: number[][] = Array.from({ length: n + 1 }, (_, r) => [
        r,
        t0 + r * h,
        0,
        0,
        0,
        r === 0 ? y0 : 0,
    ]);
    const meta = (step: number, done: boolean) => {
        const exactEnd = exact(fn, tEnd, t0, y0);
        const approximation = ys[ys.length - 1] ?? y0;
        return {
            fn,
            t0,
            tEnd,
            y0,
            n,
            h,
            rows: n + 1,
            cols: COLS.length,
            ts: [...ts],
            ys: [...ys],
            step,
            approximation,
            exact: exactEnd,
            error: Math.abs(approximation - exactEnd),
            order: 2,
            done,
        };
    };

    yield {
        stepNumber: 0,
        entities: makeCells(rows, -1, false),
        edges: [],
        description: `Solving y' = ${fn} from t = ${t0} to ${tEnd} with ${n} Heun steps of size ${h.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, false),
    };

    let step = 1;
    for (let i = 0; i < n; i += 1) {
        const t = t0 + i * h;
        const y = ys[i] ?? 0;
        const k1 = derivative(fn, t, y);
        const predictor = y + h * k1;
        const k2 = derivative(fn, t + h, predictor);
        const next = y + (h / 2) * (k1 + k2);
        ts.push(t + h);
        ys.push(next);
        rows[i + 1] = [i + 1, t + h, k1, predictor, k2, next];
        yield {
            stepNumber: step,
            entities: makeCells(rows, i + 1, false),
            edges: [],
            description: `Step ${i + 1}: predictor ${predictor.toFixed(5)}, corrector ${k2.toFixed(5)}, y = ${next.toFixed(5)}.`,
            codeLineNumber: i === 0 ? 2 : 4,
            layout: "grid",
            meta: meta(step, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, true),
        edges: [],
        description: `Heun estimate ${(ys[n] ?? 0).toFixed(8)} versus exact ${exact(fn, tEnd, t0, y0).toFixed(8)} (error ${meta(step, true).error.toExponential(2)}).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: meta(step, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single Euler step uses the slope at the start of the interval, which overshoots a curved solution. Heun's method first takes that rough step, measures the slope at the far end, and then redoes the step with the average of the two slopes. Averaging the slopes cancels the leading error and makes the method second order.",
        invariants: [
            "Every step evaluates the derivative exactly twice: once at the current point and once at the predictor.",
            "The update is the trapezoid rule applied to the derivative over the step.",
            "For a constant derivative the predictor and corrector agree, so the exact linear solution is reproduced.",
        ],
        correctness:
            "Expand the exact solution in a Taylor series about t and compare it with the Heun update. Both agree through the h squared term; the difference begins at h cubed, so the local truncation error is O(h cubed). Across n fixed-length steps the errors accumulate to O(h squared). For y' = constant the predictor equals the exact endpoint, the two slopes are equal, and the update reproduces the straight-line solution exactly.",
        complexityRationale:
            "Each of the n steps computes two derivatives and constant work, so time is O(n). Storing the times, values, and table rows uses O(n) space.",
        uses: [
            "Integrating ordinary differential equations in engineering simulation",
            "A teaching bridge between explicit Euler and full Runge-Kutta methods",
            "Lightweight numerical solvers where derivative evaluations are cheap",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, section on Runge-Kutta methods",
            "Hairer, Norsett, and Wanner, Solving Ordinary Differential Equations I",
        ],
        workedExample:
            "For y' = y with y(0) = 1 and step 0.5, the predictor is 1.5 and the corrector slope is 1.5, so y(0.5) = 1 + 0.25 times (1 + 1.5) = 1.625, versus the exact 1.6487. Halving the step cuts the final error by roughly a factor of four, confirming second order.",
    },
    id: "heun-method",
    name: "Heun's Method",
    category: "numerical-optimization",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { fn: "exp", t0: 0, y0: 1, tEnd: 1, n: 10 },
    visualType: "grid",
    run,
    pseudocode: [
        "set the step size h from the interval and step count",
        "evaluate the slope k1 at the current point",
        "predict the endpoint using one Euler step",
        "evaluate the slope k2 at the predicted endpoint",
        "advance y by half h times the sum of the slopes",
        "repeat until the end time is reached",
        "done: report the final value and its error",
    ],
};

export default module;
