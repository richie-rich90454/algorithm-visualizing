/**
 * lognormal-distribution.ts - Lognormal PDF, CDF, and Moments
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A lognormal random variable is the exponential of a normal random variable.
 * If ln(X) has mean mu and standard deviation sigma, then X has a lognormal
 * law. This module evaluates the density, the cumulative probability, and the
 * first two moments in closed form, and tabulates the density on a grid for
 * display. The normal CDF is evaluated with the Abramowitz and Stegun 7.1.26
 * polynomial approximation to erf.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(samples) to tabulate the grid
 *   Space: O(samples) for the displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the lognormal density.
 *   - The queried value is highlighted while pdf, cdf, and moments are shown.
 *   - The final frame reports the analytic mean, median, and variance.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const INV_SQRT_2PI = 0.3989422804014327;

/** Abramowitz and Stegun 7.1.26: erf with maximum error near 1.5e-7. */
function erf(x: number): number {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const poly =
        ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
            0.254829592) *
        t;
    return sign * (1 - poly * Math.exp(-ax * ax));
}

/** Standard normal cumulative distribution function. */
function normalCdf(z: number): number {
    return 0.5 * (1 + erf(z / Math.SQRT2));
}

interface LognormalModel {
    pdf: (x: number) => number;
    cdf: (x: number) => number;
    mean: number;
    median: number;
    variance: number;
}

/** Closed-form lognormal density, CDF, and moments for parameters mu, sigma. */
export function lognormalModel(mu: number, sigma: number): LognormalModel {
    const s = Math.max(1e-6, sigma);
    const s2 = s * s;
    return {
        pdf: (x: number): number =>
            x <= 0
                ? 0
                : (INV_SQRT_2PI / (x * s)) * Math.exp(-((Math.log(x) - mu) ** 2) / (2 * s2)),
        cdf: (x: number): number => (x <= 0 ? 0 : normalCdf((Math.log(x) - mu) / s)),
        mean: Math.exp(mu + s2 / 2),
        median: Math.exp(mu),
        variance: (Math.exp(s2) - 1) * Math.exp(2 * mu + s2),
    };
}

/** Build the density bars with the queried value highlighted. */
function makeBars(
    grid: number[],
    density: number[],
    highlight: number,
    phase: string,
): VisualEntity[] {
    return grid.map((x, index) => {
        let state: EntityState = "idle";
        if (index === highlight) {
            state = phase === "done" ? "sorted" : "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `x=${x.toFixed(2)}:${(density[index] ?? 0).toFixed(4)}`,
            value: density[index] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, x, density: density[index] ?? 0 },
        };
    });
}

/** The lognormal distribution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { mu?: number; sigma?: number; x?: number; samples?: number } | null) ?? {};
    const mu = Number.isFinite(Number(task.mu)) ? Number(task.mu) : 0;
    const sigma = Number.isFinite(Number(task.sigma)) ? Math.max(1e-6, Number(task.sigma)) : 0.5;
    const samples = Math.min(101, Math.max(9, Math.floor(Number(task.samples ?? 41)) || 41));
    const model = lognormalModel(mu, sigma);
    const upper = Math.exp(mu + 3 * sigma) * 1.4;
    const grid: number[] = [];
    for (let i = 0; i < samples; i += 1) {
        grid.push((upper * (i + 0.5)) / samples);
    }
    const density = grid.map((x) => model.pdf(x));
    const query = Number.isFinite(Number(task.x)) ? Number(task.x) : Math.exp(mu);
    let highlight = 0;
    for (let i = 1; i < grid.length; i += 1) {
        if (Math.abs((grid[i] ?? 0) - query) < Math.abs((grid[highlight] ?? 0) - query)) {
            highlight = i;
        }
    }
    const pdfAtX = model.pdf(query);
    const cdfAtX = model.cdf(query);

    const base = {
        mu,
        sigma,
        x: query,
        samples,
        upper,
        pdf: pdfAtX,
        cdf: cdfAtX,
        mean: model.mean,
        median: model.median,
        variance: model.variance,
        grid: [...grid],
        density: [...density],
    };

    yield {
        stepNumber: 0,
        entities: makeBars(grid, density, highlight, "setup"),
        edges: [],
        description: `Tabulating the lognormal density with mu ${mu} and sigma ${sigma} over ${samples} points.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, phase: "setup" },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(grid, density, highlight, "pdf"),
        edges: [],
        description: `Density at x=${query.toFixed(3)} is exp(-(ln x - mu)^2 / (2 sigma^2)) / (x sigma sqrt(2 pi)) = ${pdfAtX.toFixed(6)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...base, phase: "pdf" },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(grid, density, highlight, "cdf"),
        edges: [],
        description: `Cumulative probability P(X <= ${query.toFixed(3)}) = Phi((ln x - mu) / sigma) = ${cdfAtX.toFixed(6)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...base, phase: "cdf" },
    };

    yield {
        stepNumber: 3,
        entities: makeBars(grid, density, highlight, "mean"),
        edges: [],
        description: `The mean is exp(mu + sigma^2 / 2) = ${model.mean.toFixed(6)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...base, phase: "mean" },
    };

    yield {
        stepNumber: 4,
        entities: makeBars(grid, density, highlight, "median"),
        edges: [],
        description: `The median is exp(mu) = ${model.median.toFixed(6)}; exactly half the mass lies below it.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...base, phase: "median" },
    };

    yield {
        stepNumber: 5,
        entities: makeBars(grid, density, highlight, "variance"),
        edges: [],
        description: `The variance is (exp(sigma^2) - 1) exp(2 mu + sigma^2) = ${model.variance.toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...base, phase: "variance" },
    };

    yield {
        stepNumber: 6,
        entities: makeBars(grid, density, highlight, "done"),
        edges: [],
        description: `Lognormal law summarized: density ${pdfAtX.toFixed(5)}, CDF ${cdfAtX.toFixed(5)}, mean ${model.mean.toFixed(5)}, variance ${model.variance.toFixed(5)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...base, phase: "done", done: true },
    };
}

/** The lognormal distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A lognormal variable is the exponential of a normal one, so its values are always positive and its distribution has a long right tail. Taking logarithms turns it back into a bell curve. The density divides the normal density of ln x by x, which accounts for the stretching that the exponential applies near zero.",
        invariants: [
            "The density is zero for x <= 0 and positive for every x > 0.",
            "The CDF equals the standard normal CDF evaluated at (ln x - mu) / sigma.",
            "The median exp(mu) has cumulative probability one half.",
            "The mean exp(mu + sigma^2 / 2) always exceeds the median for positive sigma.",
        ],
        correctness:
            "If Z is standard normal and X equals exp(mu + sigma Z), then for x > 0 the change of variables gives f(x) = phi((ln x - mu) / sigma) / (x sigma), which is the stated density, and P(X <= x) = Phi((ln x - mu) / sigma). The moments follow from the moment generating function of the normal law: E[X^k] = exp(k mu + k^2 sigma^2 / 2), giving the mean at k = 1 and the variance E[X^2] minus E[X]^2. The erf polynomial approximates Phi to within about 1.5 times ten to the minus seven.",
        complexityRationale:
            "Each grid point needs one logarithm, one exponential, and a fixed polynomial, so tabulating s points takes O(s) time and O(s) space for the displayed bars. Evaluating a single query is constant time.",
        uses: [
            "Modeling asset prices and multiplicative growth in finance",
            "Describing particle sizes, income, and latency distributions",
            "Prior distributions for positive scale parameters in Bayesian statistics",
        ],
        references: [
            "Abramowitz and Stegun, Handbook of Mathematical Functions, formula 7.1.26, 1964",
            "Johnson, Kotz, and Balakrishnan, Continuous Univariate Distributions, Volume 1",
        ],
        workedExample:
            "With mu = 0 and sigma = 0.5, the median is exp(0) = 1 and the CDF at 1 is Phi(0) = 0.5. The mean is exp(0.125) about 1.133, which is larger than the median. The density at 1 is exp(0) / (1 times 0.5 times sqrt(2 pi)) about 0.798.",
    },
    id: "lognormal-distribution",
    name: "Lognormal Distribution",
    category: "statistics-probability",
    complexity: { time: "O(samples)", space: "O(samples)" },
    defaultInput: { mu: 0, sigma: 0.5, x: 1, samples: 41 },
    visualType: "array",
    run,
    pseudocode: [
        "set sigma and build a positive grid from near zero to exp(mu + 3 sigma)",
        "at each grid point compute density exp(-(ln x - mu)^2 / (2 sigma^2)) / (x sigma sqrt(2 pi))",
        "compute the cumulative probability Phi((ln x - mu) / sigma)",
        "compute the mean exp(mu + sigma^2 / 2)",
        "compute the median exp(mu)",
        "compute the variance (exp(sigma^2) - 1) exp(2 mu + sigma^2)",
        "done: report density, CDF, and moments at the queried value",
    ],
};

export default module;
