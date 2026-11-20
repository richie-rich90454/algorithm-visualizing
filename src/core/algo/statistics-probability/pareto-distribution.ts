/**
 * pareto-distribution.ts - Pareto Type I Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Pareto distribution models heavy-tailed quantities where a small fraction
 * of observations accounts for most of the total, such as wealth or city sizes.
 * With scale xm and shape alpha its density is alpha times xm to the alpha over
 * x to the alpha plus one for x at least xm, and its cumulative distribution is
 * one minus (xm / x) to the alpha. The module evaluates both on a grid from xm
 * upward, inverts the CDF for quantiles, and reports moments when they exist.
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
 *   - The final frame reports the truncated area and the defined moments.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface ParetoInput {
    xm?: number;
    alpha?: number;
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
        metadata: { index, density: value },
    }));
}

function trapezoid(values: number[], h: number): number {
    return values.reduce((total, value, i) => total + (i === 0 || i === values.length - 1 ? value / 2 : value), 0) * h;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ParetoInput | null) ?? {};
    const xm = typeof task.xm === "number" && task.xm > 0 ? task.xm : 1;
    const alpha = typeof task.alpha === "number" && task.alpha > 0 ? task.alpha : 2;
    const maxX = typeof task.maxX === "number" && task.maxX > xm ? task.maxX : xm * 8;
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 12;
    const h = (maxX - xm) / steps;
    const xs = Array.from({ length: steps + 1 }, (_, i) => xm + i * h);
    const mean = alpha > 1 ? (alpha * xm) / (alpha - 1) : 0;
    const variance = alpha > 2 ? (xm * xm * alpha) / ((alpha - 1) * (alpha - 1) * (alpha - 2)) : 0;

    const pdf: number[] = [];
    const cdf: number[] = [];
    const quantiles: number[] = [];
    const pending = new Array<number>(steps + 1).fill(0);

    yield {
        stepNumber: 0,
        entities: makeBars(pending, -1, false),
        edges: [],
        description: `Evaluating the Pareto density and CDF on ${steps + 1} points from ${xm.toFixed(3)} to ${maxX.toFixed(3)} with shape ${alpha}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { xm, alpha, maxX, steps, xs, pdf: [], cdf: [], quantiles: [], mean, variance, meanDefined: alpha > 1, varianceDefined: alpha > 2, area: 0 },
    };
    let step = 1;

    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i] ?? xm;
        const survival = Math.exp(alpha * Math.log(xm / x));
        const density = (alpha / x) * survival;
        const cumulative = 1 - survival;
        const quantile = xm * Math.exp(-Math.log(Math.max(1e-300, survival)) / alpha);
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
            meta: { xm, alpha, maxX, steps, xs, pdf: [...pdf], cdf: [...cdf], quantiles: [...quantiles], mean, variance, meanDefined: alpha > 1, varianceDefined: alpha > 2, area: trapezoid(pdf, h) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(pdf, steps + 1, true),
        edges: [],
        description: `Pareto curve complete: truncated area ${trapezoid(pdf, h).toFixed(4)}, mean ${alpha > 1 ? mean.toFixed(4) : "undefined"}, variance ${alpha > 2 ? variance.toFixed(4) : "undefined"}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { xm, alpha, maxX, steps, xs, pdf, cdf, quantiles, mean, variance, meanDefined: alpha > 1, varianceDefined: alpha > 2, area: trapezoid(pdf, h) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Pareto distributions capture the idea that extreme values are not rare exceptions but part of the rule. Beyond a minimum scale xm, the chance of exceeding a value falls off as a power of how far above xm you go. A small shape alpha gives a very long tail, which is why a tiny share of observations can dominate the total. The tail is heavy enough that the mean or variance may not even exist.",
        invariants: [
            "The density and cumulative are zero at the scale xm.",
            "The cumulative curve is nondecreasing and approaches one.",
            "The quantile at a CDF value recovers the original x on the grid.",
        ],
        correctness:
            "A Pareto random variable is defined by the survival function P(X > x) = (xm / x)^alpha for x at least xm. Differentiating one minus that survival function gives the density alpha xm^alpha / x^(alpha+1). Solving the survival equation for x gives the quantile xm (1 - p)^(-1/alpha), which inverts the cumulative. Integrating x times the density gives a finite mean only when alpha exceeds one and a finite variance only when alpha exceeds two; otherwise the corresponding moment diverges, which the module reports through its defined flags.",
        complexityRationale:
            "Each of the steps plus one grid points needs a logarithm, an exponential, and a few multiplications, so the grid costs O(steps) time and O(steps) space for the parallel arrays.",
        uses: [
            "Modeling wealth, income, and firm-size distributions",
            "Describing file sizes and network traffic volumes",
            "Estimating loss severity in actuarial risk models",
        ],
        references: [
            "Pareto, Cours d'Economie Politique, 1896",
            "Arnold, Pareto Distributions, 2nd edition, 2015",
        ],
        workedExample:
            "With xm = 1 and alpha = 2, the cumulative at x = 2 is 1 - 1/4 = 0.75 and the density there is 2 / 2^3 = 0.25. The quantile for probability 0.75 is 1 times (0.25)^(-1/2) = 2. The mean exists and equals 2, while the variance is undefined because alpha is not above two.",
    },
    id: "pareto-distribution",
    name: "Pareto Distribution",
    category: "statistics-probability",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { xm: 1, alpha: 2, maxX: 8, steps: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "read scale xm, shape alpha, upper bound maxX, and step count",
        "for each grid point x from xm to maxX",
        "set survival to (xm / x) raised to alpha",
        "set density to alpha over x times survival",
        "set cumulative to one minus survival",
        "set quantile to xm times (1 - cumulative) raised to minus one over alpha",
        "report the truncated area and moments when they exist",
        "done: emit the density, cumulative, and quantile curves",
    ],
};

export default module;
