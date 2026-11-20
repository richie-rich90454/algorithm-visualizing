/**
 * ordinary-least-squares.ts - Ordinary Least Squares (Simple Linear Regression)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Ordinary least squares fits a straight line to paired data by minimizing
 * the sum of squared vertical residuals. For a single predictor the solution
 * has a closed form: the slope is the covariance of x and y divided by the
 * variance of x, and the intercept makes the line pass through the sample
 * means. The module reports the fitted line, residuals, and R squared.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n data points
 *   Space: O(n) for the fitted values and residuals
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Data points are blue nodes; fitted points are green nodes.
 *   - Edges join fitted points to draw the regression line.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function makeEntities(
    xs: number[],
    ys: number[],
    fitted: number[],
    revealed: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < xs.length; i += 1) {
        entities.push({
            id: `data-${i}`,
            type: "node",
            label: `(${xs[i]}, ${ys[i]})`,
            value: [xs[i] ?? 0, ys[i] ?? 0],
            state: "idle",
            x: xs[i] ?? 0,
            y: ys[i] ?? 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "data" },
        });
        entities.push({
            id: `fit-${i}`,
            type: "node",
            label: "fit",
            value: revealed ? (fitted[i] ?? 0) : (ys.reduce((s, v) => s + v, 0) / ys.length),
            state: revealed ? "sorted" : "unvisited",
            x: xs[i] ?? 0,
            y: revealed ? (fitted[i] ?? 0) : 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "fit" },
        });
    }
    return entities;
}

function makeEdges(xs: number[], revealed: boolean): VisualEdge[] {
    if (!revealed) {
        return [];
    }
    const edges: VisualEdge[] = [];
    for (let i = 1; i < xs.length; i += 1) {
        edges.push({
            id: `line-${i}`,
            sourceId: `fit-${i - 1}`,
            targetId: `fit-${i}`,
            label: "",
            state: "path",
            directed: false,
        });
    }
    return edges;
}

/** The ordinary least squares generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: number[][] } | null) ?? {};
    const source = Array.isArray(task.points) && task.points.length > 1
        ? task.points
        : [[1, 2], [2, 4], [3, 5], [4, 4], [5, 7], [6, 8]];
    const xs = source.map((p) => p[0]);
    const ys = source.map((p) => p[1]);
    const n = xs.length;
    const xbar = xs.reduce((a, b) => a + b, 0) / n;
    const ybar = ys.reduce((a, b) => a + b, 0) / n;
    let sxx = 0;
    let sxy = 0;
    for (let i = 0; i < n; i += 1) {
        sxx += ((xs[i] ?? 0) - xbar) ** 2;
        sxy += ((xs[i] ?? 0) - xbar) * ((ys[i] ?? 0) - ybar);
    }
    const slope = sxx === 0 ? 0 : sxy / sxx;
    const intercept = ybar - slope * xbar;
    const fitted = xs.map((x) => intercept + slope * x);
    const residuals = ys.map((y, i) => y - (fitted[i] ?? 0));
    const sse = residuals.reduce((sum, r) => sum + r * r, 0);
    const sst = ys.reduce((sum, y) => sum + (y - ybar) ** 2, 0);
    const r2 = sst === 0 ? 1 : 1 - sse / sst;

    const base = { xbar, ybar, slope, intercept, r2, sse, sst, n };

    yield {
        stepNumber: 0,
        entities: makeEntities(xs, ys, fitted, false),
        edges: [],
        description: `Fitting a least-squares line to ${n} data points by minimizing squared residuals.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { ...base, xs, ys, fitted: new Array<number>(n).fill(0), residuals: new Array<number>(n).fill(0) },
    };

    yield {
        stepNumber: 1,
        entities: makeEntities(xs, ys, fitted, false),
        edges: [],
        description: `Compute the sample means x-bar = ${xbar.toFixed(4)} and y-bar = ${ybar.toFixed(4)}.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { ...base, xs, ys, fitted: new Array<number>(n).fill(0), residuals: new Array<number>(n).fill(0) },
    };

    yield {
        stepNumber: 2,
        entities: makeEntities(xs, ys, fitted, false),
        edges: [],
        description: `Spreads are Sxx = ${sxx.toFixed(4)} and Sxy = ${sxy.toFixed(4)} about the means.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { ...base, xs, ys, fitted: new Array<number>(n).fill(0), residuals: new Array<number>(n).fill(0) },
    };

    yield {
        stepNumber: 3,
        entities: makeEntities(xs, ys, fitted, false),
        edges: [],
        description: `Slope b = Sxy / Sxx = ${slope.toFixed(4)}; intercept a = y-bar - b * x-bar = ${intercept.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { ...base, xs, ys, fitted: new Array<number>(n).fill(0), residuals: new Array<number>(n).fill(0) },
    };

    yield {
        stepNumber: 4,
        entities: makeEntities(xs, ys, fitted, true),
        edges: makeEdges(xs, true),
        description: `Fitted values and residuals are computed; the sum of squared errors is ${sse.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { ...base, xs, ys, fitted: [...fitted], residuals: [...residuals] },
    };

    yield {
        stepNumber: 5,
        entities: makeEntities(xs, ys, fitted, true),
        edges: makeEdges(xs, true),
        description: `R squared = ${r2.toFixed(4)}: the fitted line explains that share of the variance in y.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { ...base, xs, ys, fitted: [...fitted], residuals: [...residuals] },
    };
}

/** The ordinary least squares module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Draw a line through a scatter of points so the total squared vertical miss is as small as possible. Moving the line up, down, or rotating it changes that total; the least-squares line sits at the unique bottom of that bowl. It always passes through the point of averages.",
        invariants: [
            "The fitted line passes through the sample means (x-bar, y-bar).",
            "The residuals sum to zero and are uncorrelated with x at the optimum.",
            "R squared lies between zero and one when an intercept is included.",
        ],
        correctness:
            "Writing the sum of squared residuals as a quadratic in the slope and intercept and setting both partial derivatives to zero gives two normal equations. Solving them yields slope Sxy/Sxx and intercept y-bar minus slope times x-bar. Because the objective is a positive definite quadratic in those parameters, this stationary point is the unique global minimum.",
        complexityRationale:
            "Two passes over the n points compute the means and the cross-products, and one more pass computes fitted values and residuals, so the time is O(n) and the stored arrays are O(n).",
        uses: [
            "Fitting a straight-line trend to measurements",
            "Calibrating a sensor response against known standards",
            "The building block of multiple linear regression",
        ],
        references: [
            "Draper and Smith, Applied Regression Analysis, Chapter 2",
            "Montgomery, Peck, and Vining, Introduction to Linear Regression Analysis, Chapter 2",
        ],
        workedExample:
            "For points (1,2), (2,4), (3,5), (4,4), (5,7), (6,8) the means are 3.5 and 5. Sxy is 16 and Sxx is 17.5, giving slope about 0.914 and intercept about 1.8; the line passes through (3.5, 5) and R squared is about 0.84.",
    },
    id: "ordinary-least-squares",
    name: "Ordinary Least Squares",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { points: [[1, 2], [2, 4], [3, 5], [4, 4], [5, 7], [6, 8]] },
    visualType: "point",
    run,
    pseudocode: [
        "read n paired observations",
        "compute the sample means of x and y",
        "accumulate Sxx and Sxy about the means",
        "set slope to Sxy over Sxx, then the intercept",
        "compute fitted values and residuals",
        "sum squared errors and report R squared",
    ],
};

export default module;
