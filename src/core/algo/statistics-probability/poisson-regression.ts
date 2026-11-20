/**
 * poisson-regression.ts - Poisson Regression by Iteratively Reweighted Least Squares
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Poisson regression models nonnegative counts with a log link: the log of the
 * expected count is a straight line in the predictor. Because the variance
 * equals the mean, the score equations have no simple closed form. Iteratively
 * reweighted least squares solves them by repeating a weighted linear fit with
 * weights equal to the current fitted means.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n) for n observations
 *   Space: O(n) for the fitted means and displayed nodes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Observed counts are idle nodes; fitted means form a green line.
 *   - Each iteration reveals a better fitting line through the points.
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
        : [[1, 2], [2, 3], [3, 5], [4, 4], [5, 8], [6, 9], [7, 11], [8, 12]];
    const xs = source.map((p) => Number(p[0]) || 0);
    const ys = source.map((p) => Math.max(0, Number(p[1]) || 0));
    const n = xs.length;
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 8;
    const meanY = Math.max(0.1, ys.reduce((s, v) => s + v, 0) / n);
    let b0 = Math.log(meanY);
    let b1 = 0;

    const fitAt = (a: number, b: number): number[] => xs.map((x) => Math.min(1e6, Math.exp(a + b * x)));
    let fitted = fitAt(b0, b1);
    const history: Array<{ b0: number; b1: number; fitted: number[]; deviance: number }> = [];
    const devianceOf = (mu: number[]): number => ys.reduce((s, y, i) => {
        const m = mu[i] ?? 1;
        const term = y > 0 ? y * Math.log(y / m) : 0;
        return s + 2 * (term - (y - m));
    }, 0);

    history.push({ b0, b1, fitted: [...fitted], deviance: devianceOf(fitted) });
    for (let it = 0; it < iterations; it += 1) {
        let s0 = 0, s1 = 0, s2 = 0, t0 = 0, t1 = 0;
        for (let i = 0; i < n; i += 1) {
            const x = xs[i]!;
            const y = ys[i]!;
            const mu = Math.min(1e6, Math.max(1e-6, fitted[i] ?? 1));
            const w = mu;
            const z = Math.log(mu) + (y - mu) / mu;
            s0 += w;
            s1 += w * x;
            s2 += w * x * x;
            t0 += w * z;
            t1 += w * x * z;
        }
        const det = s0 * s2 - s1 * s1;
        if (Math.abs(det) > 1e-12) {
            b1 = (s0 * t1 - s1 * t0) / det;
            b0 = (t0 - b1 * s1) / s0;
        }
        fitted = fitAt(b0, b1);
        history.push({ b0, b1, fitted: [...fitted], deviance: devianceOf(fitted) });
    }

    const score0 = ys.reduce((s, y, i) => s + (y - (fitted[i] ?? 0)), 0);
    const score1 = ys.reduce((s, y, i) => s + xs[i]! * (y - (fitted[i] ?? 0)), 0);
    const zeros = new Array<number>(n).fill(0);

    yield {
        stepNumber: 0,
        entities: makeEntities(xs, ys, zeros, false),
        edges: [],
        description: `Fitting a Poisson log-linear model to ${n} count observations.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n, iterations, b0: history[0]?.b0 ?? b0, b1: history[0]?.b1 ?? b1, score0, score1, deviance: history[0]?.deviance ?? 0, xs, ys, fitted: zeros },
    };
    for (let it = 0; it < history.length; it += 1) {
        const h = history[it]!;
        yield {
            stepNumber: it + 1,
            entities: makeEntities(xs, ys, h.fitted, true),
            edges: makeLine(xs, true),
            description: `Iteration ${it}: intercept ${h.b0.toFixed(4)}, slope ${h.b1.toFixed(4)}, deviance ${h.deviance.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { n, iterations, b0: h.b0, b1: h.b1, score0, score1, deviance: h.deviance, xs, ys, fitted: h.fitted, iteration: it },
        };
    }
    yield {
        stepNumber: history.length + 1,
        entities: makeEntities(xs, ys, fitted, true),
        edges: makeLine(xs, true),
        description: `Poisson fit done: log mean = ${b0.toFixed(4)} + ${b1.toFixed(4)} x; scores ${score0.toFixed(3)}, ${score1.toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { n, iterations, b0, b1, score0, score1, deviance: history.at(-1)?.deviance ?? 0, xs, ys, fitted },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Counts cannot be negative and their spread grows with their level, so a straight-line model on the raw scale is a poor fit. Poisson regression instead fits a straight line to the log of the expected count. Each reweighted least squares step treats the current fitted means as variances and takes one Newton-like step toward the best coefficients.",
        invariants: [
            "Every fitted mean is positive because it is the exponential of a linear predictor.",
            "The weights in each step equal the current fitted means.",
            "At convergence the two score equations summing observed minus fitted counts, with and without x, are near zero.",
        ],
        correctness:
            "The Poisson log-likelihood has score vector sum of (y_i - mu_i) times (1, x_i). Setting it to zero gives the maximum likelihood equations. Because the Fisher information is the sum of mu_i times (1, x_i)(1, x_i), one Fisher scoring step solves a weighted least squares problem with weights mu_i and working response log(mu_i) + (y_i - mu_i)/mu_i. Iterating these steps converges to the score root, so the final coefficients satisfy the likelihood equations.",
        complexityRationale:
            "Each iteration scans the n observations once to form the weighted normal equations, costing O(n). Storing the data, fitted means, and history uses O(iterations * n) space for the replay frames.",
        uses: [
            "Modeling event counts such as traffic accidents or disease cases",
            "Analyzing frequencies in contingency tables with covariates",
            "Estimating rates with offset terms in epidemiology",
        ],
        references: [
            "Nelder and Wedderburn, Generalized Linear Models, 1972",
            "McCullagh and Nelder, Generalized Linear Models, Chapter on Poisson models",
        ],
        workedExample:
            "For counts 2, 3, 5, 4 at x = 1, 2, 3, 4, starting from the log of the mean count, one IRLS step reweights each point by its fitted mean and solves the 2 by 2 normal equations. A few steps drive the intercept and slope until observed and fitted totals match.",
    },
    id: "poisson-regression",
    name: "Poisson Regression",
    category: "statistics-probability",
    complexity: { time: "O(iterations * n)", space: "O(iterations * n)" },
    defaultInput: { points: [[1, 2], [2, 3], [3, 5], [4, 4], [5, 8], [6, 9], [7, 11], [8, 12]], iterations: 8 },
    visualType: "point",
    run,
    pseudocode: [
        "read count observations and their predictor values",
        "initialize the log-rate intercept at the log mean count",
        "compute fitted means as the exponential of the linear predictor",
        "form working responses and weights equal to the fitted means",
        "solve the weighted normal equations for new coefficients",
        "repeat until the score equations are nearly zero",
        "done: report the coefficients and deviance",
    ],
};

export default module;
