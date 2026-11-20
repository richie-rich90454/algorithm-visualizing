/**
 * order-statistics.ts - Distribution of an Order Statistic
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When n independent values are drawn from a continuous distribution and
 * sorted, the k-th smallest value is a random variable with its own law. For
 * uniform draws this law is a beta distribution with parameters k and n minus
 * k plus one. This module evaluates its density, its cumulative function via a
 * binomial tail, and its exact expectation k over n plus one.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points * n) for the cumulative binomial tails
 *   Space: O(points) for the density and cumulative curves
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the order-statistic density.
 *   - The current grid point is highlighted while the curve is built.
 *   - The final frame reports the exact expectation and the parameters.
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

/** Beta(k, n-k+1) density of the k-th uniform order statistic. */
function pdfAt(x: number, n: number, k: number): number {
    if (x <= 0 || x >= 1) return 0;
    const logCoeff = logGamma(n + 1) - logGamma(k) - logGamma(n - k + 1);
    return Math.exp(logCoeff + (k - 1) * Math.log(x) + (n - k) * Math.log(1 - x));
}

/** Binomial-tail expression for the cumulative probability. */
function cdfAt(x: number, n: number, k: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let total = 0;
    for (let j = k; j <= n; j += 1) {
        const logCoeff = logGamma(n + 1) - logGamma(j + 1) - logGamma(n - j + 1);
        total += Math.exp(logCoeff + j * Math.log(x) + (n - j) * Math.log(1 - x));
    }
    return total;
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
    const task = (input as { n?: number; k?: number; points?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(1, Math.min(60, Math.floor(task.n))) : 8;
    const k = typeof task.k === "number" ? Math.max(1, Math.min(n, Math.floor(task.k))) : 3;
    const points = typeof task.points === "number" ? Math.max(5, Math.min(400, Math.floor(task.points))) : 80;
    const xs = Array.from({ length: points + 1 }, (_, i) => i / points);

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points + 1).fill(0), -1, false),
        edges: [],
        description: `Building the density of the ${k}-th order statistic from ${n} uniform draws.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, k, points, xs, pdf: [], cdf: [], expectation: k / (n + 1), complete: false },
    };
    let step = 1;
    const pdf: number[] = [];
    const cdf: number[] = [];
    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i] as number;
        pdf.push(pdfAt(x, n, k));
        cdf.push(cdfAt(x, n, k));
        yield {
            stepNumber: step,
            entities: makeBars([...pdf, ...new Array<number>(points - i).fill(0)], i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${(pdf[i] as number).toFixed(5)}, cumulative ${(cdf[i] as number).toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, k, points, xs, pdf: [...pdf], cdf: [...cdf], expectation: k / (n + 1), complete: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(pdf, points + 1, true),
        edges: [],
        description: `Order-statistic curve complete: expectation ${(k / (n + 1)).toFixed(5)} for rank ${k} of ${n}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, k, points, xs, pdf, cdf, expectation: k / (n + 1), complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Sort a handful of random values and look at the k-th one in the sorted list. That value has a predictable distribution: it tends to sit near the k divided by n plus one quantile of the population. For uniform draws the density is a beta curve, becoming more concentrated as the sample grows.",
        invariants: [
            "The density is zero outside the unit interval.",
            "The cumulative value starts at zero and ends at one.",
            "The expectation of the k-th order statistic is k over n plus one.",
        ],
        correctness:
            "For a uniform sample the event that the k-th order statistic is at most x means at least k of the n draws fall at or below x, a binomial event whose tail probability is the cumulative function used here. Differentiating that tail, or counting the ways one value can sit near x with k minus one below and n minus k above, gives the beta density proportional to x^(k-1)(1-x)^(n-k). The mean of that beta law is k over n plus one.",
        complexityRationale:
            "Each grid point evaluates one density expression and a binomial tail of up to n terms, so the curve costs O(points times n) time and O(points) space for the arrays and bars.",
        uses: [
            "Computing order-statistic confidence intervals",
            "Modeling failure times of the k-th component in a system",
            "Nonparametric quantile estimation from small samples",
        ],
        references: [
            "David and Nagaraja, Order Statistics, Third Edition, Chapter 2",
            "Casella and Berger, Statistical Inference, Chapter 4",
        ],
        workedExample:
            "With n = 4 draws, the minimum has expectation 1/5, the median ranks have expectations 2/5 and 3/5, and the maximum has expectation 4/5. The density of the maximum is 4x cubed, and its cumulative value at 0.5 is 0.5 cubed, or 0.125.",
    },
    id: "order-statistics",
    name: "Distribution of an Order Statistic",
    category: "statistics-probability",
    complexity: { time: "O(points * n)", space: "O(points)" },
    defaultInput: { n: 8, k: 3, points: 80 },
    visualType: "array",
    run,
    pseudocode: [
        "read sample size n, rank k, and grid size",
        "build a grid over the unit interval",
        "for each x evaluate the beta density proportional to x^(k-1)(1-x)^(n-k)",
        "evaluate the cumulative as the binomial tail from k to n",
        "set the exact expectation to k over n plus one",
        "done: report the density curve, cumulative curve, and expectation",
    ],
};

export default module;
