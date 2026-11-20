/**
 * rayleigh-distribution.ts - Rayleigh Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Rayleigh distribution describes the length of a two-dimensional vector
 * whose components are independent normal variables with equal variance. With
 * scale sigma its density is (x / sigma^2) exp(-x^2 / (2 sigma^2)) for x at
 * least zero and its cumulative distribution is 1 - exp(-x^2 / (2 sigma^2)).
 * The module evaluates both on a uniform grid, inverts the CDF for the
 * quantile values, and reports the mean and variance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps) to evaluate the grid
 *   Space: O(steps) for the x, density, cumulative, and quantile arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the density f(x).
 *   - The bar being evaluated is yellow; the finished curve is green.
 *   - The final frame reports the area, mean, and variance.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface RayleighInput {
    sigma?: number;
    maxX?: number;
    steps?: number;
}

function makeBars(density: number[], current: number, done: boolean): VisualEntity[] {
    return density.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, x: index, density: value },
    }));
}

function trapezoid(values: number[], h: number): number {
    return values.reduce((total, value, i) => total + (i === 0 || i === values.length - 1 ? value / 2 : value), 0) * h;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RayleighInput | null) ?? {};
    const sigma = typeof task.sigma === "number" && task.sigma > 0 ? task.sigma : 1;
    const maxX = typeof task.maxX === "number" && task.maxX > 0 ? task.maxX : 5 * sigma;
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 12;
    const h = maxX / steps;
    const xs = Array.from({ length: steps + 1 }, (_, i) => i * h);
    const mean = sigma * Math.sqrt(Math.PI / 2);
    const variance = (2 - Math.PI / 2) * sigma * sigma;

    const pdf: number[] = [];
    const cdf: number[] = [];
    const quantiles: number[] = [];
    const pending = new Array<number>(steps + 1).fill(0);

    yield {
        stepNumber: 0,
        entities: makeBars(pending, -1, false),
        edges: [],
        description: `Evaluating the Rayleigh density and CDF on ${steps + 1} points from 0 to ${maxX.toFixed(3)} with scale ${sigma}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { sigma, maxX, steps, xs, pdf: [], cdf: [], quantiles: [], mean, variance, area: 0 },
    };
    let step = 1;

    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i] ?? 0;
        const exponent = Math.exp(-(x * x) / (2 * sigma * sigma));
        const density = (x / (sigma * sigma)) * exponent;
        const cumulative = 1 - exponent;
        const quantile = sigma * Math.sqrt(Math.max(0, -2 * Math.log(Math.max(1e-300, exponent))));
        pdf.push(density);
        cdf.push(cumulative);
        quantiles.push(quantile);
        const shown = [...pdf, ...new Array<number>(steps - i).fill(0)];
        yield {
            stepNumber: step,
            entities: makeBars(shown, i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${density.toFixed(5)}, cumulative ${cumulative.toFixed(5)}, quantile ${quantile.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { sigma, maxX, steps, xs, pdf: [...pdf], cdf: [...cdf], quantiles: [...quantiles], mean, variance, area: trapezoid(pdf, h) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(pdf, steps + 1, true),
        edges: [],
        description: `Rayleigh curve complete: truncated area ${trapezoid(pdf, h).toFixed(4)}, mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { sigma, maxX, steps, xs, pdf, cdf, quantiles, mean, variance, area: trapezoid(pdf, h) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If you scatter points around a center with independent, equally spread horizontal and vertical errors, the distance of each point from the center follows a Rayleigh curve. The density is zero at zero, rises to a peak near sigma, and then tails off. Its cumulative curve gives the chance that a random distance is at most some value, and inverting that curve turns a probability back into a distance.",
        invariants: [
            "The density is nonnegative and starts at zero.",
            "The cumulative curve is nondecreasing and tends to one.",
            "The quantile at a CDF value recovers the original x up to grid resolution.",
        ],
        correctness:
            "Let two independent normal variables have variance sigma squared. The joint density is radial, so integrating it over a disk gives the probability that the radius is at most x as 1 - exp(-x^2 / (2 sigma^2)). Differentiating that cumulative function gives the density (x / sigma^2) exp(-x^2 / (2 sigma^2)). The mean sigma times the square root of pi over two and the variance (2 - pi/2) sigma squared follow from integrating powers of x against the density. Solving the cumulative equation for x gives the quantile sigma times the square root of minus twice the log of one minus the probability.",
        complexityRationale:
            "Each of the steps plus one grid points needs a fixed number of exponential and logarithm operations, so the curve costs O(steps) time and O(steps) space for the parallel arrays.",
        uses: [
            "Modeling radial error in navigation and GPS positioning",
            "Describing wind speed magnitudes and wave heights",
            "The amplitude of a signal with Gaussian quadrature components",
        ],
        references: [
            "Papoulis and Pillai, Probability, Random Variables and Stochastic Processes, Chapter 4",
            "Ross, Introduction to Probability Models, Chapter 3",
        ],
        workedExample:
            "With sigma = 1 the density at x = 1 is exp(-0.5), about 0.6065, and the cumulative probability is 1 - exp(-0.5), about 0.3935. The median distance is the square root of twice the log of two, about 1.177, and the mean is the square root of pi over two, about 1.253.",
    },
    id: "rayleigh-distribution",
    name: "Rayleigh Distribution",
    category: "statistics-probability",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { sigma: 1, maxX: 6, steps: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "read scale sigma, upper bound maxX, and step count",
        "for each grid point x from zero to maxX",
        "compute the exponential factor exp of minus x squared over twice sigma squared",
        "set density to x over sigma squared times that factor",
        "set cumulative to one minus that factor",
        "set quantile to sigma times the square root of minus twice log of one minus cumulative",
        "accumulate trapezoid area and report mean and variance",
        "done: emit the density, cumulative, and quantile curves",
    ],
};

export default module;
