/**
 * hyperexponential-distribution.ts - Hyperexponential Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A hyperexponential distribution is a probabilistic mixture of exponential
 * distributions with different rates. It is useful for modeling service times
 * that are a blend of fast and slow classes of customers. The module builds
 * its density and cumulative curves, inverts the cumulative function by
 * bisection for quantiles, and reports the exact mean and variance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points * components + components * bisectionSteps)
 *   Space: O(points + components) for the curves and component table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the mixture density.
 *   - The current grid point is highlighted while the curve is built.
 *   - The final frame reports the mean, variance, and median.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Mixture cumulative distribution at x. */
function cdfAt(x: number, weights: number[], rates: number[]): number {
    if (x <= 0) return 0;
    let total = 0;
    for (let i = 0; i < rates.length; i += 1) {
        total += (weights[i] as number) * (1 - Math.exp(-(rates[i] as number) * x));
    }
    return total;
}

/** Mixture density at x. */
function pdfAt(x: number, weights: number[], rates: number[]): number {
    if (x < 0) return 0;
    let total = 0;
    for (let i = 0; i < rates.length; i += 1) {
        total += (weights[i] as number) * (rates[i] as number) * Math.exp(-(rates[i] as number) * x);
    }
    return total;
}

/** Quantile by bisection on the monotone cumulative function. */
function quantileAt(u: number, weights: number[], rates: number[], hi: number): number {
    let lo = 0;
    let high = hi;
    for (let i = 0; i < 100; i += 1) {
        const mid = (lo + high) / 2;
        if (cdfAt(mid, weights, rates) < u) lo = mid;
        else high = mid;
    }
    return (lo + high) / 2;
}

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, density: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { weights?: number[]; rates?: number[]; points?: number } | null) ?? {};
    const rawWeights = task.weights ?? [0.7, 0.3];
    const rates = task.rates ?? [4, 0.5];
    const weightSum = rawWeights.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const weights = rawWeights.map((w) => Math.max(0, w) / weightSum);
    const points = typeof task.points === "number" ? Math.max(5, Math.min(400, Math.floor(task.points))) : 60;
    const slowest = Math.min(...rates, 0.1);
    const xMax = 8 / slowest;
    const xs = Array.from({ length: points + 1 }, (_, i) => (xMax * i) / points);

    let mean = 0;
    let secondMoment = 0;
    for (let i = 0; i < rates.length; i += 1) {
        mean += (weights[i] as number) / (rates[i] as number);
        secondMoment += ((2 * (weights[i] as number)) / Math.pow(rates[i] as number, 2));
    }
    const variance = Math.max(0, secondMoment - mean * mean);

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points + 1).fill(0), -1, false),
        edges: [],
        description: `Building a hyperexponential density from ${rates.length} exponential component(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { weights, rates, points, xs, pdf: [], cdf: [], mean, variance, quantiles: [], complete: false },
    };
    let step = 1;
    const pdf: number[] = [];
    const cdf: number[] = [];
    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i] as number;
        pdf.push(pdfAt(x, weights, rates));
        cdf.push(cdfAt(x, weights, rates));
        yield {
            stepNumber: step,
            entities: makeBars([...pdf, ...new Array<number>(points - i).fill(0)], i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${(pdf[i] as number).toFixed(5)}, cumulative ${(cdf[i] as number).toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { weights, rates, points, xs, pdf: [...pdf], cdf: [...cdf], mean, variance, quantiles: [], complete: false },
        };
        step += 1;
    }

    const quantiles = [0.1, 0.5, 0.9].map((u) => quantileAt(u, weights, rates, xMax));
    yield {
        stepNumber: step,
        entities: makeBars(pdf, points + 1, true),
        edges: [],
        description: `Curve complete: mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}, median ${(quantiles[1] as number).toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { weights, rates, points, xs, pdf, cdf, mean, variance, quantiles, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single exponential distribution has a fixed coefficient of variation, which is too restrictive for many service-time data sets. A hyperexponential mixes several exponentials, effectively drawing a class first and then a service time from that class. The result can have much higher variability than any single exponential component.",
        invariants: [
            "The component weights are nonnegative and sum to one.",
            "The cumulative value starts at zero and rises monotonically toward one.",
            "The mean is the weighted sum of the component means 1/rate.",
        ],
        correctness:
            "A mixture's cumulative distribution is the probability-weighted sum of component cumulative functions, giving sum of p_i (1 minus exp of minus rate_i times x). Differentiating term by term gives the density sum of p_i rate_i exp of minus rate_i times x. The mean is the weighted sum of 1/rate_i, and the second moment is the weighted sum of 2/rate_i squared, so the variance is second moment minus mean squared.",
        complexityRationale:
            "Each grid point sums over the components once, giving O(points * components) time for the curves. Each quantile runs a fixed 100-step bisection, costing O(components * bisectionSteps) additional work, with O(points + components) space.",
        uses: [
            "Modeling service times with distinct fast and slow customer classes",
            "Approximating heavy-tailed workloads in queueing analysis",
            "Representing phase-type arrivals in performance models",
        ],
        references: [
            "Trivedi, Probability and Statistics with Reliability, Queueing, and Computer Science Applications, Chapter 4",
            "Neuts, Matrix-Geometric Solutions in Stochastic Models, Chapter 2",
        ],
        workedExample:
            "With weights 0.7 and 0.3 and rates 4 and 0.5, the mean is 0.7/4 plus 0.3/0.5, or 0.955. The second moment is 2(0.7/16) plus 2(0.3/0.25), about 2.4875, so the variance is about 1.57. The density at zero is 0.7*4 plus 0.3*0.5, or 2.95.",
    },
    id: "hyperexponential-distribution",
    name: "Hyperexponential Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points * components)", space: "O(points + components)" },
    defaultInput: { weights: [0.7, 0.3], rates: [4, 0.5], points: 60 },
    visualType: "array",
    run,
    pseudocode: [
        "read component weights and exponential rates",
        "normalize the weights so they sum to one",
        "for each grid point x evaluate the mixture density sum p_i rate_i exp(-rate_i x)",
        "evaluate the cumulative sum p_i (1 - exp(-rate_i x)) at the same x",
        "set the mean to sum p_i / rate_i and the variance to sum 2p_i / rate_i^2 minus mean^2",
        "invert the cumulative by bisection for the 10th, 50th, and 90th percentiles",
        "done: report the density curve, cumulative curve, moments, and quantiles",
    ],
};

export default module;
