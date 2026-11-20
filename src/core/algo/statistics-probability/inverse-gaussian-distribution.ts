/**
 * inverse-gaussian-distribution.ts - Inverse Gaussian Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The inverse Gaussian describes the time a Brownian motion with positive
 * drift takes to reach a fixed level. It is skewed, supported on positive
 * values, and has a closed form cumulative curve built from the standard
 * normal distribution. Its mean is mu and its variance is mu cubed over lambda.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps) to evaluate the grid
 *   Space: O(steps) for the density and cumulative arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the density.
 *   - The current point is highlighted; the finished curve is green.
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function normalCdf(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    const upper = (Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) * poly;
    return z >= 0 ? 1 - upper : upper;
}

function makeBars(density: number[], current: number, done: boolean): VisualEntity[] {
    return density.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { mu?: number; lambda?: number; steps?: number; maxX?: number } | null) ?? {};
    const mu = typeof task.mu === "number" && task.mu > 0 ? task.mu : 2;
    const lambda = typeof task.lambda === "number" && task.lambda > 0 ? task.lambda : 4;
    const steps = typeof task.steps === "number" ? Math.max(2, Math.floor(task.steps)) : 16;
    const maxX = typeof task.maxX === "number" && task.maxX > 0 ? task.maxX : 4 * mu;
    const xs = Array.from({ length: steps + 1 }, (_, i) => (maxX * i) / steps);
    const variance = (mu ** 3) / lambda;

    const density = (x: number): number => {
        if (x <= 0) return 0;
        return Math.sqrt(lambda / (2 * Math.PI * x ** 3)) * Math.exp((-lambda * (x - mu) ** 2) / (2 * mu * mu * x));
    };
    const cumulative = (x: number): number => {
        if (x <= 0) return 0;
        const root = Math.sqrt(lambda / x);
        return normalCdf(root * (x / mu - 1)) + Math.exp((2 * lambda) / mu) * normalCdf(-root * (x / mu + 1));
    };

    const pdf: number[] = [];
    const cdf: number[] = [];
    const base = { mu, lambda, steps, maxX, mean: mu, variance };
    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(steps + 1).fill(0), -1, false),
        edges: [],
        description: `Evaluating an inverse Gaussian density with mean ${mu} and shape ${lambda}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, xs, pdf: [], cdf: [], area: 0 },
    };
    let step = 1;
    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i]!;
        pdf.push(density(x));
        cdf.push(Math.min(1, cumulative(x)));
        const display = [...pdf, ...new Array<number>(steps - i).fill(0)];
        const area = pdf.reduce((s, v, k) => s + (k === 0 || k === pdf.length - 1 ? v / 2 : v), 0) * (maxX / steps);
        yield {
            stepNumber: step++,
            entities: makeBars(display, i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${(pdf[i] ?? 0).toFixed(5)}, cumulative ${(cdf[i] ?? 0).toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { ...base, xs, pdf: [...pdf], cdf: [...cdf], area },
        };
    }
    const area = pdf.reduce((s, v, k) => s + (k === 0 || k === pdf.length - 1 ? v / 2 : v), 0) * (maxX / steps);
    yield {
        stepNumber: step,
        entities: makeBars(pdf, steps, true),
        edges: [],
        description: `Inverse Gaussian complete: mean ${mu.toFixed(4)}, variance ${variance.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...base, xs, pdf, cdf, area },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When a particle drifts steadily but jitters randomly, the time it first reaches a target follows an inverse Gaussian curve. The curve is skewed toward long waiting times, with a sharp rise near the mean and a long right tail. It is the natural model for first-passage times and for skewed positive measurements.",
        invariants: [
            "The density is zero for nonpositive x.",
            "The cumulative curve is nondecreasing and approaches one.",
            "The mean is mu and the variance is mu cubed over lambda.",
        ],
        correctness:
            "The density is the first-passage time distribution of a Brownian motion with drift mu and diffusion parameter lambda, obtained by inverting its Laplace transform. Its cumulative function is the sum of two standard normal probabilities, one with an exponential tilt. Evaluating that formula at the grid points and integrating x times the density reproduces the mean mu and variance mu cubed over lambda; the two normal terms cancel in the exponential tilt so the total area is one.",
        complexityRationale:
            "Each grid point needs a fixed number of exponentials and normal evaluations, so time is O(steps). The density and cumulative arrays occupy O(steps) space.",
        uses: [
            "First-passage time modeling in finance and reliability",
            "Analyzing skewed response times",
            "Modeling cumulative damage until a threshold is crossed",
        ],
        references: [
            "Folks and Chhikara, The Inverse Gaussian Distribution, 1978",
            "Johnson, Kotz, and Balakrishnan, Continuous Univariate Distributions, Volume 2",
        ],
        workedExample:
            "With mu = 2 and lambda = 4 the mean is 2 and the variance is 8/4 = 2. The density peaks just below 2 and has a long tail toward larger x; at x = 2 the cumulative probability is about 0.5.",
    },
    id: "inverse-gaussian-distribution",
    name: "Inverse Gaussian Distribution",
    category: "statistics-probability",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { mu: 2, lambda: 4, steps: 16, maxX: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "read mean mu and shape lambda",
        "for each grid point x evaluate the density kernel",
        "evaluate the two-term normal cumulative formula",
        "accumulate trapezoid area under the density",
        "compute the variance as mu cubed over lambda",
        "done: report density, cumulative curve, and moments",
    ],
};

export default module;
