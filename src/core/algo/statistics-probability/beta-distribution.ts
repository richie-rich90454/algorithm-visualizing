/**
 * beta-distribution.ts - Beta Distribution PDF and CDF
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Beta(a, b) distribution is a continuous distribution on the interval
 * from zero to one, often used as a distribution over probabilities. Its
 * density is proportional to x to the (a-1) times (1-x) to the (b-1). The
 * cumulative distribution is the regularized incomplete beta function I_x(a,b),
 * which is evaluated here by the standard Lentz continued fraction. Closed
 * forms give the mean, variance, and mode, and the shape changes from U-shaped
 * to bell-shaped as the parameters rise above one.
 *
 * This is a deterministic numerical evaluation of the continuous formulas.
 * It uses the Lanczos log-gamma approximation and a truncated continued
 * fraction; there is no Monte Carlo sampling and no symbolic algebra.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * K) for m grid points and up to K continued-fraction terms
 *   Space: O(m) for the displayed density and distribution table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid is a table with columns x, density f(x), and CDF F(x).
 *   - The row being evaluated is yellow; the final row set is green.
 *   - meta carries the parameters, moments, and the full sampled table.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const COF = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.001208650973866179,
    -0.000005395239384953,
];

/** Log-gamma via the Lanczos approximation, valid for positive arguments. */
function logGamma(xx: number): number {
    const x = xx;
    let y = xx;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < COF.length; j += 1) {
        y += 1;
        ser += COF[j]! / y;
    }
    return -tmp + Math.log(2.5066282746310005 * ser / x);
}

/** Continued fraction for the incomplete beta function (Lentz method). */
function betaContinuedFraction(a: number, b: number, x: number): number {
    const MAXIT = 300;
    const EPS = 3e-14;
    const FPMIN = 1e-300;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < FPMIN) {
        d = FPMIN;
    }
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m += 1) {
        const m2 = 2 * m;
        let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < FPMIN) {
            d = FPMIN;
        }
        c = 1 + aa / c;
        if (Math.abs(c) < FPMIN) {
            c = FPMIN;
        }
        d = 1 / d;
        h *= d * c;
        aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < FPMIN) {
            d = FPMIN;
        }
        c = 1 + aa / c;
        if (Math.abs(c) < FPMIN) {
            c = FPMIN;
        }
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < EPS) {
            break;
        }
    }
    return h;
}

/** Regularized incomplete beta function I_x(a,b), the Beta CDF. */
function regularizedIncompleteBeta(a: number, b: number, x: number): number {
    if (x <= 0) {
        return 0;
    }
    if (x >= 1) {
        return 1;
    }
    const front = Math.exp(
        logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
    );
    if (x < (a + 1) / (a + b + 2)) {
        return (front * betaContinuedFraction(a, b, x)) / a;
    }
    return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Beta probability density at x. */
function betaPdf(a: number, b: number, x: number): number {
    if (x <= 0 || x >= 1) {
        return 0;
    }
    const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
    return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta);
}

/** Build the density and distribution table cells. */
function makeCells(xs: number[], pdfs: number[], cdfs: number[], active: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < xs.length; i += 1) {
        const values = [xs[i] ?? 0, pdfs[i] ?? 0, cdfs[i] ?? 0];
        const labels = [(xs[i] ?? 0).toFixed(3), (pdfs[i] ?? 0).toFixed(5), (cdfs[i] ?? 0).toFixed(5)];
        for (let col = 0; col < 3; col += 1) {
            entities.push({
                id: `cell-${i}-${col}`,
                type: "cell",
                label: labels[col] ?? "",
                value: values[col] ?? 0,
                state: done ? "sorted" : i === active ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col, x: xs[i] ?? 0, role: col },
            });
        }
    }
    return entities;
}

/** The Beta distribution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number; points?: number } | null) ?? {};
    const a = typeof task.a === "number" && task.a > 0 ? task.a : 2;
    const b = typeof task.b === "number" && task.b > 0 ? task.b : 5;
    const m = Math.min(200, Math.max(3, Math.floor(Number(task.points ?? 21)) || 21));
    const xs = Array.from({ length: m }, (_, i) => i / (m - 1));
    const pdfs = xs.map((x) => betaPdf(a, b, x));
    const cdfs = xs.map((x) => regularizedIncompleteBeta(a, b, x));
    const mean = a / (a + b);
    const variance = (a * b) / ((a + b) ** 2 * (a + b + 1));
    const mode = a > 1 && b > 1 ? (a - 1) / (a + b - 2) : 0;

    const meta = (added: number, done: boolean) => ({
        rows: m,
        cols: 3,
        a,
        b,
        mean,
        variance,
        mode,
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
        description: `Beta(${a}, ${b}): evaluate the density and cumulative probability on ${m} points over [0, 1].`,
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
            description: `At x = ${(xs[i] ?? 0).toFixed(3)}: density ${(pdfs[i] ?? 0).toFixed(5)}, cumulative probability ${(cdfs[i] ?? 0).toFixed(5)}.`,
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
        description: `Beta(${a}, ${b}): mean ${mean.toFixed(5)}, variance ${variance.toFixed(6)}, CDF ranges from 0 to 1.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: meta(m, true),
    };
}

/** The Beta distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The Beta distribution is a flexible way to describe a quantity that lives between zero and one, such as a probability or a proportion. Two shape parameters bend the density: values below one pile mass near the ends, values equal to one make it flat, and values above one make a hump. The cumulative probability is the area under that density up to x and is computed by the regularized incomplete beta function.",
        invariants: [
            "The density is nonnegative on the open interval and integrates to one.",
            "The cumulative probability is monotone, starting at zero and ending at one.",
            "The mean is a over a plus b and the variance is a b over (a plus b) squared times (a plus b plus one).",
        ],
        correctness:
            "The density formula is the Beta normalizing constant times the kernel, and the log-gamma identity gives that constant exactly up to floating-point error. The regularized incomplete beta function equals the integral of the density from zero to x; the continued fraction for the incomplete beta is a standard convergent expansion, and the symmetry identity I_x(a,b) equals one minus I_{1-x}(b,a) keeps the evaluation stable on both halves of the interval. Therefore the reported CDF matches the true area under the density.",
        complexityRationale:
            "Each grid point needs a density evaluation with a few logarithms and one incomplete-beta evaluation with up to a few hundred continued-fraction terms, so the cost is O(m times K). Storing the three-column table uses O(m) space.",
        uses: [
            "Modeling proportions, rates, and success probabilities",
            "The conjugate prior for the Bernoulli and binomial parameters",
            "Order statistics and Bayesian A/B testing",
        ],
        references: [
            "Johnson, Kotz and Balakrishnan, Continuous Univariate Distributions, Volume 2",
            "Press et al., Numerical Recipes, Section 6.4",
        ],
        workedExample:
            "For Beta(2, 5) the mean is 2/7, about 0.2857, and the variance is 10/343, about 0.029. The density peaks near (2-1)/(2+5-2) = 0.2, and the cumulative probability at 0.5 is already above 0.89 because the mass is concentrated near zero.",
    },
    id: "beta-distribution",
    name: "Beta Distribution",
    category: "statistics-probability",
    complexity: { time: "O(m * K)", space: "O(m)" },
    defaultInput: { a: 2, b: 5, points: 21 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the two positive shape parameters a and b",
        "evaluate log gamma to build the Beta normalizing constant",
        "at each grid point compute the density from the power kernel",
        "evaluate the incomplete-beta continued fraction for the CDF",
        "use the symmetry identity when x is past the switch point",
        "report the closed-form mean, variance, and mode",
        "repeat across the grid of x values",
        "done: report the density and cumulative probability table",
    ],
};

export default module;
