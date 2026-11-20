/**
 * generalized-extreme-value.ts - Generalized Extreme Value Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The generalized extreme value distribution combines the Gumbel, Frechet, and
 * reversed Weibull families into one three-parameter model for block maxima.
 * With shape xi, location mu, and positive scale sigma it has cumulative
 * distribution exp(-(1 + xi z)^(-1/xi)) where z = (x - mu) / sigma, with the
 * Gumbel limit exp(-exp(-z)) when xi is zero. The module evaluates the density
 * and cumulative on a grid and reports standard quantiles.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps) to evaluate the grid
 *   Space: O(steps) for the x, density, and cumulative arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the density f(x).
 *   - The bar being evaluated is yellow; the finished curve is green.
 *   - The final frame reports the shape and the 10, 50, and 90 percent quantiles.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface GEVInput {
    xi?: number;
    mu?: number;
    sigma?: number;
    maxZ?: number;
    steps?: number;
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

/** Cumulative probability for one standardized value z. */
function cdfAt(z: number, xi: number): number {
    if (Math.abs(xi) < 1e-9) {
        return Math.exp(-Math.exp(-z));
    }
    const t = 1 + xi * z;
    if (t <= 0) {
        return xi > 0 ? 0 : 1;
    }
    return Math.exp(-Math.pow(t, -1 / xi));
}

/** Density for one standardized value z. */
function pdfAt(z: number, xi: number, sigma: number): number {
    if (Math.abs(xi) < 1e-9) {
        return Math.exp(-z - Math.exp(-z)) / sigma;
    }
    const t = 1 + xi * z;
    if (t <= 0) {
        return 0;
    }
    const powered = Math.pow(t, -1 / xi);
    return (Math.pow(t, -1 / xi - 1) * Math.exp(-powered)) / sigma;
}

/** Quantile for a probability p in the open interval (0, 1). */
function quantileAt(p: number, xi: number, mu: number, sigma: number): number {
    const y = -Math.log(Math.min(1 - 1e-12, Math.max(1e-12, p)));
    if (Math.abs(xi) < 1e-9) {
        return mu - sigma * Math.log(y);
    }
    return mu + (sigma * (Math.pow(y, -xi) - 1)) / xi;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GEVInput | null) ?? {};
    const xi = typeof task.xi === "number" ? task.xi : 0.1;
    const mu = typeof task.mu === "number" ? task.mu : 0;
    const sigma = typeof task.sigma === "number" && task.sigma > 0 ? task.sigma : 1;
    const maxZ = typeof task.maxZ === "number" && task.maxZ > 0 ? task.maxZ : 6;
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 12;
    const gridZ = Array.from({ length: steps + 1 }, (_, i) => -maxZ + (i * 2 * maxZ) / steps);
    const xs = gridZ.map((z) => mu + sigma * z);

    const pdf: number[] = [];
    const cdf: number[] = [];
    const pending = new Array<number>(steps + 1).fill(0);
    const quantiles = [0.1, 0.5, 0.9].map((p) => quantileAt(p, xi, mu, sigma));

    yield {
        stepNumber: 0,
        entities: makeBars(pending, -1, false),
        edges: [],
        description: `Evaluating the generalized extreme value density with shape ${xi}, location ${mu}, and scale ${sigma}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { xi, mu, sigma, maxZ, steps, xs, pdf: [], cdf: [], quantiles, family: Math.abs(xi) < 1e-9 ? "Gumbel" : xi > 0 ? "Frechet" : "reversed Weibull" },
    };
    let step = 1;

    for (let i = 0; i < gridZ.length; i += 1) {
        const z = gridZ[i] ?? 0;
        const density = pdfAt(z, xi, sigma);
        const cumulative = cdfAt(z, xi);
        pdf.push(density);
        cdf.push(cumulative);
        const shown = [...pdf, ...new Array<number>(steps - i).fill(0)];
        yield {
            stepNumber: step,
            entities: makeBars(shown, i, false),
            edges: [],
            description: `At z = ${z.toFixed(3)}: density ${density.toFixed(5)}, cumulative ${cumulative.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { xi, mu, sigma, maxZ, steps, xs, pdf: [...pdf], cdf: [...cdf], quantiles, family: Math.abs(xi) < 1e-9 ? "Gumbel" : xi > 0 ? "Frechet" : "reversed Weibull" },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(pdf, steps + 1, true),
        edges: [],
        description: `GEV curve complete: 10, 50, and 90 percent quantiles are ${quantiles.map((q) => q.toFixed(3)).join(", ")}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { xi, mu, sigma, maxZ, steps, xs, pdf, cdf, quantiles, family: Math.abs(xi) < 1e-9 ? "Gumbel" : xi > 0 ? "Frechet" : "reversed Weibull" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When you record the maximum of each block of observations, such as the yearly highest river level, those maxima follow an extreme value distribution. A single shape parameter decides the character of the tail: zero gives the Gumbel family with an exponentially decaying tail, positive values give the heavy-tailed Frechet family, and negative values give a reversed Weibull family with a finite upper endpoint. Location and scale then slide and stretch the curve.",
        invariants: [
            "The cumulative probability is between zero and one and never decreases with x.",
            "Setting xi to zero reduces the formula to the Gumbel distribution.",
            "The reported quantiles invert the cumulative curve at 0.1, 0.5, and 0.9.",
        ],
        correctness:
            "The generalized extreme value theorem says that normalized block maxima converge to a distribution whose cumulative function is exp(-(1 + xi z)^(-1/xi)) on the region where 1 + xi z is positive, with the Gumbel form exp(-exp(-z)) as the limit when xi tends to zero. Differentiating gives the density reported here. Solving the cumulative equation for z gives the quantile mu plus sigma times ((-log p)^(-xi) - 1) / xi, with the Gumbel limit mu minus sigma log of minus log p, so the reported quantiles are the inverse CDF values at the requested probabilities.",
        complexityRationale:
            "Each of the steps plus one grid points needs a power, an exponential, and a few arithmetic operations, so building the curve costs O(steps) time and O(steps) space for the parallel arrays.",
        uses: [
            "Estimating return levels for floods, storms, and heat waves",
            "Modeling maximum losses in insurance and finance",
            "Analyzing block maxima in environmental monitoring",
        ],
        references: [
            "Coles, An Introduction to Statistical Modeling of Extreme Values, Chapter 3",
            "Embrechts, Kluppelberg, and Mikosch, Extremal Events in Insurance and Finance, 1997",
        ],
        workedExample:
            "With xi = 0, mu = 0, and sigma = 1 the model is Gumbel: the cumulative at z = 0 is exp(-1), about 0.368, and the median is minus the log of log 2, about 0.367. With xi = 0.5 the upper tail is heavier and the quantiles spread farther to the right.",
    },
    id: "generalized-extreme-value",
    name: "Generalized Extreme Value Distribution",
    category: "statistics-probability",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { xi: 0.1, mu: 0, sigma: 1, maxZ: 6, steps: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "read shape xi, location mu, scale sigma, range maxZ, and step count",
        "build a standardized grid z from minus maxZ to maxZ",
        "for each z compute t as one plus xi times z",
        "set cumulative to exp of minus t raised to minus one over xi, or Gumbel when xi is zero",
        "set density to the derivative of the cumulative divided by sigma",
        "compute quantiles by inverting the cumulative at 0.1, 0.5, and 0.9",
        "done: emit the density, cumulative, and quantiles",
    ],
};

export default module;
