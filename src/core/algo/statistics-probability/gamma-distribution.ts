/**
 * gamma-distribution.ts - Gamma Distribution Density and Cumulative Probability
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The gamma distribution with shape k and scale theta has density
 * f(x) = x^(k-1) exp(-x/theta) / (Gamma(k) theta^k) for x >= 0. Its mean is k
 * times theta and its variance is k times theta squared. This module evaluates
 * the density in log space using a Lanczos log-gamma, and computes the
 * cumulative distribution with the regularized incomplete gamma function via a
 * power series or a continued fraction, whichever converges faster.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(I) per CDF evaluation for I series or continued-fraction terms
 *   Space: O(1) beyond the sampled density bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the density on a grid from zero to a chosen maximum.
 *   - The bin nearest the mean is highlighted; final bars are green.
 *   - Metadata reports mean, variance, and CDF values at sample points.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GammaInput {
    shape?: number;
    scale?: number;
    samples?: number;
    xMax?: number;
}

const LANCZOS = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953,
];

/** Log of the gamma function via the Lanczos approximation. */
function logGamma(z: number): number {
    let x = z;
    let y = z;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (const coefficient of LANCZOS) {
        y += 1;
        ser += coefficient / y;
    }
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Regularized lower incomplete gamma by power series (good for x < a+1). */
function gammaSeries(a: number, x: number): number {
    if (x <= 0) return 0;
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n <= 1000; n += 1) {
        term *= x / (a + n);
        sum += term;
        if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Regularized upper incomplete gamma by continued fraction (good for x >= a+1). */
function gammaContinuedFraction(a: number, x: number): number {
    const tiny = 1e-300;
    let b = x + 1 - a;
    let c = 1 / tiny;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i <= 1000; i += 1) {
        const an = -i * (i - a);
        b += 2;
        d = an * d + b;
        if (Math.abs(d) < tiny) d = tiny;
        c = b + an / c;
        if (Math.abs(c) < tiny) c = tiny;
        d = 1 / d;
        const delta = d * c;
        h *= delta;
        if (Math.abs(delta - 1) < 1e-14) break;
    }
    return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Cumulative distribution function P(a, x). */
function gammaCdf(a: number, x: number): number {
    if (x <= 0) return 0;
    return x < a + 1 ? gammaSeries(a, x) : 1 - gammaContinuedFraction(a, x);
}

/** Density f(x), evaluated in log space for stability. */
function gammaPdf(x: number, k: number, theta: number): number {
    if (x < 0) return 0;
    if (x === 0) {
        if (k === 1) return 1 / theta;
        if (k > 1) return 0;
        return Number.POSITIVE_INFINITY;
    }
    return Math.exp((k - 1) * Math.log(x) - x / theta - logGamma(k) - k * Math.log(theta));
}

function makeBars(values: number[], meanIndex: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (index === meanIndex) state = done ? "sorted" : "highlight";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toExponential(3),
            value,
            state,
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, density: value },
        };
    });
}

/** The gamma-distribution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GammaInput | null) ?? {};
    const k = Math.max(0.1, Math.min(50, Number(task.shape ?? 2)));
    const theta = Math.max(0.01, Math.min(50, Number(task.scale ?? 1)));
    const samples = Math.min(4000, Math.max(8, Math.floor(Number(task.samples ?? 40)) || 40));
    const xMax = Math.max(0.5, Number(task.xMax ?? k * theta * 4 + 6 * Math.sqrt(k) * theta));
    const mean = k * theta;
    const variance = k * theta * theta;
    const stepSize = xMax / samples;
    const xs = Array.from({ length: samples }, (_, i) => i * stepSize);
    const densities = xs.map((x) => gammaPdf(x, k, theta));
    const meanIndex = Math.min(samples - 1, Math.max(0, Math.round(mean / stepSize)));
    const cdfSamples = [mean, mean / 2, mean * 2].map((x) => Number(gammaCdf(k, x / theta).toFixed(9)));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(densities.map(() => 0), -1, false),
        edges: [],
        description: `Gamma distribution with shape ${k.toFixed(3)} and scale ${theta.toFixed(3)}; about to sample ${samples} points on [0, ${xMax.toFixed(2)}].`,
        codeLineNumber: 0,
        layout: "array",
        meta: { shape: k, scale: theta, mean, variance, xMax, samples, cdfAtMean: 0 },
    };
    step += 1;

    // Reveal the density one bin at a time so the shape builds on screen.
    const revealed = new Array<number>(samples).fill(0);
    for (let i = 0; i < samples; i += 1) {
        revealed[i] = densities[i]!;
        if (i % Math.max(1, Math.floor(samples / 8)) !== 0 && i !== samples - 1) continue;
        yield {
            stepNumber: step,
            entities: makeBars(revealed, i, false),
            edges: [],
            description: `Evaluating density at x = ${xs[i]!.toFixed(3)}: f(x) = ${densities[i]!.toExponential(3)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { shape: k, scale: theta, mean, variance, xMax, samples, evaluatedThrough: i },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(densities, meanIndex, false),
        edges: [],
        description: `Mean is k*theta = ${mean.toFixed(4)}, variance k*theta^2 = ${variance.toFixed(4)}; the highlight marks the bin nearest the mean.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { shape: k, scale: theta, mean, variance, xMax, samples, cdfAtMean: cdfSamples[0] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(densities, meanIndex, true),
        edges: [],
        description: `CDF samples: P(X <= mean/2) = ${cdfSamples[1]}, P(X <= mean) = ${cdfSamples[0]}, P(X <= 2*mean) = ${cdfSamples[2]}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            shape: k,
            scale: theta,
            mean,
            variance,
            xMax,
            samples,
            densities,
            cdfSamples,
            cdfAtMean: cdfSamples[0],
            done: true,
        },
    };
}

/** The gamma-distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The gamma distribution is a flexible model for positive quantities such as waiting times. The shape controls how the density rises near zero, and the scale stretches it along the x-axis. Its cumulative probability has no simple closed form, so it is computed with a power series when x is small and a continued fraction when x is large.",
        invariants: [
            "The density is nonnegative and integrates to one over the positive reals.",
            "The mean is k times theta and the variance is k times theta squared.",
            "The cumulative probability is monotone, approaching zero at x = 0 and one as x grows.",
        ],
        correctness:
            "Writing the density in log space and exponentiating avoids overflow. The lower incomplete gamma series sums the Taylor expansion of the integrand, while the continued fraction evaluates the complementary upper tail; choosing the faster-converging representation by comparing x with a + 1 gives an accurate regularized incomplete gamma. The moments follow directly from the definition by integrating x times and x squared times the density.",
        complexityRationale:
            "Each CDF evaluation sums up to I terms of a series or continued fraction, so it costs O(I) time with I chosen by a tight tolerance. Only a fixed number of scalars and the density bars are stored, O(1) beyond the display grid.",
        uses: [
            "Modeling waiting times and lifetimes in reliability analysis",
            "The conjugate prior for the rate of a Poisson process",
            "Bayesian inference and rainfall or insurance loss modeling",
        ],
        references: [
            "Johnson, Kotz, and Balakrishnan, Continuous Univariate Distributions, Volume 1",
            "Press et al., Numerical Recipes, Section on Incomplete Gamma Functions",
        ],
        workedExample:
            "With shape 2 and scale 1 the density is x times exp(-x), the Erlang-2 distribution. Its mean is 2, its variance is 2, and the probability of observing a value at most 2 is about 0.594, computed from the incomplete gamma series.",
    },
    id: "gamma-distribution",
    name: "Gamma Distribution",
    category: "statistics-probability",
    complexity: { time: "O(I) per CDF", space: "O(1)" },
    defaultInput: { shape: 2, scale: 1, samples: 40 },
    visualType: "array",
    run,
    pseudocode: [
        "read the shape k and scale theta",
        "compute the log-gamma normalizing constant",
        "evaluate the density in log space on a grid",
        "choose series or continued fraction for the CDF by x versus k+1",
        "accumulate terms until they fall below tolerance",
        "report the mean, variance, and CDF samples",
        "done: show the density curve",
    ],
};

export default module;
