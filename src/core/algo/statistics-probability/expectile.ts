/**
 * expectile.ts - Expectile by Asymmetric Least Squares
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An expectile generalizes the mean. Where a quantile balances the count of
 * points on each side, an expectile balances the squared distances, with a
 * weight tau above the estimate and 1 - tau below it. It is found by a short
 * fixed-point iteration that converges linearly for any data set.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n) for n values
 *   Space: O(n) for the displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each sample value is drawn as a bar.
 *   - Values above the current expectile are highlighted one way, values below
 *     another, so the imbalance in squared distance is visible.
 *   - The final frame is green and reports the converged expectile.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], estimate: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: done
            ? "sorted"
            : (value > estimate ? "active" : value < estimate ? "comparing" : "pivot"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; tau?: number } | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map((v) => Number(v) || 0)
        : [1, 2, 3, 4, 10];
    const tau = typeof task.tau === "number" && task.tau > 0 && task.tau < 1 ? task.tau : 0.8;
    const n = values.length;
    let estimate = values.reduce((total, v) => total + v, 0) / n;
    const tolerance = 1e-10;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values, estimate, false),
        edges: [],
        description: `Finding the ${tau.toFixed(2)}-expectile of ${n} value(s), starting from the mean ${estimate.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, tau, estimate, iteration: 0, delta: 0 },
    };
    step += 1;

    for (let iteration = 1; iteration <= 200; iteration += 1) {
        let excess = 0;
        let deficit = 0;
        for (const value of values) {
            if (value > estimate) {
                excess += value - estimate;
            } else if (value < estimate) {
                deficit += estimate - value;
            }
        }
        const delta = (tau * excess - (1 - tau) * deficit) / n;
        estimate += delta;
        yield {
            stepNumber: step,
            entities: makeBars(values, estimate, false),
            edges: [],
            description: `Iteration ${iteration}: excess ${excess.toFixed(4)}, deficit ${deficit.toFixed(4)}; expectile now ${estimate.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, tau, estimate, iteration, delta, excess, deficit },
        };
        step += 1;
        if (Math.abs(delta) < tolerance) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(values, estimate, true),
        edges: [],
        description: `Converged to the ${tau.toFixed(2)}-expectile ${estimate.toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, tau, expectile: estimate, iterations: step - 1 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An expectile is a location summary that can lean toward the high or low tail. It minimizes a squared-error loss where mistakes above the estimate cost tau and mistakes below cost 1 minus tau. Setting tau to one half gives the ordinary mean; values closer to one push the estimate toward large observations.",
        invariants: [
            "At the solution, tau times the total excess above equals (1 - tau) times the total deficit below.",
            "The update moves the estimate in the direction of the larger weighted squared-error side.",
            "For tau = 0.5 the positive and negative contributions cancel exactly at the mean.",
        ],
        correctness:
            "The objective is a convex piecewise quadratic whose derivative is twice the weighted imbalance of distances. Because the second derivative is a positive constant, one Newton-style step divides that imbalance by n and lands on the minimizer when the data on each side does not change. Iterating therefore converges to the unique expectile, and the stopping test guarantees the imbalance is smaller than the tolerance.",
        complexityRationale:
            "Each iteration scans all n values once to accumulate excess and deficit, so the time is O(iterations * n). Only the bars and a few scalar accumulators are stored, giving O(n) space.",
        uses: [
            "Asymmetric risk measures in finance, such as expected shortfall",
            "Regression models for conditional tails, known as expectile regression",
            "Smooth alternatives to quantiles in forecasting and calibration",
        ],
        references: [
            "Newey and Powell, Asymmetric Least Squares Estimation and Testing, 1987",
            "Koenker, Quantile Regression, 2005",
        ],
        workedExample:
            "For the values 1, 2, 3, 4, 10 with tau = 0.8, the mean 4 leaves excess 6 and deficit 6. The first update adds (0.8*6 - 0.2*6)/5 = 0.72, giving 4.72. Repeating drives the expectile up to 6.25, where four times the excess above equals the deficit below, well above the mean because the large value is weighted more heavily.",
    },
    id: "expectile",
    name: "Expectile",
    category: "statistics-probability",
    complexity: { time: "O(iterations * n)", space: "O(n)" },
    defaultInput: { values: [1, 2, 3, 4, 10], tau: 0.8 },
    visualType: "array",
    run,
    pseudocode: [
        "read the values and the target level tau",
        "initialize the expectile to the sample mean",
        "repeat until the update is smaller than the tolerance",
        "sum excess above and deficit below the expectile",
        "move the expectile by (tau excess minus (1-tau) deficit) over n",
        "stop when the change falls below the tolerance",
        "report the converged expectile",
    ],
};

export default module;
