/**
 * noncentral-t.ts - Noncentral Student's t Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The noncentral t law generalizes Student's t by allowing the normal in the
 * ratio to have a nonzero mean. If Z is normal with mean delta and unit
 * variance and V is chi-square with nu degrees of freedom, then
 * T = Z / sqrt(V / nu) has the noncentral t distribution. This module builds
 * its density on a grid by integrating the conditional normal density over a
 * chi-square quadrature, so setting delta to zero recovers the ordinary t law.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points * quadratureNodes)
 *   Space: O(points) for the density curve
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the probability density.
 *   - The current grid point is highlighted during evaluation.
 *   - The final frame reports the mean and variance of the law.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const LANCZOS = [
    0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.1385710952657201, 9.984369578019572e-6,
    1.5056327351493116e-7,
];

function logGamma(z: number): number {
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    const t = z - 1;
    let x = LANCZOS[0] as number;
    for (let i = 1; i < 9; i += 1) x += (LANCZOS[i] as number) / (t + i);
    const arg = t + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (t + 0.5) * Math.log(arg) - arg + Math.log(x);
}

interface Node {
    v: number;
    w: number;
}

/** Midpoint quadrature nodes for the chi-square density. */
function chiSquareNodes(nu: number, count: number): Node[] {
    const vMax = nu + 12 * Math.sqrt(2 * nu) + 40;
    const h = vMax / count;
    const half = nu / 2;
    const logNorm = half * Math.log(2) + logGamma(half);
    const nodes: Node[] = [];
    for (let i = 0; i < count; i += 1) {
        const v = (i + 0.5) * h;
        if (v <= 0) continue;
        const logPdf = (half - 1) * Math.log(v) - v / 2 - logNorm;
        nodes.push({ v, w: Math.exp(logPdf) * h });
    }
    return nodes;
}

/** Density at t from the chi-square mixture representation. */
function densityAt(t: number, nu: number, delta: number, nodes: Node[]): number {
    const invSqrt2Pi = 0.3989422804014327;
    let sum = 0;
    for (const node of nodes) {
        const s = Math.sqrt(node.v / nu);
        const z = t * s - delta;
        sum += node.w * s * Math.exp(-0.5 * z * z) * invSqrt2Pi;
    }
    return sum;
}

function centralTDensity(t: number, nu: number): number {
    const coeff = Math.exp(logGamma((nu + 1) / 2) - logGamma(nu / 2)) / Math.sqrt(nu * Math.PI);
    return coeff * Math.pow(1 + (t * t) / nu, -(nu + 1) / 2);
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
    const task = (input as { nu?: number; delta?: number; points?: number } | null) ?? {};
    const nu = typeof task.nu === "number" && task.nu > 0 ? Math.max(1, Math.floor(task.nu)) : 10;
    const delta = typeof task.delta === "number" ? Math.max(-6, Math.min(6, task.delta)) : 2;
    const points = typeof task.points === "number"
        ? Math.max(5, Math.min(200, Math.floor(task.points))) : 61;
    const span = 8;
    const xs = Array.from({ length: points }, (_, i) => -span + (2 * span * i) / (points - 1));
    const nodes = chiSquareNodes(nu, 1400);
    const mean = nu > 1 ? delta * Math.sqrt(nu / 2) * Math.exp(logGamma((nu - 1) / 2) - logGamma(nu / 2)) : NaN;
    const variance = nu > 2 ? (nu / (nu - 2)) * (1 + delta * delta) - mean * mean : NaN;

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points).fill(0), -1, false),
        edges: [],
        description: `Building the noncentral t density with nu = ${nu} and noncentrality delta = ${delta}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { nu, delta, points, xs, pdf: [], mean, variance, complete: false },
    };
    let step = 1;
    const pdf: number[] = [];
    for (let i = 0; i < xs.length; i += 1) {
        const value = densityAt(xs[i] as number, nu, delta, nodes);
        pdf.push(value);
        yield {
            stepNumber: step,
            entities: makeBars([...pdf, ...new Array<number>(points - pdf.length).fill(0)], i, false),
            edges: [],
            description: `At t = ${(xs[i] as number).toFixed(3)} the density is ${value.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { nu, delta, points, xs, pdf: [...pdf], mean, variance, complete: false },
        };
        step += 1;
    }

    const reference = delta === 0 ? xs.map((x) => centralTDensity(x, nu)) : undefined;
    yield {
        stepNumber: step,
        entities: makeBars(pdf, points, true),
        edges: [],
        description: `Density complete: mean ${Number.isFinite(mean) ? mean.toFixed(4) : "undefined"}, variance ${Number.isFinite(variance) ? variance.toFixed(4) : "undefined"}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { nu, delta, points, xs, pdf, mean, variance, reference: reference ?? null, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Student's t is the ratio of a standard normal to the square root of a chi-square variable. Allow the normal to have a nonzero mean and the ratio becomes noncentral, shifting and skewing the familiar bell. We recover the density by conditioning on every possible chi-square value and averaging the resulting normal densities.",
        invariants: [
            "The density is nonnegative and integrates to one.",
            "At delta zero the law collapses to ordinary Student's t.",
            "Larger noncentrality shifts the bulk of the mass to the right.",
        ],
        correctness:
            "If Z is normal with mean delta and unit variance and V is chi-square with nu degrees of freedom, the conditional density of T = Z / sqrt(V/nu) given V = v is sqrt(v/nu) times a standard normal density evaluated at t sqrt(v/nu) minus delta. Integrating this against the chi-square density of V gives the exact noncentral t density. With delta zero the integrand reduces to the central t kernel.",
        complexityRationale:
            "Each grid point evaluates the conditional normal density at every chi-square quadrature node, giving O(points times nodes) time. Only the density curve and reusable quadrature nodes are stored, so space is O(points plus nodes).",
        uses: [
            "Computing power of one-sample and two-sample t tests",
            "Modeling test statistics under alternative hypotheses",
            "Constructing noncentral confidence intervals for effect sizes",
        ],
        references: [
            "Johnson, Kotz, and Balakrishnan, Continuous Univariate Distributions, Volume 2, Chapter 31",
            "Press et al., Numerical Recipes, Section 6.2 on incomplete gamma functions",
        ],
        workedExample:
            "With nu = 10 and delta = 0 the density at t = 0 equals gamma(5.5)/(sqrt(10 pi) gamma(5)), about 0.388. Setting delta to 2 pushes the peak to the right; the mean becomes about 2.05 and the variance grows above one because the shift adds squared noncentrality.",
    },
    id: "noncentral-t",
    name: "Noncentral Student's t Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points * nodes)", space: "O(points + nodes)" },
    defaultInput: { nu: 10, delta: 2, points: 61 },
    visualType: "array",
    run,
    pseudocode: [
        "read degrees of freedom nu and noncentrality delta",
        "build chi-square quadrature nodes for nu degrees of freedom",
        "create a symmetric grid of t values",
        "for each t loop over chi-square nodes v with weight w",
        "add w times sqrt(v/nu) times the normal density at t sqrt(v/nu) minus delta",
        "record the accumulated density for this t",
        "done: report the density curve and its mean and variance",
    ],
};

export default module;
