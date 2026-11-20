/**
 * chi-distribution.ts - Chi Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The chi distribution with k degrees of freedom is the length of a k-vector
 * of independent standard normal variables. Its density on the nonnegative
 * reals is x^(k-1) exp(-x^2/2) divided by 2^(k/2-1) Gamma(k/2). The module
 * evaluates the density and a numerically integrated cumulative curve on a
 * grid, reports the median and deciles, and compares the sampled moments with
 * the closed-form mean and variance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points) for the curve and O(samples) for the moment simulation
 *   Space: O(points)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the density.
 *   - The bar being evaluated is yellow; the finished curve is green.
 *   - The final frame reports theoretical versus simulated mean and variance.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const LANCZOS = [
    0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.1385710952657201, 9.984369578019572e-6,
    1.5056327351493116e-7,
];

/** Log of the gamma function via the Lanczos approximation. */
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

/** Deterministic uniform draw in (0, 1). */
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
    const task = (input as { k?: number; points?: number; samples?: number; seed?: number } | null) ?? {};
    const k = typeof task.k === "number" && task.k > 0 ? task.k : 3;
    const points = typeof task.points === "number" ? Math.max(5, Math.min(400, Math.floor(task.points))) : 60;
    const samples = typeof task.samples === "number" ? Math.max(1, Math.min(20000, Math.floor(task.samples))) : 4000;
    const seed = typeof task.seed === "number" ? (task.seed >>> 0) : 12345;
    const xMax = Math.max(2, k + 6 * Math.sqrt(k) + 6);
    const xs = Array.from({ length: points + 1 }, (_, i) => (xMax * i) / points);

    const norm = (k / 2 - 1) * Math.log(2) + logGamma(k / 2);
    const pdfAt = (x: number): number => {
        if (x <= 0) return 0;
        return Math.exp((k - 1) * Math.log(x) - (x * x) / 2 - norm);
    };
    const theoryMean = Math.SQRT2 * Math.exp(logGamma((k + 1) / 2) - logGamma(k / 2));
    const theoryVariance = k - theoryMean * theoryMean;

    const pdf: number[] = [];
    const cdf: number[] = [];
    let area = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points + 1).fill(0), -1, false),
        edges: [],
        description: `Evaluating the chi density with ${k} degree(s) of freedom over ${points} intervals.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { k, points, samples, xs, pdf: [], cdf: [], quantiles: [], theoryMean, theoryVariance, sampleMean: 0, sampleVariance: 0, complete: false },
    };
    let step = 1;

    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i] as number;
        const density = pdfAt(x);
        if (i > 0) {
            const prev = pdf[i - 1] as number;
            area += ((prev + density) / 2) * (x - (xs[i - 1] as number));
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
            meta: { k, points, samples, xs, pdf: [...pdf], cdf: [...cdf], quantiles: [], theoryMean, theoryVariance, sampleMean: 0, sampleVariance: 0, complete: false },
        };
        step += 1;
    }

    const quantile = (p: number): number => {
        for (let i = 1; i < cdf.length; i += 1) {
            if ((cdf[i] as number) >= p) {
                const lo = cdf[i - 1] as number;
                const hi = cdf[i] as number;
                const f = hi > lo ? (p - lo) / (hi - lo) : 0;
                return (xs[i - 1] as number) + f * ((xs[i] as number) - (xs[i - 1] as number));
            }
        }
        return xMax;
    };
    const quantiles = [0.1, 0.5, 0.9].map(quantile);

    const uniform = makeUniform(seed);
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < samples; i += 1) {
        let norm2 = 0;
        for (let j = 0; j < k; j += 1) {
            const u = Math.max(1e-12, uniform());
            const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform());
            norm2 += z * z;
        }
        const value = Math.sqrt(norm2);
        sum += value;
        sumSq += value * value;
    }
    const sampleMean = sum / samples;
    const sampleVariance = Math.max(0, sumSq / samples - sampleMean * sampleMean);

    yield {
        stepNumber: step,
        entities: makeBars(pdf, points + 1, true),
        edges: [],
        description: `Chi curve complete: mean ${theoryMean.toFixed(4)} (sample ${sampleMean.toFixed(4)}), median ${quantiles[1]?.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { k, points, samples, xs, pdf, cdf, quantiles, theoryMean, theoryVariance, sampleMean, sampleVariance, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If you draw k independent standard normal numbers and measure the length of the resulting vector, that length follows a chi distribution. For one degree of freedom it is the folded normal (the absolute value of a single normal), and as k grows the histogram becomes more symmetric and concentrates near the square root of k.",
        invariants: [
            "The density is zero at x = 0 for k greater than one and nonnegative everywhere.",
            "The cumulative curve starts at zero, never decreases, and approaches one.",
            "The mean is square root of two times Gamma((k+1)/2) over Gamma(k/2).",
        ],
        correctness:
            "A standard normal vector has joint density proportional to exp of minus half the squared radius. Changing to spherical coordinates multiplies by the surface area of a k-sphere, which is proportional to r^(k-1), giving the chi density x^(k-1) exp(-x^2/2) / (2^(k/2-1) Gamma(k/2)). Integrating that density gives one, and the moment integral gives the stated mean and variance k minus mean squared.",
        complexityRationale:
            "Each grid point needs a fixed number of arithmetic operations and one log-gamma evaluation done once, so the curve costs O(points). Drawing samples with n degrees of freedom takes O(k) work each, giving O(samples times k) for the moment check.",
        uses: [
            "Modeling the length of noise vectors in signal processing",
            "The null distribution of the sample standard deviation",
            "A building block of the chi-square and noncentral chi families",
        ],
        references: [
            "Johnson, Kotz, and Balakrishnan, Continuous Univariate Distributions, Volume 1, Chapter 18",
            "Forbes et al., Statistical Distributions, Fourth Edition",
        ],
        workedExample:
            "With k = 2 the density simplifies to x exp(-x^2/2), the Rayleigh distribution. Its mean is sqrt(2) Gamma(1.5) / Gamma(1) which is about 1.253, the median is about 1.355, and the variance is 2 minus that mean squared, about 0.429.",
    },
    id: "chi-distribution",
    name: "Chi Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points + samples * k)", space: "O(points)" },
    defaultInput: { k: 3, points: 60, samples: 4000, seed: 12345 },
    visualType: "array",
    run,
    pseudocode: [
        "read degrees of freedom k, grid size, and sample count",
        "build a nonnegative grid from zero to k plus six standard deviations",
        "for each x set density to x^(k-1) exp(-x^2/2) / (2^(k/2-1) Gamma(k/2))",
        "accumulate the cumulative area with the trapezoid rule",
        "invert the cumulative curve at 0.1, 0.5, and 0.9 for quantiles",
        "draw sample vectors, take their lengths, and accumulate moments",
        "done: report the density curve, quantiles, and theoretical moments",
    ],
};

export default module;
