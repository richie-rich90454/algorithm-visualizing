/**
 * t-distribution.ts - Student's t Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Student's t distribution arises when a normal mean is estimated from a small
 * sample and the unknown variance is replaced by the sample variance. It is
 * bell shaped and symmetric about zero like the normal, but its tails are
 * heavier; the heaviness is controlled by the degrees of freedom parameter df.
 * As df grows the t distribution approaches the standard normal, and at df = 1
 * it becomes the Cauchy distribution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps + fine) where fine is the integration grid size
 *   Space: O(steps + fine) for the displayed and integration arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the density f(x).
 *   - The bar being evaluated is yellow; the finished curve is green.
 *   - The final frame reports the cumulative area, mean, and variance.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface TInput {
    df?: number;
    maxX?: number;
    steps?: number;
}

/** Natural log of the gamma function via the Lanczos approximation. */
function logGamma(z: number): number {
    const coefficients = [
        0.9999999999998099, 676.5203681218851, -1259.1392167224028,
        771.3234287776531, -176.6150291621406, 12.507343278686905,
        -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7,
    ];
    if (z < 0.5) {
        return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    }
    const shifted = z - 1;
    let sum = coefficients[0] ?? 0;
    for (let i = 1; i < coefficients.length; i += 1) {
        sum += (coefficients[i] ?? 0) / (shifted + i);
    }
    const t = shifted + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(sum);
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TInput | null) ?? {};
    const df = typeof task.df === "number" && task.df > 0 ? task.df : 5;
    const maxX = typeof task.maxX === "number" && task.maxX > 0 ? task.maxX : 8;
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 12;
    const h = (2 * maxX) / steps;
    const xs = Array.from({ length: steps + 1 }, (_, i) => -maxX + i * h);
    const logConstant =
        logGamma((df + 1) / 2) - logGamma(df / 2) - 0.5 * Math.log(df * Math.PI);
    const pdfAt = (x: number): number =>
        Math.exp(logConstant - ((df + 1) / 2) * Math.log1p((x * x) / df));
    const mean = 0;
    const variance = df > 2 ? df / (df - 2) : 0;

    const fineN = 2000;
    const fineH = (2 * maxX) / fineN;
    const fineXs = Array.from({ length: fineN + 1 }, (_, i) => -maxX + i * fineH);
    const fineCdf: number[] = [0];
    for (let i = 1; i <= fineN; i += 1) {
        const left = pdfAt(fineXs[i - 1] ?? 0);
        const right = pdfAt(fineXs[i] ?? 0);
        fineCdf.push((fineCdf[i - 1] ?? 0) + ((left + right) / 2) * fineH);
    }
    const area = fineCdf[fineN] ?? 0;
    const cdfAt = (x: number): number => {
        const index = Math.max(0, Math.min(fineN, Math.round((x + maxX) / fineH)));
        return fineCdf[index] ?? 0;
    };

    const pdf: number[] = [];
    const cdf: number[] = [];
    const pending = new Array<number>(steps + 1).fill(0);

    yield {
        stepNumber: 0,
        entities: makeBars(pending, -1, false),
        edges: [],
        description: `Evaluating Student's t density with ${df} degree(s) of freedom on ${steps + 1} points from ${-maxX} to ${maxX}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { df, maxX, steps, xs, pdf: [], cdf: [], mean, variance, meanDefined: df > 1, varianceDefined: df > 2, area: 0 },
    };
    let step = 1;

    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i] ?? 0;
        const density = pdfAt(x);
        const cumulative = cdfAt(x);
        pdf.push(density);
        cdf.push(cumulative);
        const shown = [...pdf, ...new Array<number>(steps - i).fill(0)];
        yield {
            stepNumber: step,
            entities: makeBars(shown, i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${density.toFixed(5)}, cumulative ${cumulative.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { df, maxX, steps, xs, pdf: [...pdf], cdf: [...cdf], mean, variance, meanDefined: df > 1, varianceDefined: df > 2, area },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(pdf, steps + 1, true),
        edges: [],
        description: `Student's t curve complete: integrated area ${area.toFixed(5)}, mean ${df > 1 ? mean.toFixed(4) : "undefined"}, variance ${df > 2 ? variance.toFixed(4) : "undefined"}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { df, maxX, steps, xs, pdf, cdf, mean, variance, meanDefined: df > 1, varianceDefined: df > 2, area },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When a sample is small, the uncertainty in its estimated standard deviation makes extreme values more plausible than a normal curve admits. Student's t distribution has the same symmetric bell shape but heavier tails, and the degrees of freedom control how heavy. Few degrees of freedom give wide tails; many degrees of freedom recover the familiar normal curve.",
        invariants: [
            "The density is symmetric about zero and peaks at zero.",
            "The cumulative value at zero is one half.",
            "The integrated area over the grid approaches one as the range grows.",
        ],
        correctness:
            "If Z is standard normal and V is chi-square with df degrees of freedom, then Z divided by the square root of V over df has density given by the ratio of gamma functions times (1 + x squared over df) to the power minus (df plus one) over two; the Lanczos approximation evaluates those gamma functions in log space for stability. Trapezoid integration of this density gives the cumulative distribution, so its value at zero is one half by symmetry and its total approaches one. The mean exists and equals zero when df exceeds one, and the variance equals df over df minus two when df exceeds two; otherwise those moments diverge.",
        complexityRationale:
            "Evaluating the displayed grid costs O(steps), while the fine trapezoid integration uses fixed fineN subintervals, so total time is O(steps + fine); storing both grids uses corresponding linear space.",
        uses: [
            "Constructing confidence intervals for a mean with unknown variance",
            "Testing whether two sample means differ in small samples",
            "Modeling heavy-tailed financial returns as a simple alternative to normal",
        ],
        references: [
            "Student, The Probable Error of a Mean, Biometrika, 1908",
            "Casella and Berger, Statistical Inference, Chapter 9",
        ],
        workedExample:
            "At df = 1 the density at zero is 1 over pi, about 0.3183, which is the Cauchy curve. At df = 2 it is about 0.3536, and at df = 200 it is about 0.3983, close to the standard normal peak of 0.3989. The variance at df = 5 is 5 over 3, about 1.667.",
    },
    id: "t-distribution",
    name: "Student's t Distribution",
    category: "statistics-probability",
    complexity: { time: "O(steps + fine)", space: "O(steps + fine)" },
    defaultInput: { df: 5, maxX: 8, steps: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "read degrees of freedom df, range maxX, and step count",
        "compute the log normalizing constant from gamma functions of df",
        "for each grid point x compute density as the constant times (1 + x squared over df) to the minus (df + 1) over 2",
        "integrate the density on a fine grid to obtain cumulative values",
        "record density and cumulative for each displayed point",
        "report mean zero when df exceeds one and variance df over df minus two when df exceeds two",
        "done: emit the density and cumulative curves",
    ],
};

export default module;
