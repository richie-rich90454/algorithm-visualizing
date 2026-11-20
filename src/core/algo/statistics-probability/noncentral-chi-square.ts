/**
 * noncentral-chi-square.ts - Noncentral Chi-Square Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The noncentral chi-square distribution with v degrees of freedom and
 * noncentrality lambda is a Poisson-weighted mixture of central chi-square
 * laws with v + 2j degrees of freedom. This module evaluates its cumulative
 * function on a grid using a regularized incomplete gamma function for each
 * central component and a Poisson weight for the mixture.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points * mixtureTerms * gammaIterations)
 *   Space: O(points) for the cumulative curve
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the cumulative probability.
 *   - The current grid point is highlighted during evaluation.
 *   - The final frame reports the mean and variance of the distribution.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const LANCZOS = [
    0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.1385710952657201, 9.984369578019572e-6,
    1.5056327351493116e-7,
];

/** Log of the gamma function via the Lanczos approximation. */
function logGamma(z: number): number {
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    const t = z - 1;
    let x = LANCZOS[0] as number;
    for (let i = 1; i < 9; i += 1) x += (LANCZOS[i] as number) / (t + i);
    const arg = t + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (t + 0.5) * Math.log(arg) - arg + Math.log(x);
}

/** Regularized lower incomplete gamma by the series expansion. */
function gammaSeries(a: number, x: number): number {
    let ap = a;
    let sum = 1 / a;
    let delta = sum;
    for (let n = 1; n <= 500; n += 1) {
        ap += 1;
        delta *= x / ap;
        sum += delta;
        if (Math.abs(delta) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Regularized upper incomplete gamma by a continued fraction (Lentz). */
function gammaContinuedFraction(a: number, x: number): number {
    const tiny = 1e-300;
    let b = x + 1 - a;
    let c = 1 / tiny;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i <= 500; i += 1) {
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

/** Regularized lower incomplete gamma P(a, x). */
function gammaP(a: number, x: number): number {
    if (x <= 0) return 0;
    return x < a + 1 ? gammaSeries(a, x) : 1 - gammaContinuedFraction(a, x);
}

/** Cumulative distribution of the noncentral chi-square at x. */
function cdfAt(x: number, v: number, lambda: number): number {
    if (x <= 0) return 0;
    const halfLambda = lambda / 2;
    const halfX = x / 2;
    let weight = Math.exp(-halfLambda);
    let total = 0;
    for (let j = 0; j <= 400; j += 1) {
        total += weight * gammaP(v / 2 + j, halfX);
        if (j === 400 || weight < 1e-16) break;
        weight *= halfLambda / (j + 1);
    }
    return Math.min(1, total);
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
        metadata: { index, cumulative: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { v?: number; lambda?: number; points?: number } | null) ?? {};
    const v = typeof task.v === "number" && task.v > 0 ? Math.floor(task.v) : 3;
    const lambda = typeof task.lambda === "number" && task.lambda >= 0 ? task.lambda : 4;
    const points = typeof task.points === "number" ? Math.max(5, Math.min(300, Math.floor(task.points))) : 60;
    const mean = v + lambda;
    const variance = 2 * (v + 2 * lambda);
    const xMax = mean + 12 * Math.sqrt(variance) + 10;
    const xs = Array.from({ length: points + 1 }, (_, i) => (xMax * i) / points);

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points + 1).fill(0), -1, false),
        edges: [],
        description: `Building the noncentral chi-square curve with v = ${v} and lambda = ${lambda}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { v, lambda, points, xs, cdf: [], mean, variance, complete: false },
    };
    let step = 1;
    const cdf: number[] = [];
    for (let i = 0; i < xs.length; i += 1) {
        const value = cdfAt(xs[i] as number, v, lambda);
        cdf.push(value);
        yield {
            stepNumber: step,
            entities: makeBars([...cdf, ...new Array<number>(points - i).fill(0)], i, false),
            edges: [],
            description: `At x = ${(xs[i] as number).toFixed(3)}: cumulative probability ${value.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { v, lambda, points, xs, cdf: [...cdf], mean, variance, complete: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(cdf, points + 1, true),
        edges: [],
        description: `Curve complete: mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}, upper limit ${cdf[points]?.toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { v, lambda, points, xs, cdf, mean, variance, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When a set of independent normal variables has nonzero means, the sum of their squares no longer follows an ordinary chi-square law; it follows a noncentral chi-square. Think of it as a mixture: first draw how many extra degrees of freedom a Poisson process contributes, then draw an ordinary chi-square with that many degrees. Summing the weighted cumulative curves gives the answer.",
        invariants: [
            "The cumulative value is zero at zero and increases toward one.",
            "Each Poisson weight is nonnegative and the weights sum to one.",
            "With lambda zero the mixture collapses to an ordinary chi-square.",
        ],
        correctness:
            "The noncentral chi-square has a known Poisson mixture representation: the mixing weight for j extra degrees of freedom is exp(-lambda/2)(lambda/2)^j/j!, and the conditioned law is central chi-square with v + 2j degrees of freedom. A central chi-square cumulative value is the regularized lower incomplete gamma P((v+2j)/2, x/2). Summing weight times component cumulative gives the exact noncentral cumulative function.",
        complexityRationale:
            "Each grid point sums mixture terms until the Poisson weight falls below machine tolerance; each term needs one incomplete gamma evaluation done by a series or continued fraction in a bounded number of iterations. The total is O(points * mixtureTerms * gammaIterations) time and O(points) space.",
        uses: [
            "Computing power of chi-square hypothesis tests",
            "Modeling test statistics under alternative hypotheses",
            "Constructing confidence intervals for noncentral parameters",
        ],
        references: [
            "Johnson, Kotz, and Balakrishnan, Continuous Univariate Distributions, Volume 1, Chapter 25",
            "Press et al., Numerical Recipes, Section 6.2 on incomplete gamma functions",
        ],
        workedExample:
            "With v = 2 and lambda = 0 the mixture is just a central chi-square with two degrees of freedom, whose cumulative value is 1 minus exp(-x/2). At x = 2 ln 2 this is 0.5, the median. The mean is v + lambda = 6 when lambda is 4 and v is 2, and the variance is 2(v + 2 lambda) = 20.",
    },
    id: "noncentral-chi-square",
    name: "Noncentral Chi-Square Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points * terms * iterations)", space: "O(points)" },
    defaultInput: { v: 3, lambda: 4, points: 60 },
    visualType: "array",
    run,
    pseudocode: [
        "read degrees of freedom v and noncentrality lambda",
        "set mean to v + lambda and variance to 2(v + 2 lambda)",
        "build a nonnegative grid extending past the mean by twelve standard deviations",
        "for each x set weight exp(-lambda/2) and total to zero",
        "repeat: add weight times regularized gamma P((v+2j)/2, x/2) to total",
        "multiply weight by (lambda/2)/(j+1) until it is negligible",
        "done: report the cumulative curve, mean, and variance",
    ],
};

export default module;
