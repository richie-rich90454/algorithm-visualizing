/**
 * f-distribution.ts - Snedecor F Distribution Density
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The F distribution with d1 numerator and d2 denominator degrees of freedom
 * is the ratio of two scaled chi-square variables. Its probability density is
 * evaluated on a grid of positive x values by computing log B(d1/2, d2/2)
 * with a log-gamma approximation and exponentiating the log density. The
 * result is the classic F curve used in analysis of variance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(samples) density evaluations, each O(1)
 *   Space: O(samples) to hold the sampled curve
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each sampled x is a bar whose height is the density at x.
 *   - The current sample is highlighted while the curve is traced.
 *   - The final frame reports the sampled density table in meta.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Lanczos coefficients for the log-gamma approximation. */
const LANCZOS = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
];

/** Natural logarithm of the gamma function for positive z. */
function logGamma(z: number): number {
    if (z < 0.5) {
        return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    }
    const shifted = z - 1;
    let sum = LANCZOS[0] ?? 0;
    for (let i = 1; i < LANCZOS.length; i += 1) {
        sum += (LANCZOS[i] ?? 0) / (shifted + i);
    }
    const t = shifted + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(sum);
}

/** Natural logarithm of the beta function. */
function logBeta(a: number, b: number): number {
    return logGamma(a) + logGamma(b) - logGamma(a + b);
}

/** F probability density at a positive x. */
function fPdf(x: number, d1: number, d2: number): number {
    const lb = logBeta(d1 / 2, d2 / 2);
    return Math.exp(
        (d1 / 2) * Math.log(d1 / d2) +
            (d1 / 2 - 1) * Math.log(x) -
            ((d1 + d2) / 2) * Math.log1p((d1 / d2) * x) -
            lb,
    );
}

/** Build the density bars, highlighting the sample being traced. */
function makeBars(xs: number[], pdfs: number[], active: number): VisualEntity[] {
    return xs.map((x, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `x=${x.toFixed(2)}`,
        value: pdfs[index] ?? 0,
        state: index === active ? ("highlight" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, x, pdf: pdfs[index] ?? 0 },
    }));
}

/** Trace the F density curve over a positive grid. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        d1?: number;
        d2?: number;
        minX?: number;
        maxX?: number;
        samples?: number;
    } | null) ?? {};
    const d1 = typeof task.d1 === "number" ? task.d1 : 2;
    const d2 = typeof task.d2 === "number" ? task.d2 : 4;
    const minX = typeof task.minX === "number" && task.minX > 0 ? task.minX : 0.05;
    const maxX = typeof task.maxX === "number" && task.maxX > minX ? task.maxX : 8;
    const samples = typeof task.samples === "number" ? Math.max(2, Math.min(400, Math.floor(task.samples))) : 32;

    const xs: number[] = [];
    const pdfs: number[] = [];
    for (let i = 0; i < samples; i += 1) {
        const x = minX + ((maxX - minX) * i) / (samples - 1);
        xs.push(x);
        pdfs.push(fPdf(x, d1, d2));
    }
    const lb = logBeta(d1 / 2, d2 / 2);
    const table: Array<[number, number]> = xs.map((x, i) => [x, pdfs[i] ?? 0]);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(xs, pdfs, -1),
        edges: [],
        description: `Sampling the F(${d1}, ${d2}) density at ${samples} positive x values from ${minX} to ${maxX}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { d1, d2, minX, maxX, samples, logBeta: lb, curve: table },
    };
    step += 1;

    for (let i = 0; i < samples; i += 1) {
        const x = xs[i] ?? minX;
        const pdf = pdfs[i] ?? 0;
        yield {
            stepNumber: step,
            entities: makeBars(xs, pdfs, i),
            edges: [],
            description: `At x = ${x.toFixed(3)}, the F(${d1}, ${d2}) density is ${pdf.toFixed(5)}.`,
            codeLineNumber: i < samples - 1 ? 3 : 5,
            layout: "array",
            meta: { d1, d2, x, pdf, sample: i, logBeta: lb, curve: table },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(xs, pdfs, -1),
        edges: [],
        description: `Finished the F(${d1}, ${d2}) density curve over ${samples} samples.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { d1, d2, samples, logBeta: lb, curve: table, minX, maxX },
    };
}

/** The F-distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The F distribution describes the ratio of two independent chi-square averages, which is why it governs variance ratios in analysis of variance. To draw its curve we evaluate a closed-form density at many positive x values. Working in logarithms keeps the computation stable for large degrees of freedom.",
        invariants: [
            "The density is defined only for x greater than zero.",
            "The normalizing constant is the beta function B(d1/2, d2/2).",
            "Each bar height equals the density evaluated at its own x value.",
        ],
        correctness:
            "The F density follows from the change-of-variables formula for the ratio of two scaled chi-square variables, giving f(x) proportional to x^(d1/2 - 1)(1 + (d1/d2)x)^(-(d1+d2)/2). Dividing by B(d1/2, d2/2) makes the total integral equal one, so the sampled heights are genuine density values.",
        complexityRationale:
            "The log-gamma evaluation is constant time, so generating the grid takes time proportional to the number of samples and storing the curve takes the same linear space.",
        uses: [
            "F-tests comparing variances in analysis of variance",
            "Regression significance testing",
            "Constructing confidence regions for variance ratios",
        ],
        references: [
            "Snedecor and Cochran, Statistical Methods, 1967",
            "Johnson, Kotz, and Balakrishnan, Continuous Univariate Distributions, Volume 2",
        ],
        workedExample:
            "For d1 = d2 = 1 the beta constant is pi and the density at x = 1 is 1/(2 pi), about 0.15915. For d1 = d2 = 2 the beta constant is 1 and the density at x = 1 is 1/4.",
    },
    id: "f-distribution",
    name: "F Distribution Density",
    category: "statistics-probability",
    complexity: { time: "O(samples)", space: "O(samples)" },
    defaultInput: { d1: 2, d2: 4, minX: 0.05, maxX: 8, samples: 32 },
    visualType: "array",
    run,
    pseudocode: [
        "read numerator and denominator degrees of freedom d1 and d2",
        "compute log beta of d1/2 and d2/2 with log gamma",
        "for each sample x on a positive grid",
        "compute the log density from d1, d2, and x",
        "exponentiate the log density to get the height",
        "record the sample in the density table",
        "done: report the sampled F density curve",
    ],
};

export default module;
