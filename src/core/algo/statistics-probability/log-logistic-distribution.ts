/**
 * log-logistic-distribution.ts - Log-Logistic Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A variable is log-logistic when its logarithm is logistic. With positive
 * scale s and shape k the cumulative is x^k / (s^k + x^k), which reaches one
 * half at x = s. The density is k/s times (x/s)^(k-1) over (1 + (x/s)^k)^2,
 * and the quantile inverts the cumulative as s times (p/(1-p))^(1/k). For k
 * greater than one the mean is s times pi over k divided by sin(pi/k). The
 * heavy tail makes this a common survival and reliability model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points) to evaluate the density and cumulative curves
 *   Space: O(points) for the parallel grid arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the density.
 *   - The bar being evaluated is yellow; the finished curve is green.
 *   - The final frame reports the median, mean, and deciles.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

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
    const task = (input as { scale?: number; shape?: number; points?: number; xMax?: number } | null) ?? {};
    const scale = typeof task.scale === "number" && task.scale > 0 ? task.scale : 1;
    const k = typeof task.shape === "number" && task.shape > 0 ? task.shape : 2;
    const points = typeof task.points === "number" ? Math.max(5, Math.min(400, Math.floor(task.points))) : 80;
    const xMax = typeof task.xMax === "number" && task.xMax > 0 ? task.xMax : scale * 20;
    const xs = Array.from({ length: points + 1 }, (_, i) => (xMax * i) / points);

    const pdfAt = (x: number): number => {
        if (x <= 0) return 0;
        const u = x / scale;
        return (k / scale) * Math.pow(u, k - 1) / Math.pow(1 + Math.pow(u, k), 2);
    };
    const cdfAt = (x: number): number => {
        if (x <= 0) return 0;
        const u = x / scale;
        return Math.pow(u, k) / (1 + Math.pow(u, k));
    };
    const quantileAt = (p: number): number => scale * Math.pow(p / (1 - p), 1 / k);
    const mean = k > 1 ? (scale * Math.PI) / (k * Math.sin(Math.PI / k)) : null;

    const pdf: number[] = [];
    const cdf: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points + 1).fill(0), -1, false),
        edges: [],
        description: `Evaluating the log-logistic density with scale ${scale} and shape ${k}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { scale, k, points, xs, pdf: [], cdf: [], quantiles: [], mean, median: scale, complete: false },
    };
    let step = 1;

    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i] as number;
        const density = pdfAt(x);
        const cumulative = cdfAt(x);
        pdf.push(density);
        cdf.push(cumulative);
        yield {
            stepNumber: step,
            entities: makeBars([...pdf, ...new Array<number>(points - i).fill(0)], i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${density.toFixed(5)}, cumulative ${cumulative.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { scale, k, points, xs, pdf: [...pdf], cdf: [...cdf], quantiles: [], mean, median: scale, complete: false },
        };
        step += 1;
    }

    const quantiles = [0.1, 0.5, 0.9].map(quantileAt);

    yield {
        stepNumber: step,
        entities: makeBars(pdf, points + 1, true),
        edges: [],
        description: `Log-logistic curve complete: median ${scale.toFixed(4)}, mean ${mean === null ? "undefined" : mean.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { scale, k, points, xs, pdf, cdf, quantiles, mean, median: scale, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Take a logistic variable and exponentiate it, and the result is log-logistic. Its cumulative curve is an S shape on the log axis, so the density rises from zero, peaks near the scale, and then falls with a long heavy tail. That tail makes it useful when extreme values occur more often than a normal model allows.",
        invariants: [
            "The cumulative is zero at zero and approaches one for large x.",
            "The cumulative reaches exactly one half at x = scale.",
            "The quantile at p inverts the cumulative, so F(Q(p)) = p.",
        ],
        correctness:
            "The cumulative is x^k over s^k plus x^k, a ratio that is zero at zero, one half at x = s, and tends to one. Differentiating with respect to x gives the reported density k over s times (x/s)^(k-1) over (1 + (x/s)^k)^2. Solving y = x^k/(s^k+x^k) for x gives x = s (y/(1-y))^(1/k), the reported quantile. Integrating x times the density yields s pi over k sin(pi/k) when k exceeds one.",
        complexityRationale:
            "Each of the points plus one grid values needs a couple of powers and divisions, so the density and cumulative curves cost O(points) time and O(points) space.",
        uses: [
            "Survival analysis with a nonmonotone hazard",
            "Modeling income and insurance claim sizes with heavy tails",
            "Reliability and failure-time modeling",
        ],
        references: [
            "Lawless, Statistical Models and Methods for Lifetime Data, Chapter 4",
            "Johnson, Kotz, and Balakrishnan, Continuous Univariate Distributions, Volume 2",
        ],
        workedExample:
            "With scale 1 and shape 2 the median is 1, and the mean is pi/2, about 1.571. The density at x = 1 is 2 times 1 over 4, which is 0.5, and the 90 percent quantile is 3, since 0.9/0.1 = 9 and the square root is 3.",
    },
    id: "log-logistic-distribution",
    name: "Log-Logistic Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points)", space: "O(points)" },
    defaultInput: { scale: 1, shape: 2, points: 80, xMax: 20 },
    visualType: "array",
    run,
    pseudocode: [
        "read scale s, shape k, grid size, and right endpoint",
        "build a grid from zero to the right endpoint",
        "for each x set cumulative to x^k / (s^k + x^k)",
        "set density to k/s times (x/s)^(k-1) over (1+(x/s)^k)^2",
        "compute quantiles as s times (p/(1-p))^(1/k)",
        "compute the mean when k exceeds one and set the median to s",
        "done: report the density, cumulative, quantiles, and moments",
    ],
};

export default module;
