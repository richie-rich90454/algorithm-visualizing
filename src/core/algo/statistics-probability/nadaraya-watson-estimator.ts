/**
 * nadaraya-watson-estimator.ts - Nadaraya-Watson Kernel Regression
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Nadaraya-Watson estimator fits a smooth curve through scattered points by
 * averaging nearby responses. At a query x it weights every training point with
 * a kernel of the scaled distance (x - xi)/h and returns the weighted mean of
 * the yi. A Gaussian kernel gives strictly positive weights, so the prediction
 * is always a convex combination of the observed responses. A small bandwidth
 * interpolates the data; a large one approaches the global mean.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(queryPoints * n) for n training points
 *   Space: O(queryPoints + n) for the grid and training arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per query point shows the fitted value.
 *   - The bar being evaluated is yellow; the finished curve is green.
 *   - The final frame reports the bandwidth and the training sample size.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, prediction: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { xs?: number[]; ys?: number[]; bandwidth?: number; queryPoints?: number } | null) ?? {};
    const inputXs: number[] = Array.isArray(task.xs) ? task.xs.filter((value) => Number.isFinite(value)) : [0, 1, 2, 3, 4];
    const inputYs: number[] = Array.isArray(task.ys) ? task.ys.filter((value) => Number.isFinite(value)) : [0, 1, 4, 9, 16];
    const n = Math.min(inputXs.length, inputYs.length);
    const xs = inputXs.slice(0, n);
    const ys = inputYs.slice(0, n);
    const bandwidth = typeof task.bandwidth === "number" && task.bandwidth > 0 ? task.bandwidth : 1;
    const queryPoints = typeof task.queryPoints === "number" ? Math.max(2, Math.min(200, Math.floor(task.queryPoints))) : 20;
    const minX = xs.length > 0 ? Math.min(...xs) : 0;
    const maxX = xs.length > 0 ? Math.max(...xs) : 1;
    const grid = Array.from({ length: queryPoints + 1 }, (_, i) => minX + ((maxX - minX) * i) / queryPoints);

    const predict = (x: number): number => {
        if (n === 0) return 0;
        let weightSum = 0;
        let weightedValues = 0;
        for (let i = 0; i < n; i += 1) {
            const u = (x - (xs[i] as number)) / bandwidth;
            const weight = Math.exp(-0.5 * u * u);
            weightSum += weight;
            weightedValues += weight * (ys[i] as number);
        }
        return weightedValues / weightSum;
    };

    const predictions: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(queryPoints + 1).fill(0), -1, false),
        edges: [],
        description: `Fitting a Nadaraya-Watson curve to ${n} point(s) with bandwidth ${bandwidth}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { xs, ys, n, bandwidth, queryPoints, grid, predictions: [], complete: false },
    };
    let step = 1;

    for (let i = 0; i < grid.length; i += 1) {
        const prediction = predict(grid[i] as number);
        predictions.push(prediction);
        yield {
            stepNumber: step,
            entities: makeBars([...predictions, ...new Array<number>(queryPoints - i).fill(0)], i, false),
            edges: [],
            description: `At x = ${(grid[i] as number).toFixed(3)}: fitted value ${prediction.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { xs, ys, n, bandwidth, queryPoints, grid, predictions: [...predictions], complete: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(predictions, queryPoints + 1, true),
        edges: [],
        description: `Kernel regression complete: ${predictions.length} fitted value(s) over ${n} training point(s).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { xs, ys, n, bandwidth, queryPoints, grid, predictions, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To guess the value of a curve at a new location, look at the training points and average the ones nearby. The kernel turns distance into a weight: close points count a lot, distant points count a little. Sliding the query across the range and repeating the weighted average traces out a smooth curve with no explicit fitting step.",
        invariants: [
            "The Gaussian weights are strictly positive, so each prediction is a convex combination of the responses.",
            "A constant response is reproduced exactly at every query point.",
            "A very small bandwidth makes the estimate approach the nearest observed response.",
        ],
        correctness:
            "The estimator is the ratio of the kernel-weighted sum of responses to the sum of the weights. Because Gaussian weights are positive, the ratio lies between the smallest and largest response. If every response equals c, the numerator is c times the weight sum and the ratio is exactly c. As the bandwidth tends to zero the nearest weight dominates all others, so the ratio tends to that point's response, which establishes interpolation in the small-bandwidth limit.",
        complexityRationale:
            "Each of the query points evaluates the kernel for every training point, costing O(queryPoints times n) time. Storing the grid, training arrays, and predictions uses O(queryPoints plus n) space.",
        uses: [
            "Smoothing noisy observations without assuming a parametric curve",
            "Nonparametric regression in exploratory data analysis",
            "Estimating conditional expectations for dashboard trends",
        ],
        references: [
            "Nadaraya, On Estimating Regression, 1964",
            "Watson, Smooth Regression Analysis, 1964",
            "Wasserman, All of Nonparametric Statistics, Chapter 5",
        ],
        workedExample:
            "Training points (0,0), (1,1), (2,4) with bandwidth 1 give at x = 0.5 weights exp(-0.125), exp(-0.125), and exp(-1.125), so the fit is about 0.79. If all three responses were 3, the same weights would produce exactly 3.",
    },
    id: "nadaraya-watson-estimator",
    name: "Nadaraya-Watson Estimator",
    category: "statistics-probability",
    complexity: { time: "O(queryPoints * n)", space: "O(queryPoints + n)" },
    defaultInput: { xs: [0, 1, 2, 3, 4], ys: [0, 1, 4, 9, 16], bandwidth: 1, queryPoints: 20 },
    visualType: "array",
    run,
    pseudocode: [
        "read training abscissas xs, responses ys, bandwidth, and query count",
        "build an evenly spaced query grid over the training range",
        "for each query x initialize weight sum and weighted value sum to zero",
        "for each training point add exp(-((x-xi)/h)^2 / 2) to the weight sum",
        "add that weight times yi to the weighted value sum",
        "set the fitted value to weighted values over weights",
        "done: report the fitted curve over the query grid",
    ],
};

export default module;
