/**
 * quantile-regression.ts - Median Regression by Iteratively Reweighted Least Squares
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Median regression fits the line that minimizes the sum of absolute residuals,
 * in contrast to least squares which minimizes squared residuals. Because the
 * absolute value is not differentiable at zero, iteratively reweighted least
 * squares replaces it with a quadratic whose weight is the inverse absolute
 * residual. Repeating the weighted fit converges to the conditional median.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n) for n observations
 *   Space: O(n) for the fitted values and displayed nodes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Observed points are idle nodes; the fitted line is green.
 *   - Each iteration reveals a line that lowers the absolute-error objective.
 */
import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function makeEntities(xs: number[], ys: number[], fitted: number[], revealed: boolean): VisualEntity[] {
    return xs.map((x, i): VisualEntity => ({
        id: `data-${i}`,
        type: "node" as const,
        label: `(${x.toFixed(2)}, ${ys[i] ?? 0})`,
        value: ys[i] ?? 0,
        state: "idle",
        x,
        y: ys[i] ?? 0,
        width: 0,
        height: 0,
        metadata: { index: i, kind: "data" },
    })).concat(xs.map((x, i): VisualEntity => ({
        id: `fit-${i}`,
        type: "node" as const,
        label: revealed ? `fit ${(fitted[i] ?? 0).toFixed(2)}` : "fit",
        value: revealed ? (fitted[i] ?? 0) : 0,
        state: revealed ? "sorted" : "unvisited",
        x,
        y: revealed ? (fitted[i] ?? 0) : 0,
        width: 0,
        height: 0,
        metadata: { index: i, kind: "fit" },
    })));
}

function makeLine(xs: number[], revealed: boolean): VisualEdge[] {
    if (!revealed) return [];
    return Array.from({ length: xs.length - 1 }, (_, i) => ({
        id: `line-${i}`,
        sourceId: `fit-${i}`,
        targetId: `fit-${i + 1}`,
        label: "",
        state: "path" as const,
        directed: false,
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: number[][]; iterations?: number } | null) ?? {};
    const source = Array.isArray(task.points) && task.points.length > 2
        ? task.points
        : [[1, 2], [2, 4], [3, 3], [4, 6], [5, 5], [6, 9], [7, 8], [8, 12], [9, 30]];
    const xs = source.map((p) => Number(p[0]) || 0);
    const ys = source.map((p) => Number(p[1]) || 0);
    const n = xs.length;
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 12;
    const xbar = xs.reduce((s, v) => s + v, 0) / n;
    const ybar = ys.reduce((s, v) => s + v, 0) / n;
    const sxx = xs.reduce((s, x) => s + (x - xbar) ** 2, 0);
    let b1 = sxx === 0 ? 0 : xs.reduce((s, x, i) => s + (x - xbar) * ((ys[i] ?? 0) - ybar), 0) / sxx;
    let b0 = ybar - b1 * xbar;

    const fitAt = (a: number, b: number): number[] => xs.map((x) => a + b * x);
    const objective = (mu: number[]): number => ys.reduce((s, y, i) => s + Math.abs(y - (mu[i] ?? 0)), 0);
    let fitted = fitAt(b0, b1);
    const history: Array<{ b0: number; b1: number; fitted: number[]; loss: number }> = [{ b0, b1, fitted: [...fitted], loss: objective(fitted) }];
    const eps = 1e-4;
    for (let it = 0; it < iterations; it += 1) {
        let s0 = 0, s1 = 0, s2 = 0, t0 = 0, t1 = 0;
        for (let i = 0; i < n; i += 1) {
            const x = xs[i]!;
            const w = 1 / Math.max(Math.abs((ys[i] ?? 0) - (fitted[i] ?? 0)), eps);
            s0 += w;
            s1 += w * x;
            s2 += w * x * x;
            t0 += w * (ys[i] ?? 0);
            t1 += w * x * (ys[i] ?? 0);
        }
        const det = s0 * s2 - s1 * s1;
        if (Math.abs(det) > 1e-12) {
            b1 = (s0 * t1 - s1 * t0) / det;
            b0 = (t0 - b1 * s1) / s0;
        }
        fitted = fitAt(b0, b1);
        history.push({ b0, b1, fitted: [...fitted], loss: objective(fitted) });
    }
    const zeros = new Array<number>(n).fill(0);

    yield {
        stepNumber: 0,
        entities: makeEntities(xs, ys, zeros, false),
        edges: [],
        description: `Fitting a median regression line by minimizing absolute residuals over ${n} points.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n, iterations, b0: history[0]?.b0 ?? b0, b1: history[0]?.b1 ?? b1, loss: history[0]?.loss ?? 0, xs, ys, fitted: zeros },
    };
    for (let it = 0; it < history.length; it += 1) {
        const h = history[it]!;
        yield {
            stepNumber: it + 1,
            entities: makeEntities(xs, ys, h.fitted, true),
            edges: makeLine(xs, true),
            description: `Iteration ${it}: intercept ${h.b0.toFixed(4)}, slope ${h.b1.toFixed(4)}, absolute error ${h.loss.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { n, iterations, b0: h.b0, b1: h.b1, loss: h.loss, xs, ys, fitted: h.fitted, iteration: it },
        };
    }
    yield {
        stepNumber: history.length + 1,
        entities: makeEntities(xs, ys, fitted, true),
        edges: makeLine(xs, true),
        description: `Median fit done: y = ${b0.toFixed(4)} + ${b1.toFixed(4)} x, absolute error ${history.at(-1)?.loss.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { n, iterations, b0, b1, loss: history.at(-1)?.loss ?? 0, xs, ys, fitted },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A least squares line is pulled toward extreme observations because it pays the square of each error. Median regression pays only the absolute error, so a few unusual points have much less influence. Because absolute value has a kink at zero, the fit is found by repeatedly solving a weighted least squares problem whose weights grow for points close to the line.",
        invariants: [
            "Starting from least squares gives a finite initial fit.",
            "The weight of a point is the reciprocal of its current absolute residual, floored at a small epsilon.",
            "The absolute-error objective never has to increase for the final fit to be useful.",
        ],
        correctness:
            "Minimizing the sum of absolute residuals over an affine line is a convex problem whose optimum satisfies a signed-subgradient condition. IRLS approximates the absolute value by a quadratic with weight 1/|residual|; solving the weighted normal equations is a Newton step on the smooth approximation. As the residual floor shrinks the approximation approaches the absolute objective, so the iterates converge to a minimizer of the median regression loss.",
        complexityRationale:
            "Each iteration computes residuals and solves a 2 by 2 weighted system, costing O(n). The replay stores one fitted array per iteration, so space is O(iterations * n).",
        uses: [
            "Robust line fitting when data contain outliers",
            "Estimating conditional medians such as median income or response time",
            "Quantile-based prediction intervals as a building block",
        ],
        references: [
            "Koenker, Quantile Regression, Chapter on computation",
            "Bloomfield and Steiger, Least Absolute Deviations: Theory, Applications, and Algorithms",
        ],
        workedExample:
            "For points (1,2), (2,4), (3,3), (4,6) plus an outlier (9,30), least squares is dragged upward by the outlier. Median regression keeps the line near the four central points because the outlier's large residual contributes only linearly to the objective.",
    },
    id: "quantile-regression",
    name: "Median (Quantile) Regression",
    category: "statistics-probability",
    complexity: { time: "O(iterations * n)", space: "O(iterations * n)" },
    defaultInput: { points: [[1, 2], [2, 4], [3, 3], [4, 6], [5, 5], [6, 9], [7, 8], [8, 12], [9, 30]], iterations: 12 },
    visualType: "point",
    run,
    pseudocode: [
        "read the observations and predictor values",
        "initialize the line with a least squares fit",
        "compute each residual and its inverse absolute weight",
        "solve the weighted normal equations for new coefficients",
        "recompute the sum of absolute residuals",
        "repeat for a fixed number of iterations",
        "done: report the median line and absolute error",
    ],
};

export default module;
