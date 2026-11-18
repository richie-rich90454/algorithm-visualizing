/**
 * maximum-likelihood-estimation.ts - Maximum Likelihood Estimation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Maximum likelihood chooses the parameter value that makes the observed data
 * most probable. For independent samples from an exponential distribution with
 * rate lambda, the log likelihood is n times log lambda minus lambda times the
 * sum of the observations. Setting its derivative to zero gives the closed-form
 * estimate lambda hat equals one over the sample mean. The visualization plots
 * the log likelihood over a grid so the peak is visible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + g) for n observations and a grid of g rate values
 *   Space: O(g) for the displayed log-likelihood curve
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid rate shows the log likelihood at that rate.
 *   - The bar closest to the estimate is highlighted.
 *   - meta carries the data, the estimate, and the whole grid.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build the log-likelihood curve bars. */
function makeBars(grid: number[], curve: number[], peak: number, phase: string): VisualEntity[] {
    return grid.map((lambda, index) => {
        let state: EntityState = "idle";
        if (phase === "done" && index === peak) {
            state = "sorted";
        } else if (phase === "grid" && index === peak) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `l=${lambda.toFixed(2)}:${(curve[index] ?? 0).toFixed(2)}`,
            value: curve[index] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, lambda, logLikelihood: curve[index] ?? 0 },
        };
    });
}

/** The maximum likelihood generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { data?: number[]; min?: number; max?: number; steps?: number } | null) ?? {};
    const raw = Array.isArray(task.data) ? task.data.map((value) => Number(value)) : [];
    const data = raw.length > 0
        ? raw.filter((value) => Number.isFinite(value) && value > 0)
        : [0.5, 1.2, 0.3, 2, 0.8, 1.5];
    const n = Math.max(1, data.length);
    const min = Number.isFinite(Number(task.min)) && Number(task.min) > 0 ? Number(task.min) : 0.2;
    const max = Number.isFinite(Number(task.max)) && Number(task.max) > min ? Number(task.max) : 3;
    const steps = Math.min(60, Math.max(5, Math.floor(Number(task.steps ?? 25)) || 25));

    const sum = data.reduce((total, value) => total + value, 0);
    const mean = sum / n;
    const lambdaHat = 1 / mean;
    const logLikelihood = (lambda: number): number => n * Math.log(lambda) - lambda * sum;
    const logLikelihoodAtHat = logLikelihood(lambdaHat);
    const score = n / lambdaHat - sum;

    const grid: number[] = [];
    const curve: number[] = [];
    for (let i = 0; i < steps; i += 1) {
        const lambda = min + ((max - min) * i) / (steps - 1);
        grid.push(lambda);
        curve.push(logLikelihood(lambda));
    }
    let peak = 0;
    for (let i = 1; i < grid.length; i += 1) {
        if ((curve[i] ?? 0) > (curve[peak] ?? 0)) {
            peak = i;
        }
    }

    const meta = { n, data: [...data], sum, mean, lambdaHat, logLikelihoodAtHat, score, min, max, steps, grid: [...grid], curve: [...curve], peakLambda: grid[peak] ?? 0 };

    yield {
        stepNumber: 0,
        entities: makeBars(grid, curve, peak, "setup"),
        edges: [],
        description: `Estimating the exponential rate from ${n} positive observations by maximizing the log likelihood.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...meta, phase: "setup" },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(grid, curve, peak, "sum"),
        edges: [],
        description: `Sum the observations: ${sum.toFixed(4)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...meta, phase: "sum" },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(grid, curve, peak, "mean"),
        edges: [],
        description: `The sample mean is ${mean.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...meta, phase: "mean" },
    };

    yield {
        stepNumber: 3,
        entities: makeBars(grid, curve, peak, "hat"),
        edges: [],
        description: `Setting the derivative n/lambda minus the sum to zero gives lambda hat = 1 / mean = ${lambdaHat.toFixed(4)}; the score at the estimate is ${score.toExponential(2)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...meta, phase: "hat" },
    };

    yield {
        stepNumber: 4,
        entities: makeBars(grid, curve, peak, "grid"),
        edges: [],
        description: `Evaluating the log likelihood on ${steps} rates, the grid peak is near ${(grid[peak] ?? 0).toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...meta, phase: "grid" },
    };

    yield {
        stepNumber: 5,
        entities: makeBars(grid, curve, peak, "done"),
        edges: [],
        description: `Maximum likelihood estimate lambda hat = ${lambdaHat.toFixed(4)} with log likelihood ${logLikelihoodAtHat.toFixed(4)}; the closed-form peak matches the grid search.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...meta, phase: "done" },
    };
}

/** The maximum likelihood module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Pick the parameter that would have made the data you saw most likely. For exponential waiting times, short observations suggest a fast rate and long ones a slow rate. Writing down the log likelihood turns the product of densities into a sum, and a quick derivative gives the rate directly as one over the average observation.",
        invariants: [
            "The log likelihood is n log lambda minus lambda times the data sum.",
            "The score, its derivative, is zero at the maximum.",
            "The log likelihood is concave in lambda, so the stationary point is the global maximum.",
        ],
        correctness:
            "The likelihood of n independent exponential samples is the product of lambda times exp(-lambda times x_i), which is lambda to the n times exp(-lambda times the sum). Its log is n log lambda minus lambda times the sum. Differentiating gives n over lambda minus the sum; setting that to zero yields lambda hat equals n over the sum, which is one over the sample mean. The second derivative is negative n over lambda squared, so the function is strictly concave and this stationary point is the unique global maximizer.",
        complexityRationale:
            "Summing the data takes O(n) time and evaluating the grid takes O(g), so total time is O(n plus g). The grid and curve occupy O(g) space.",
        uses: [
            "Estimating failure rates in reliability studies",
            "Fitting waiting-time and interarrival models",
            "A canonical example for teaching statistical inference",
        ],
        references: [
            "Fisher, On the Mathematical Foundations of Theoretical Statistics, 1922",
            "Casella and Berger, Statistical Inference, Chapter 9",
        ],
        workedExample:
            "For observations 0.5, 1.2, 0.3, 2, 0.8, 1.5 the sum is 6.3 and the mean is 1.05, so the rate estimate is 1 over 1.05, about 0.952. A grid of rates peaks near that value and the derivative there is essentially zero.",
    },
    id: "maximum-likelihood-estimation",
    name: "Maximum Likelihood Estimation",
    category: "statistics-probability",
    complexity: { time: "O(n + g)", space: "O(g)" },
    defaultInput: { data: [0.5, 1.2, 0.3, 2, 0.8, 1.5], min: 0.2, max: 3, steps: 25 },
    visualType: "array",
    run,
    pseudocode: [
        "sum the observed positive data values",
        "compute the sample mean",
        "set the rate estimate to one over the mean",
        "evaluate the log likelihood on a grid of candidate rates",
        "locate the grid rate with the largest log likelihood",
        "done: report the closed-form estimate and its log likelihood",
    ],
};

export default module;
