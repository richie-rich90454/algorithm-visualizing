/**
 * logistic-distribution.ts - Logistic Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The logistic distribution is a symmetric, bell-shaped curve with slightly
 * heavier tails than the normal. It is defined by a location mu and a scale s.
 * Its cumulative curve has the simple logistic form one over one plus exp(-z),
 * its density is the derivative of that curve, and its quantile function is the
 * logit. It underlies logistic regression and the logistic growth model.
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
 *   - One bar per grid point shows the logistic density.
 *   - The bar under evaluation is highlighted; the finished curve is sorted.
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

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
    const task = (input as { mu?: number; s?: number; steps?: number; halfWidth?: number } | null) ?? {};
    const mu = typeof task.mu === "number" ? task.mu : 0;
    const s = typeof task.s === "number" && task.s > 0 ? task.s : 1;
    const steps = typeof task.steps === "number" ? Math.max(2, Math.floor(task.steps)) : 16;
    const halfWidth = typeof task.halfWidth === "number" && task.halfWidth > 0 ? task.halfWidth : 6 * s;
    const lo = mu - halfWidth;
    const hi = mu + halfWidth;
    const xs = Array.from({ length: steps + 1 }, (_, i) => lo + ((hi - lo) * i) / steps);
    const mean = mu;
    const variance = (Math.PI * Math.PI * s * s) / 3;

    const cdf = (x: number): number => 1 / (1 + Math.exp(-(x - mu) / s));
    const density = (x: number): number => {
        const e = Math.exp(-(x - mu) / s);
        return e / (s * (1 + e) ** 2);
    };
    const quantile = (p: number): number => mu + s * Math.log(p / (1 - p));

    const pdf: number[] = [];
    const cumulative: number[] = [];
    const pending = new Array<number>(steps + 1).fill(0);
    yield {
        stepNumber: 0,
        entities: makeBars(pending, -1, false),
        edges: [],
        description: `Evaluating a logistic density with location ${mu.toFixed(3)} and scale ${s.toFixed(3)} on ${steps + 1} grid points.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { mu, s, steps, xs, pdf: [], cdf: [], mean, variance, median: mu, q90: quantile(0.9), area: 0 },
    };
    let step = 1;
    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i]!;
        const d = density(x);
        const f = cdf(x);
        pdf.push(d);
        cumulative.push(f);
        const display = [...pdf, ...new Array<number>(steps - i).fill(0)];
        const area = pdf.reduce((total, value, k) => total + (k === 0 || k === pdf.length - 1 ? value / 2 : value), 0) * ((hi - lo) / steps);
        yield {
            stepNumber: step,
            entities: makeBars(display, i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${d.toFixed(5)}, cumulative ${f.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { mu, s, steps, xs, pdf: [...pdf], cdf: [...cumulative], mean, variance, median: mu, q90: quantile(0.9), area },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeBars(pdf, steps, true),
        edges: [],
        description: `Logistic distribution complete: mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}, 90th percentile ${quantile(0.9).toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { mu, s, steps, xs, pdf, cdf: cumulative, mean, variance, median: mu, q90: quantile(0.9), area: pdf.reduce((total, value, k) => total + (k === 0 || k === pdf.length - 1 ? value / 2 : value), 0) * ((hi - lo) / steps) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The logistic curve looks like a normal bell but gives a little more weight to extreme values. Sliding the location mu moves its center and increasing the scale s flattens and widens it. Because its cumulative curve and inverse are both elementary exponentials and logarithms, it is the natural link function behind logistic regression.",
        invariants: [
            "The density is symmetric about the location mu.",
            "The cumulative curve satisfies F(x) plus F(2mu - x) equals one.",
            "The quantile function is the logit of the probability.",
        ],
        correctness:
            "Differentiating the cumulative function 1/(1+exp(-z)) with respect to x gives exp(-z) divided by s times (1+exp(-z)) squared, which is the stated density and integrates to one over the real line. Solving F(x) = p for x gives mu plus s times ln(p/(1-p)), the quantile. Substituting the density into the variance integral yields pi squared s squared over three, and symmetry about mu gives the mean.",
        complexityRationale:
            "Each grid point needs a fixed number of exponential evaluations, so building the curve is O(steps) time and O(steps) space for the parallel arrays.",
        uses: [
            "The link function in logistic regression and classification",
            "Modeling growth that saturates at a carrying capacity",
            "A heavy-tailed symmetric alternative to the normal in robust modeling",
        ],
        references: [
            "Johnson, Kotz and Balakrishnan, Continuous Univariate Distributions, Volume 2",
            "Hosmer and Lemeshow, Applied Logistic Regression, Chapter 1",
        ],
        workedExample:
            "With location 0 and scale 1, the density at 0 is 0.25 and the cumulative at 0 is 0.5. The median equals the mean at 0, and the 90th percentile is ln(9), about 2.197. The variance is pi squared over three, roughly 3.29.",
    },
    id: "logistic-distribution",
    name: "Logistic Distribution",
    category: "statistics-probability",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { mu: 0, s: 1, steps: 16 },
    visualType: "array",
    run,
    pseudocode: [
        "read location mu, scale s, and the grid size",
        "for each x compute z equals (x minus mu) over s",
        "evaluate the density from the exponential form",
        "evaluate the cumulative logistic function",
        "accumulate the trapezoid area of the density",
        "set the mean to mu and variance to pi squared s squared over three",
        "report the quantiles via the logit and finish",
    ],
};

export default module;
