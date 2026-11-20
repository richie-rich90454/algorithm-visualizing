/**
 * beta-prime-distribution.ts - Beta Prime Density and Cumulative Probability
 *
 * The beta prime distribution lives on the positive reals. If Y follows a
 * Beta(a, b) law then X = Y / (1 - Y) follows a beta prime law, so its CDF can
 * be read off the incomplete beta function at x / (1 + x). This module tabulates
 * the density and CDF on a grid and lets the frames reveal them row by row.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const LANCZOS = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953,
];

function logGamma(z: number): number {
    let y = z;
    let t = z + 5.5;
    t -= (z + 0.5) * Math.log(t);
    let ser = 1.000000000190015;
    for (const c of LANCZOS) {
        y += 1;
        ser += c / y;
    }
    return -t + Math.log((2.5066282746310005 * ser) / z);
}

/** Lentz continued fraction for the incomplete beta function. */
function betaCF(a: number, b: number, x: number): number {
    const tiny = 1e-300;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m += 1) {
        const m2 = 2 * m;
        let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < tiny) d = tiny;
        c = 1 + aa / c;
        if (Math.abs(c) < tiny) c = tiny;
        d = 1 / d;
        h *= d * c;
        aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < tiny) d = tiny;
        c = 1 + aa / c;
        if (Math.abs(c) < tiny) c = tiny;
        d = 1 / d;
        const delta = d * c;
        h *= delta;
        if (Math.abs(delta - 1) < 3e-14) break;
    }
    return h;
}

/** Regularized incomplete beta I_x(a, b). */
function incompleteBeta(a: number, b: number, x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const front = Math.exp(
        logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x),
    );
    if (x < (a + 1) / (a + b + 2)) return (front * betaCF(a, b, x)) / a;
    return 1 - (front * betaCF(b, a, 1 - x)) / b;
}

function pdf(x: number, a: number, b: number): number {
    if (x <= 0) return 0;
    const logP = (a - 1) * Math.log(x) - (a + b) * Math.log1p(x)
        + logGamma(a + b) - logGamma(a) - logGamma(b);
    return Math.exp(logP);
}

function cdf(x: number, a: number, b: number): number {
    if (x <= 0) return 0;
    return incompleteBeta(a, b, x / (1 + x));
}

function makeCells(xs: number[], pdfs: number[], cdfs: number[], active: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < xs.length; i += 1) {
        const columns = [
            { label: (xs[i] ?? 0).toFixed(3), value: xs[i] ?? 0, role: "x" },
            { label: (pdfs[i] ?? 0).toFixed(5), value: pdfs[i] ?? 0, role: "pdf" },
            { label: (cdfs[i] ?? 0).toFixed(5), value: cdfs[i] ?? 0, role: "cdf" },
        ];
        columns.forEach((column, col) => {
            entities.push({
                id: `cell-${i}-${col}`,
                type: "cell" as const,
                label: column.label,
                value: column.value,
                state: done ? "sorted" : i === active ? "highlight" : i < active ? "visited" : "idle",
                x: col,
                y: i,
                width: 0,
                height: 0,
                metadata: { row: i, col, role: column.role },
            });
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number; points?: number; xMax?: number } | null) ?? {};
    const a = Math.max(0.1, Number(task.a ?? 2));
    const b = Math.max(0.1, Number(task.b ?? 3));
    const m = Math.min(120, Math.max(4, Math.floor(Number(task.points ?? 16)) || 16));
    const xMax = Math.max(0.5, Number(task.xMax ?? 8));
    const xs = Array.from({ length: m }, (_, i) => (i * xMax) / (m - 1));
    const pdfs = xs.map((x) => pdf(x, a, b));
    const cdfs = xs.map((x) => cdf(x, a, b));
    const mean = a > 1 ? a / (b - 1) : Number.POSITIVE_INFINITY;

    const meta = (added: number, done: boolean) => ({
        rows: m,
        cols: 3,
        a,
        b,
        xMax,
        mean,
        added,
        xs: [...xs],
        pdfs: [...pdfs],
        cdfs: [...cdfs],
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(xs, pdfs, cdfs, -1, false),
        edges: [],
        description: `Beta prime with a = ${a}, b = ${b}; tabulate the density and CDF on ${m} points over [0, ${xMax}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, false),
    };

    let step = 1;
    for (let i = 0; i < m; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(xs, pdfs, cdfs, i, false),
            edges: [],
            description: `At x = ${xs[i]!.toFixed(3)}: density ${pdfs[i]!.toExponential(3)}, cumulative ${cdfs[i]!.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta(i + 1, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(xs, pdfs, cdfs, -1, true),
        edges: [],
        description: `CDF rises from ${cdfs[0]!.toFixed(3)} to ${cdfs[m - 1]!.toFixed(4)}; mean is a over (b minus 1) when b exceeds 1.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: meta(m, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The beta prime is what happens when you take a probability from a Beta(a, b) distribution and form the odds ratio y over one minus y. That stretches the unit interval onto the positive real line. Its density has a power-law right tail, which makes it useful for modeling heavy-tailed positive quantities such as insurance losses.",
        invariants: [
            "The density is nonnegative and integrates to one on the positive reals.",
            "The CDF at x equals the Beta(a, b) CDF evaluated at x over one plus x.",
            "When b is greater than one the mean equals a over b minus one.",
        ],
        correctness:
            "The change of variables x equals y over one minus y has Jacobian one over one plus x squared. Substituting into the Beta density gives x to the a minus one over one plus x to the a plus b, normalized by B(a, b), which is the beta prime density. The cumulative probability up to x is therefore the Beta cumulative probability up to y equals x over one plus x, computed with the convergent incomplete-beta continued fraction and its symmetry identity for stability.",
        complexityRationale:
            "Each of the m grid points costs one density evaluation and one incomplete-beta evaluation with up to a few hundred continued-fraction terms, so the time is O(m times K) and the displayed table uses O(m) space.",
        uses: [
            "Modeling heavy-tailed insurance losses and financial returns",
            "The prior for variance ratios in Bayesian statistics",
            "F-distribution relationships and odds-ratio transformations",
        ],
        references: [
            "Johnson, Kotz and Balakrishnan, Continuous Univariate Distributions, Volume 2",
            "Press et al., Numerical Recipes, Section 6.4 on the incomplete beta function",
        ],
        workedExample:
            "For a = 2 and b = 3 the density is 12 x over one plus x to the fifth power. The mean is 2 over 2, equal to 1. At x = 1 the CDF is the Beta(2, 3) CDF at one half, which is 0.6875.",
    },
    id: "beta-prime-distribution",
    name: "Beta Prime Distribution",
    category: "statistics-probability",
    complexity: { time: "O(m * K)", space: "O(m)" },
    defaultInput: { a: 2, b: 3, points: 16, xMax: 8 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the positive shapes a and b and the grid size",
        "evaluate log gamma for the normalizing constant",
        "for each grid point x compute the beta prime density",
        "form y = x over (1 + x) for the cumulative probability",
        "evaluate the incomplete beta continued fraction at y",
        "apply the symmetry identity when y is past the switch point",
        "done: report the density and cumulative table",
    ],
};

export default module;
