/**
 * tukey-lambda-distribution.ts - Tukey Lambda Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Tukey lambda family is defined by its quantile function rather than its
 * density. For shape lambda the standard quantile is (p^lambda - (1-p)^lambda)
 * / lambda, with the natural-log odds limit when lambda is zero. A location
 * and scale then slide and stretch the curve. Because the quantile is explicit,
 * the density follows from its derivative as one over p^(lambda-1) plus
 * (1-p)^(lambda-1). Special cases include the logistic (lambda zero), a
 * uniform law (lambda one), and a bounded symmetric law (negative lambda).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points) to build the quantile and density grid
 *   Space: O(points) for the parallel arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per probability point shows the density at that quantile.
 *   - The bar being evaluated is yellow; the finished curve is green.
 *   - The final frame reports the median and interquartile range.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

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
    const task = (input as { lambda?: number; location?: number; scale?: number; points?: number; pMin?: number } | null) ?? {};
    const lambda = typeof task.lambda === "number" ? task.lambda : 0.5;
    const location = typeof task.location === "number" ? task.location : 0;
    const scale = typeof task.scale === "number" && task.scale > 0 ? task.scale : 1;
    const points = typeof task.points === "number" ? Math.max(5, Math.min(400, Math.floor(task.points))) : 60;
    const pMin = typeof task.pMin === "number" && task.pMin > 0 && task.pMin < 0.5 ? task.pMin : 0.005;
    const pMax = 1 - pMin;

    const quantileAt = (p: number): number => {
        if (Math.abs(lambda) < 1e-12) {
            return location + scale * Math.log(p / (1 - p));
        }
        return location + (scale * (Math.pow(p, lambda) - Math.pow(1 - p, lambda))) / lambda;
    };
    const densityAt = (p: number): number => {
        if (Math.abs(lambda) < 1e-12) {
            return (p * (1 - p)) / scale;
        }
        const derivative = Math.pow(p, lambda - 1) + Math.pow(1 - p, lambda - 1);
        return 1 / (scale * derivative);
    };

    const ps = Array.from({ length: points + 1 }, (_, i) => pMin + ((pMax - pMin) * i) / points);
    const quantiles: number[] = [];
    const density: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points + 1).fill(0), -1, false),
        edges: [],
        description: `Building the Tukey lambda quantile curve with shape ${lambda}, location ${location}, and scale ${scale}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lambda, location, scale, points, pMin, ps, quantiles: [], density: [], median: location, iqr: 0, meanNumeric: 0, complete: false },
    };
    let step = 1;

    for (let i = 0; i < ps.length; i += 1) {
        const p = ps[i] as number;
        quantiles.push(quantileAt(p));
        density.push(densityAt(p));
        yield {
            stepNumber: step,
            entities: makeBars([...density, ...new Array<number>(points - i).fill(0)], i, false),
            edges: [],
            description: `At p = ${p.toFixed(4)}: quantile ${quantiles[i]?.toFixed(4)}, density ${density[i]?.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { lambda, location, scale, points, pMin, ps, quantiles: [...quantiles], density: [...density], median: location, iqr: 0, meanNumeric: 0, complete: false },
        };
        step += 1;
    }

    const median = quantileAt(0.5);
    const iqr = quantileAt(0.75) - quantileAt(0.25);
    let moment = 0;
    for (let i = 1; i < ps.length; i += 1) {
        const dp = (ps[i] as number) - (ps[i - 1] as number);
        moment += (((quantiles[i - 1] as number) + (quantiles[i] as number)) / 2) * dp;
    }

    yield {
        stepNumber: step,
        entities: makeBars(density, points + 1, true),
        edges: [],
        description: `Tukey lambda curve complete: median ${median.toFixed(4)}, interquartile range ${iqr.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { lambda, location, scale, points, pMin, ps, quantiles, density, median, iqr, meanNumeric: moment, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Most distributions start with a density and then integrate to get quantiles. The Tukey lambda family goes the other way: it writes down the quantile function directly and differentiates it to get the density. One shape parameter then interpolates between familiar curves, from a bounded symmetric hump through the logistic to a uniform law and beyond.",
        invariants: [
            "The quantile is zero at p = 0.5 when the location is zero.",
            "The quantile satisfies Q(1-p) = -Q(p) about the location, so the curve is symmetric.",
            "The density at a quantile equals one over the derivative of the quantile function.",
        ],
        correctness:
            "For lambda not zero the derivative of (p^lambda - (1-p)^lambda)/lambda is p^(lambda-1) plus (1-p)^(lambda-1), which is always positive, so the quantile is strictly increasing and its reciprocal is a valid density that integrates to one over p in (0,1). At lambda zero the quantile is log of p over one minus p with derivative 1 over p(1-p), giving density p(1-p), the logistic law. At lambda one the quantile is 2p minus one, a uniform distribution.",
        complexityRationale:
            "Building the curve evaluates a power and an exponential-style expression per probability point, so the work is O(points) in both time and space for the quantile and density arrays.",
        uses: [
            "A compact family for fitting symmetric data with tunable tails",
            "Generating random variates directly from the quantile function",
            "A teaching bridge between the logistic, uniform, and Cauchy families",
        ],
        references: [
            "Tukey, The Practical Relationship Between the Common Transformations of Counts of Things, 1960",
            "Joiner and Rosenblatt, Some Properties of the Range in Samples from Tukey's Symmetric Lambda Distributions, 1971",
        ],
        workedExample:
            "With lambda = 1, location = 0, and scale = 1 the quantile is 2p minus one, so the quartiles are minus one half and one half and the interquartile range is one. With lambda = 0 the median is still zero but the upper quartile is log three, about 1.099, giving heavier tails.",
    },
    id: "tukey-lambda-distribution",
    name: "Tukey Lambda Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points)", space: "O(points)" },
    defaultInput: { lambda: 0.5, location: 0, scale: 1, points: 60, pMin: 0.005 },
    visualType: "array",
    run,
    pseudocode: [
        "read shape lambda, location, scale, and probability grid size",
        "build a probability grid from pMin to one minus pMin",
        "for each p set quantile to (p^lambda - (1-p)^lambda)/lambda, or log odds at zero",
        "set density to one over p^(lambda-1) plus (1-p)^(lambda-1), scaled",
        "set the median to the quantile at one half",
        "set the interquartile range to the upper minus lower quartile",
        "done: report the quantile curve, density, median, and spread",
    ],
};

export default module;
