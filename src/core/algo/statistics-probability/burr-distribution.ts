/**
 * burr-distribution.ts - Burr Type XII Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Burr Type XII distribution is a flexible heavy-tailed family on the
 * nonnegative reals. Its cumulative function is one minus (1 + (x/s)^c)^(-k),
 * where c and k are shape parameters and s is a scale. The module evaluates
 * the density and cumulative curve on a grid and inverts the cumulative
 * function to obtain quantiles in closed form.
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
 *   - The current grid point is highlighted while the curve is built.
 *   - The final frame reports the median and upper decile from the inverse CDF.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Burr XII cumulative distribution at x. */
function cdfAt(x: number, c: number, k: number, s: number): number {
    if (x <= 0) return 0;
    return 1 - Math.pow(1 + Math.pow(x / s, c), -k);
}

/** Burr XII probability density at x. */
function pdfAt(x: number, c: number, k: number, s: number): number {
    if (x <= 0) return 0;
    const ratio = Math.pow(x / s, c);
    return ((c * k) / s) * Math.pow(x / s, c - 1) * Math.pow(1 + ratio, -k - 1);
}

/** Inverse cumulative function (quantile) at probability u. */
function quantileAt(u: number, c: number, k: number, s: number): number {
    const clamped = Math.max(1e-12, Math.min(1 - 1e-12, u));
    return s * Math.pow(Math.pow(1 - clamped, -1 / k) - 1, 1 / c);
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
    const task = (input as { c?: number; k?: number; s?: number; points?: number } | null) ?? {};
    const c = typeof task.c === "number" && task.c > 0 ? task.c : 2;
    const k = typeof task.k === "number" && task.k > 0 ? task.k : 3;
    const s = typeof task.s === "number" && task.s > 0 ? task.s : 1;
    const points = typeof task.points === "number" ? Math.max(5, Math.min(400, Math.floor(task.points))) : 60;
    const xMax = s * Math.pow(Math.pow(1e-9, -1 / k) - 1, 1 / c) * 1.05;
    const xs = Array.from({ length: points + 1 }, (_, i) => (xMax * i) / points);

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points + 1).fill(0), -1, false),
        edges: [],
        description: `Evaluating the Burr XII density with shapes c = ${c}, k = ${k}, scale ${s}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { c, k, s, points, xs, pdf: [], cdf: [], quantiles: [], complete: false },
    };
    let step = 1;
    const pdf: number[] = [];
    const cdf: number[] = [];
    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i] as number;
        pdf.push(pdfAt(x, c, k, s));
        cdf.push(cdfAt(x, c, k, s));
        yield {
            stepNumber: step,
            entities: makeBars([...pdf, ...new Array<number>(points - i).fill(0)], i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${(pdf[i] as number).toFixed(5)}, cumulative ${(cdf[i] as number).toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { c, k, s, points, xs, pdf: [...pdf], cdf: [...cdf], quantiles: [], complete: false },
        };
        step += 1;
    }

    const quantiles = [0.1, 0.5, 0.9].map((u) => quantileAt(u, c, k, s));
    yield {
        stepNumber: step,
        entities: makeBars(pdf, points + 1, true),
        edges: [],
        description: `Burr XII curve complete: median ${(quantiles[1] as number).toFixed(4)}, upper decile ${(quantiles[2] as number).toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { c, k, s, points, xs, pdf, cdf, quantiles, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The Burr XII distribution is a flexible way to describe positive quantities with a long right tail, such as losses or lifetimes. Two shape parameters control how steeply the density rises near zero and how slowly the tail decays, while a scale parameter stretches the horizontal axis. Its cumulative function has a simple closed form, so quantiles are easy to compute.",
        invariants: [
            "The cumulative value is zero at zero and increases monotonically toward one.",
            "The density is nonnegative everywhere on the positive reals.",
            "The inverse cumulative function undoes the cumulative function: F(Q(u)) equals u.",
        ],
        correctness:
            "Differentiating the cumulative expression one minus (1 + (x/s)^c)^(-k) by the chain rule gives (ck/s)(x/s)^(c-1)(1 + (x/s)^c)^(-k-1), exactly the density used here. Because the cumulative function is continuous and strictly increasing from zero to one, solving u = F(x) for x yields the stated quantile, so the two are exact inverses.",
        complexityRationale:
            "The grid evaluates a fixed number of powers and exponentials per point, so the curve costs O(points) time and O(points) space. Each quantile is a closed-form expression evaluated in constant time.",
        uses: [
            "Actuarial loss and severity modeling",
            "Reliability and lifetime analysis with heavy tails",
            "Income and wealth distribution fitting",
        ],
        references: [
            "Burr, Cumulative Frequency Functions, Annals of Mathematical Statistics 13, 1942",
            "Forbes et al., Statistical Distributions, Fourth Edition, Chapter 3",
        ],
        workedExample:
            "With c = 2, k = 3, and s = 1, the median is ((0.5)^(-1/3) - 1)^(1/2), about 0.766. At x = 1 the cumulative value is 1 minus 2^(-3), or 0.875, and the density there is 6 times 2^(-4), or 0.375.",
    },
    id: "burr-distribution",
    name: "Burr Type XII Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points)", space: "O(points)" },
    defaultInput: { c: 2, k: 3, s: 1, points: 60 },
    visualType: "array",
    run,
    pseudocode: [
        "read shape parameters c and k and scale s",
        "build a grid from zero to the 99.9999999th percentile",
        "for each x evaluate density (ck/s)(x/s)^(c-1)(1+(x/s)^c)^(-k-1)",
        "evaluate cumulative 1 - (1 + (x/s)^c)^(-k) at the same x",
        "invert the cumulative at 0.1, 0.5, and 0.9 for quantiles",
        "done: report the density curve, cumulative curve, and quantiles",
    ],
};

export default module;
