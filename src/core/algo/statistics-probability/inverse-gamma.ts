/**
 * inverse-gamma.ts - Inverse Gamma Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A variable has the inverse gamma law when its reciprocal is gamma distributed.
 * With shape alpha and scale beta the density is beta^alpha / Gamma(alpha)
 * times x^(-alpha-1) exp(-beta/x) on the positive reals. The mean is beta/(alpha-1)
 * when alpha exceeds one and the variance is beta^2 / ((alpha-1)^2 (alpha-2))
 * when alpha exceeds two. The module evaluates a log-spaced grid, integrates
 * the density into a cumulative curve, and inverts that curve for quantiles.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points + samples)
 *   Space: O(points)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the density.
 *   - The bar being evaluated is yellow; the finished curve is green.
 *   - The final frame reports the analytic mean, variance, and mode.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const LANCZOS = [
    0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.1385710952657201, 9.984369578019572e-6,
    1.5056327351493116e-7,
];

function logGamma(z: number): number {
    if (z < 0.5) {
        return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    }
    const t = z - 1;
    let x = LANCZOS[0] as number;
    for (let i = 1; i < 9; i += 1) {
        x += (LANCZOS[i] as number) / (t + i);
    }
    const arg = t + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (t + 0.5) * Math.log(arg) - arg + Math.log(x);
}

function makeUniform(seed: number): () => number {
    let state = (seed >>> 0) || 1;
    return () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return (state + 0.5) / 4294967296;
    };
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
    const task = (input as { alpha?: number; beta?: number; points?: number; samples?: number; seed?: number } | null) ?? {};
    const alpha = typeof task.alpha === "number" && task.alpha > 0 ? task.alpha : 3;
    const beta = typeof task.beta === "number" && task.beta > 0 ? task.beta : 2;
    const points = typeof task.points === "number" ? Math.max(5, Math.min(500, Math.floor(task.points))) : 80;
    const samples = typeof task.samples === "number" ? Math.max(1, Math.min(20000, Math.floor(task.samples))) : 3000;
    const seed = typeof task.seed === "number" ? (task.seed >>> 0) : 424242;

    const lower = beta / 60;
    const upper = beta * 60;
    const logLower = Math.log(lower);
    const logUpper = Math.log(upper);
    const xs = Array.from({ length: points + 1 }, (_, i) => Math.exp(logLower + ((logUpper - logLower) * i) / points));

    const logConstant = alpha * Math.log(beta) - logGamma(alpha);
    const pdfAt = (x: number): number => Math.exp(logConstant + (-alpha - 1) * Math.log(x) - beta / x);
    const mean = alpha > 1 ? beta / (alpha - 1) : null;
    const variance = alpha > 2 ? (beta * beta) / ((alpha - 1) * (alpha - 1) * (alpha - 2)) : null;
    const mode = beta / (alpha + 1);

    const pdf: number[] = [];
    const cdf: number[] = [];
    let area = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points + 1).fill(0), -1, false),
        edges: [],
        description: `Evaluating the inverse gamma density with shape ${alpha} and scale ${beta}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { alpha, beta, points, samples, xs, pdf: [], cdf: [], quantiles: [], mean, variance, mode, sampleMean: 0, complete: false },
    };
    let step = 1;

    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i] as number;
        const density = pdfAt(x);
        if (i > 0) {
            area += ((pdf[i - 1] as number + density) / 2) * (x - (xs[i - 1] as number));
        }
        pdf.push(density);
        cdf.push(area);
        yield {
            stepNumber: step,
            entities: makeBars([...pdf, ...new Array<number>(points - i).fill(0)], i, false),
            edges: [],
            description: `At x = ${x.toFixed(4)}: density ${density.toFixed(5)}, cumulative ${area.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { alpha, beta, points, samples, xs, pdf: [...pdf], cdf: [...cdf], quantiles: [], mean, variance, mode, sampleMean: 0, complete: false },
        };
        step += 1;
    }

    const total = area || 1;
    const normalized = cdf.map((value) => value / total);
    const quantile = (p: number): number => {
        for (let i = 1; i < normalized.length; i += 1) {
            if ((normalized[i] as number) >= p) {
                const lo = normalized[i - 1] as number;
                const hi = normalized[i] as number;
                const f = hi > lo ? (p - lo) / (hi - lo) : 0;
                return (xs[i - 1] as number) + f * ((xs[i] as number) - (xs[i - 1] as number));
            }
        }
        return upper;
    };
    const quantiles = [0.1, 0.5, 0.9].map(quantile);

    const uniform = makeUniform(seed);
    let sum = 0;
    for (let i = 0; i < samples; i += 1) {
        const u = uniform();
        let value = upper;
        for (let j = 1; j < normalized.length; j += 1) {
            if ((normalized[j] as number) >= u) {
                const lo = normalized[j - 1] as number;
                const hi = normalized[j] as number;
                const f = hi > lo ? (u - lo) / (hi - lo) : 0;
                value = (xs[j - 1] as number) + f * ((xs[j] as number) - (xs[j - 1] as number));
                break;
            }
        }
        sum += value;
    }
    const sampleMean = sum / samples;

    yield {
        stepNumber: step,
        entities: makeBars(pdf, points + 1, true),
        edges: [],
        description: `Inverse gamma curve complete: mean ${mean === null ? "undefined" : mean.toFixed(4)}, median ${quantiles[1]?.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { alpha, beta, points, samples, xs, pdf, cdf: normalized, quantiles, mean, variance, mode, sampleMean, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The inverse gamma is the distribution of one over a gamma variable, so it concentrates near zero and has a long right tail. Raising the shape sharpens the peak near beta over alpha plus one, while raising the scale pushes probability outward. It is the standard conjugate prior for the variance of a normal distribution.",
        invariants: [
            "The density is nonnegative on the positive reals and integrates to one.",
            "The cumulative curve is nondecreasing and the reported quantiles invert it.",
            "The mode sits at beta over alpha plus one, left of the median for the right-skewed law.",
        ],
        correctness:
            "If Y has a gamma density with shape alpha and scale one over beta, then X equals one over Y has cumulative P(Y at most beta/x). Differentiating that cumulative gives beta^alpha x^(-alpha-1) exp(-beta/x) divided by Gamma(alpha), which is the reported density. Integrating x times this density gives beta over alpha minus one when alpha exceeds one, and the second moment gives the stated variance.",
        complexityRationale:
            "Each grid point evaluates one exponential and a few logarithms, so the curve costs O(points). Each inverse-transform draw scans the cumulative array in the worst case, giving O(samples times points) for the simulation, which is bounded by the configured limits.",
        uses: [
            "Conjugate prior for the variance of a normal model",
            "Modeling positive skewness with a heavy right tail",
            "Bayesian shrinkage and stochastic volatility priors",
        ],
        references: [
            "Gelman et al., Bayesian Data Analysis, Third Edition, Chapter 2",
            "Johnson, Kotz, and Balakrishnan, Continuous Univariate Distributions, Volume 1",
        ],
        workedExample:
            "With alpha = 4 and beta = 2 the mean is 2/3, the variance is 4 divided by 9 times 2, about 0.222, and the mode is 2/5 = 0.4. The density at x = 2 is 16 over 6 times 2^(-5) exp(-1), about 0.049.",
    },
    id: "inverse-gamma",
    name: "Inverse Gamma Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points + samples * points)", space: "O(points)" },
    defaultInput: { alpha: 3, beta: 2, points: 80, samples: 3000, seed: 424242 },
    visualType: "array",
    run,
    pseudocode: [
        "read shape alpha, scale beta, grid size, and sample count",
        "build a log-spaced grid from beta/60 to beta*60",
        "for each x set density to beta^alpha x^(-alpha-1) exp(-beta/x) / Gamma(alpha)",
        "accumulate the cumulative area with the trapezoid rule and normalize",
        "invert the cumulative curve at 0.1, 0.5, and 0.9 for quantiles",
        "draw samples by inverse transform and accumulate their mean",
        "done: report the density curve, quantiles, and analytic moments",
    ],
};

export default module;
