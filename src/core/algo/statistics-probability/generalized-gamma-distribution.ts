/**
 * generalized-gamma-distribution.ts - Generalized Gamma Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The generalized gamma family unifies several common positive distributions
 * with three parameters: shape a, shape d, and scale theta. Its density is
 * d / (theta^a Gamma(a/d)) times x^(a-1) exp(-(x/theta)^d). Setting d to one
 * gives the ordinary gamma, setting a equal to d gives the Weibull, and both
 * together give the exponential or Rayleigh laws. The r-th moment is
 * theta^r Gamma((a+r)/d) / Gamma(a/d), which yields the mean and variance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points) to build the density and cumulative curves
 *   Space: O(points) for the parallel grid arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the density.
 *   - The bar being evaluated is yellow; the finished curve is green.
 *   - The final frame reports the two shapes, scale, mean, and variance.
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
    const task = (input as { a?: number; d?: number; scale?: number; points?: number; xMax?: number } | null) ?? {};
    const a = typeof task.a === "number" && task.a > 0 ? task.a : 2;
    const d = typeof task.d === "number" && task.d > 0 ? task.d : 1;
    const scale = typeof task.scale === "number" && task.scale > 0 ? task.scale : 1;
    const points = typeof task.points === "number" ? Math.max(5, Math.min(400, Math.floor(task.points))) : 80;
    const xMax = typeof task.xMax === "number" && task.xMax > 0 ? task.xMax : scale * 8;
    const xs = Array.from({ length: points + 1 }, (_, i) => (xMax * i) / points);

    const logConstant = Math.log(d) - a * Math.log(scale) - logGamma(a / d);
    const pdfAt = (x: number): number => {
        if (x <= 0) return 0;
        return Math.exp(logConstant + (a - 1) * Math.log(x) - Math.pow(x / scale, d));
    };
    const moment = (r: number): number => Math.pow(scale, r) * Math.exp(logGamma((a + r) / d) - logGamma(a / d));
    const mean = moment(1);
    const variance = moment(2) - mean * mean;

    const pdf: number[] = [];
    const cdf: number[] = [];
    let area = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points + 1).fill(0), -1, false),
        edges: [],
        description: `Evaluating the generalized gamma density with shapes ${a}, ${d}, and scale ${scale}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { a, d, scale, points, xs, pdf: [], cdf: [], quantiles: [], mean, variance, family: d === 1 ? "gamma" : a === d ? "weibull" : "generalized", complete: false },
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
            description: `At x = ${x.toFixed(3)}: density ${density.toFixed(5)}, cumulative ${area.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { a, d, scale, points, xs, pdf: [...pdf], cdf: [...cdf], quantiles: [], mean, variance, family: d === 1 ? "gamma" : a === d ? "weibull" : "generalized", complete: false },
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
        return xMax;
    };
    const quantiles = [0.1, 0.5, 0.9].map(quantile);

    yield {
        stepNumber: step,
        entities: makeBars(pdf, points + 1, true),
        edges: [],
        description: `Generalized gamma curve complete: mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}, median ${quantiles[1]?.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { a, d, scale, points, xs, pdf, cdf: normalized, quantiles, mean, variance, family: d === 1 ? "gamma" : a === d ? "weibull" : "generalized", complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The generalized gamma is a single formula that contains many familiar positive distributions. One shape controls the power of x near zero, a second shape controls how quickly the exponential tail decays, and the scale stretches the horizontal axis. Choosing the shapes recovers the gamma, Weibull, exponential, chi, and Rayleigh families.",
        invariants: [
            "Setting d to one gives the ordinary gamma law.",
            "Setting a equal to d gives the Weibull law.",
            "The reported moments come from the gamma ratio Gamma((a+r)/d)/Gamma(a/d).",
        ],
        correctness:
            "Substituting y = (x/theta)^d into the integral of the density converts it to the gamma integral, which equals one, so the expression is a valid density. The same substitution gives the r-th raw moment theta^r Gamma((a+r)/d)/Gamma(a/d). With d one this is the gamma moment theta^r Gamma(a+r)/Gamma(a), and with a equal to d it is the Weibull moment theta^r Gamma(1+r/d). The variance is the second raw moment minus the squared mean.",
        complexityRationale:
            "The log-gamma constant is computed once, and each grid point needs one power, one exponential, and a trapezoid update, so building the curve costs O(points) time and O(points) space.",
        uses: [
            "A flexible model for positive skewed data in reliability",
            "Survival analysis with gamma and Weibull as nested cases",
            "Modeling wind speeds and precipitation amounts",
        ],
        references: [
            "Johnson, Kotz, and Balakrishnan, Continuous Univariate Distributions, Volume 2, Chapter 17",
            "Khodadadian and Johnson, A Family of Generalized Gamma Distributions, 1992",
        ],
        workedExample:
            "With a = 2, d = 1, and scale 1 the density is x exp(-x), an ordinary gamma with mean 2 and variance 2. With a = 2 and d = 2 it becomes the Rayleigh density 2x exp(-x^2) with mean Gamma(1.5), about 0.886, and variance 1 minus that mean squared.",
    },
    id: "generalized-gamma-distribution",
    name: "Generalized Gamma Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points)", space: "O(points)" },
    defaultInput: { a: 2, d: 1, scale: 1, points: 80, xMax: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "read shapes a and d, scale theta, and grid size",
        "compute the normalizing constant using log Gamma(a/d)",
        "for each x set density to d x^(a-1) exp(-(x/theta)^d) / (theta^a Gamma(a/d))",
        "accumulate the cumulative area with the trapezoid rule and normalize",
        "invert the cumulative curve at 0.1, 0.5, and 0.9 for quantiles",
        "compute raw moments from the Gamma ratio for the mean and variance",
        "done: report the density curve, quantiles, and moments",
    ],
};

export default module;
