/**
 * generalized-method-of-moments.ts - Generalized Method of Moments
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The generalized method of moments estimates parameters by making sample
 * moments match their theoretical counterparts as closely as possible. For an
 * exponential rate the first two population moments are 1/rate and 2/rate
 * squared. A weighted sum of squared gaps between sample and population
 * moments defines an objective, which is minimized over a grid and then
 * refined by golden-section search.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(gridSize + refinementSteps) for the objective minimization
 *   Space: O(gridSize) for the displayed objective curve
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per candidate rate shows the GMM objective value.
 *   - The candidate currently being scored is highlighted.
 *   - The final frame reports the estimated rate and sample moments.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Weighted squared gap between sample moments and exponential moments. */
function objective(rate: number, mean: number, second: number, w1: number, w2: number): number {
    if (rate <= 0) return Infinity;
    const gap1 = mean - 1 / rate;
    const gap2 = second - 2 / (rate * rate);
    return w1 * gap1 * gap1 + w2 * gap2 * gap2;
}

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(6),
        value: Number.isFinite(value) ? value : 0,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, objective: Number.isFinite(value) ? value : 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { data?: number[]; w1?: number; w2?: number; gridSize?: number } | null) ?? {};
    const data = task.data ?? [0.4, 0.9, 0.2, 1.4, 0.6, 1.1, 0.3, 0.8];
    const w1 = typeof task.w1 === "number" && task.w1 >= 0 ? task.w1 : 1;
    const w2 = typeof task.w2 === "number" && task.w2 >= 0 ? task.w2 : 1;
    const gridSize = typeof task.gridSize === "number" ? Math.max(10, Math.min(400, Math.floor(task.gridSize))) : 80;
    const n = Math.max(1, data.length);
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const second = data.reduce((a, b) => a + b * b, 0) / n;
    const low = 1 / (10 * mean + 1e-9);
    const high = 20 / (mean + 1e-9);
    const lambdas = Array.from({ length: gridSize + 1 }, (_, i) => low + ((high - low) * i) / gridSize);

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(gridSize + 1).fill(0), -1, false),
        edges: [],
        description: `Scanning ${gridSize + 1} candidate rates to minimize the GMM objective.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { gridSize, w1, w2, mean, second, lambdas, objective: [], estimate: 0, complete: false },
    };
    let step = 1;
    const values: number[] = [];
    let bestIndex = 0;
    for (let i = 0; i < lambdas.length; i += 1) {
        const value = objective(lambdas[i] as number, mean, second, w1, w2);
        values.push(value);
        if (value < (values[bestIndex] as number)) bestIndex = i;
        yield {
            stepNumber: step,
            entities: makeBars([...values, ...new Array<number>(gridSize - i).fill(0)], i, false),
            edges: [],
            description: `Candidate rate ${(lambdas[i] as number).toFixed(4)}: objective ${Number.isFinite(value) ? value.toFixed(6) : "infinite"}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { gridSize, w1, w2, mean, second, lambdas, objective: [...values], estimate: lambdas[bestIndex] as number, complete: false },
        };
        step += 1;
    }

    const left = lambdas[Math.max(0, bestIndex - 1)] as number;
    const right = lambdas[Math.min(gridSize, bestIndex + 1)] as number;
    const phi = (Math.sqrt(5) - 1) / 2;
    let a = left;
    let b = right;
    let c = b - phi * (b - a);
    let d = a + phi * (b - a);
    for (let i = 0; i < 80; i += 1) {
        if (objective(c, mean, second, w1, w2) < objective(d, mean, second, w1, w2)) b = d;
        else a = c;
        c = b - phi * (b - a);
        d = a + phi * (b - a);
    }
    const estimate = (a + b) / 2;
    yield {
        stepNumber: step,
        entities: makeBars(values, gridSize + 1, true),
        edges: [],
        description: `GMM complete: estimated rate ${estimate.toFixed(6)} from sample mean ${mean.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { gridSize, w1, w2, mean, second, lambdas, objective: values, estimate, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A model makes predictions about moments such as the mean and the mean square. Generalized method of moments picks the parameter values that bring those predictions closest to what the data show. A weight matrix decides how much to trust each moment, and minimizing the weighted squared gaps gives an estimator even when the full likelihood is hard to write down.",
        invariants: [
            "The sample moments are fixed throughout the search.",
            "The objective is nonnegative and finite for every positive rate.",
            "The refined estimate has an objective no larger than the best grid point.",
        ],
        correctness:
            "For an exponential model the first population moment is 1/rate and the second is 2/rate squared. The weighted objective is a smooth function of the rate; scanning a grid locates the basin of the minimum and golden-section search converges to the minimizer within that bracket. With only the first moment weighted, setting the sample mean equal to 1/rate gives the closed-form rate 1 divided by the sample mean.",
        complexityRationale:
            "The grid evaluates the objective once per candidate, and golden-section search uses a constant number of iterations per refinement step, so the total is O(gridSize plus refinementSteps) time and O(gridSize) space for the displayed curve.",
        uses: [
            "Estimating parameters when only moment conditions are available",
            "Instrumental-variable estimation in econometrics",
            "Fitting models with fewer distributional assumptions than maximum likelihood",
        ],
        references: [
            "Hansen, Large Sample Properties of Generalized Method of Moments Estimators, Econometrica 50, 1982",
            "Wooldridge, Econometric Analysis of Cross Section and Panel Data, Chapter 14",
        ],
        workedExample:
            "For data with sample mean 0.6875, weighting only the first moment gives the rate 1 over 0.6875, about 1.4545. Adding the second moment with equal weight shifts the estimate toward the value that also matches the observed mean square, and the grid plus golden-section search finds that minimum automatically.",
    },
    id: "generalized-method-of-moments",
    name: "Generalized Method of Moments",
    category: "statistics-probability",
    complexity: { time: "O(gridSize + refinementSteps)", space: "O(gridSize)" },
    defaultInput: { data: [0.4, 0.9, 0.2, 1.4, 0.6, 1.1, 0.3, 0.8], w1: 1, w2: 1, gridSize: 80 },
    visualType: "array",
    run,
    pseudocode: [
        "read data and nonnegative moment weights w1 and w2",
        "compute the sample mean and sample second moment",
        "for each candidate rate in a grid evaluate the weighted squared gaps",
        "record the candidate with the smallest objective",
        "bracket that candidate with its two grid neighbors",
        "refine the minimum by golden-section search",
        "done: report the estimated rate and the sample moments",
    ],
};

export default module;
