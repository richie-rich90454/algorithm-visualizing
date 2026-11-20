/**
 * dagum-distribution.ts - Dagum Type I Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Dagum Type I distribution models positive, right-skewed quantities such
 * as income and insurance losses. Its cumulative function is
 * (1 + (x/b)^(-a))^(-p), with shape parameters a and p and scale b. The module
 * evaluates the density and cumulative curve on a grid and obtains quantiles
 * by algebraically inverting the cumulative function.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points) for the grid plus O(1) per quantile
 *   Space: O(points) for the bars and curves
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the density.
 *   - The current grid point is highlighted during evaluation.
 *   - The final frame reports the 10th, 50th, and 90th percentiles.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Dagum cumulative distribution at x. */
function cdfAt(x: number, a: number, b: number, p: number): number {
    if (x <= 0) return 0;
    return Math.pow(1 + Math.pow(x / b, -a), -p);
}

/** Dagum probability density at x. */
function pdfAt(x: number, a: number, b: number, p: number): number {
    if (x <= 0) return 0;
    const ratio = Math.pow(x / b, a);
    return ((a * p) / b) * Math.pow(x / b, a * p - 1) * Math.pow(1 + ratio, -p - 1);
}

/** Inverse cumulative function at probability u. */
function quantileAt(u: number, a: number, b: number, p: number): number {
    const clamped = Math.max(1e-12, Math.min(1 - 1e-12, u));
    return b * Math.pow(Math.pow(clamped, -1 / p) - 1, -1 / a);
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
    const task = (input as { a?: number; b?: number; p?: number; points?: number } | null) ?? {};
    const a = typeof task.a === "number" && task.a > 0 ? task.a : 2;
    const b = typeof task.b === "number" && task.b > 0 ? task.b : 1;
    const p = typeof task.p === "number" && task.p > 0 ? task.p : 3;
    const points = typeof task.points === "number" ? Math.max(5, Math.min(400, Math.floor(task.points))) : 60;
    const xMax = b * Math.pow(Math.pow(0.999999, -1 / p) - 1, -1 / a) * 1.05;
    const xs = Array.from({ length: points + 1 }, (_, i) => (xMax * i) / points);

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points + 1).fill(0), -1, false),
        edges: [],
        description: `Evaluating the Dagum density with shapes a = ${a}, p = ${p}, scale ${b}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { a, b, p, points, xs, pdf: [], cdf: [], quantiles: [], complete: false },
    };
    let step = 1;
    const pdf: number[] = [];
    const cdf: number[] = [];
    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i] as number;
        pdf.push(pdfAt(x, a, b, p));
        cdf.push(cdfAt(x, a, b, p));
        yield {
            stepNumber: step,
            entities: makeBars([...pdf, ...new Array<number>(points - i).fill(0)], i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${(pdf[i] as number).toFixed(5)}, cumulative ${(cdf[i] as number).toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { a, b, p, points, xs, pdf: [...pdf], cdf: [...cdf], quantiles: [], complete: false },
        };
        step += 1;
    }

    const quantiles = [0.1, 0.5, 0.9].map((u) => quantileAt(u, a, b, p));
    yield {
        stepNumber: step,
        entities: makeBars(pdf, points + 1, true),
        edges: [],
        description: `Dagum curve complete: median ${(quantiles[1] as number).toFixed(4)}, upper decile ${(quantiles[2] as number).toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { a, b, p, points, xs, pdf, cdf, quantiles, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The Dagum distribution describes how a positive quantity is spread when a few large values dominate. Its cumulative function has two shape parameters: one controls the lower tail near zero and the other controls how heavy the upper tail is. Because the cumulative function is a simple algebraic expression, its quantiles can be written directly without numerical search.",
        invariants: [
            "The cumulative value starts at zero for x at or below zero and rises toward one.",
            "The density is nonnegative and integrates to one over the positive reals.",
            "The quantile expression inverts the cumulative function exactly.",
        ],
        correctness:
            "Writing the cumulative function as v^p over (1 + v)^p with v = (x/b)^a, differentiating by the product and chain rules gives (ap/b)(x/b)^(ap-1)(1 + (x/b)^a)^(-p-1), the density used here. Solving u = (1 + (x/b)^(-a))^(-p) for x gives b times (u^(-1/p) minus 1) to the power minus 1/a, so the reported quantiles are exact inverses.",
        complexityRationale:
            "Every grid point needs a constant number of powers, giving O(points) time and O(points) space for the curves. Each quantile is a closed-form computation with constant cost.",
        uses: [
            "Fitting income and wealth distributions in economics",
            "Modeling large insurance claims and reinsurance losses",
            "Describing city-size and firm-size distributions",
        ],
        references: [
            "Dagum, A New Model of Personal Income Distribution, Economie Appliquee 30, 1977",
            "Kleiber and Kotz, Statistical Size Distributions in Economics and Actuarial Sciences, Chapter 3",
        ],
        workedExample:
            "With a = 2, b = 1, and p = 3, the cumulative value at x = 1 is (1 + 1)^(-3), or 0.125. The density there is 6 times 2^(-4), or 0.375. The median is (2^(1/3) minus 1)^(-1/2), about 1.13.",
    },
    id: "dagum-distribution",
    name: "Dagum Type I Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points)", space: "O(points)" },
    defaultInput: { a: 2, b: 1, p: 3, points: 60 },
    visualType: "array",
    run,
    pseudocode: [
        "read shape parameters a and p and scale b",
        "build a grid from zero to the 99.9999th percentile",
        "for each x evaluate density (ap/b)(x/b)^(ap-1)(1+(x/b)^a)^(-p-1)",
        "evaluate cumulative (1 + (x/b)^(-a))^(-p) at the same x",
        "invert the cumulative at 0.1, 0.5, and 0.9 for quantiles",
        "done: report the density curve, cumulative curve, and quantiles",
    ],
};

export default module;
