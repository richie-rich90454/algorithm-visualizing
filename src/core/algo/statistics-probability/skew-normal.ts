/**
 * skew-normal.ts - Skew Normal Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The skew normal family adds a shape parameter alpha to the ordinary normal,
 * letting the bell curve lean left or right. With location xi, scale omega, and
 * standardized argument z = (x - xi) / omega, the density is 2/omega times the
 * standard normal density at z times the standard normal cumulative at alpha*z.
 * Alpha zero recovers the ordinary normal. The module draws the density on a
 * grid, integrates it into a cumulative curve, and reports the closed-form
 * mean and variance together with grid quantiles.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points) for the density and cumulative curves
 *   Space: O(points) for the parallel grid arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the density.
 *   - The bar being evaluated is yellow; the finished curve is green.
 *   - The final frame reports the skewness parameter and the two moments.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Abramowitz and Stegun 7.1.26 approximation of the error function. */
function erf(x: number): number {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
    return sign * y;
}

function standardNormalCdf(z: number): number {
    return 0.5 * (1 + erf(z / Math.SQRT2));
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
    const task = (input as { xi?: number; omega?: number; alpha?: number; points?: number; zRange?: number } | null) ?? {};
    const xi = typeof task.xi === "number" ? task.xi : 0;
    const omega = typeof task.omega === "number" && task.omega > 0 ? task.omega : 1;
    const alpha = typeof task.alpha === "number" ? task.alpha : 5;
    const points = typeof task.points === "number" ? Math.max(5, Math.min(400, Math.floor(task.points))) : 80;
    const zRange = typeof task.zRange === "number" && task.zRange > 0 ? task.zRange : 6;
    const xs = Array.from({ length: points + 1 }, (_, i) => xi + omega * (-zRange + (2 * zRange * i) / points));

    const phi = (z: number): number => Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI);
    const pdfAt = (x: number): number => {
        const z = (x - xi) / omega;
        return (2 / omega) * phi(z) * standardNormalCdf(alpha * z);
    };
    const delta = alpha / Math.sqrt(1 + alpha * alpha);
    const mean = xi + omega * delta * Math.sqrt(2 / Math.PI);
    const variance = omega * omega * (1 - (2 * delta * delta) / Math.PI);

    const pdf: number[] = [];
    const cdf: number[] = [];
    let area = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points + 1).fill(0), -1, false),
        edges: [],
        description: `Evaluating the skew normal density with shape ${alpha}, location ${xi}, and scale ${omega}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { xi, omega, alpha, points, xs, pdf: [], cdf: [], quantiles: [], mean, variance, delta, complete: false },
    };
    let step = 1;

    for (let i = 0; i < xs.length; i += 1) {
        const x = xs[i] as number;
        const density = pdfAt(x);
        if (i > 0) {
            area += ((pdf[i - 1] as number + density) / 2) * (x - (xs[i - 1] as number));
        }
        pdf.push(density);
        cdf.push(area);
        yield {
            stepNumber: step,
            entities: makeBars([...pdf, ...new Array<number>(points - i).fill(0)], i, false),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${density.toFixed(5)}, cumulative ${area.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { xi, omega, alpha, points, xs, pdf: [...pdf], cdf: [...cdf], quantiles: [], mean, variance, delta, complete: false },
        };
        step += 1;
    }

    const total = area || 1;
    const normalized = cdf.map((value) => value / total);
    const quantile = (p: number): number => {
        for (let i = 1; i < normalized.length; i += 1) {
            if ((normalized[i] as number) >= p) {
                const lo = normalized[i - 1] as number;
                const hi = normalized[i] as number;
                const f = hi > lo ? (p - lo) / (hi - lo) : 0;
                return (xs[i - 1] as number) + f * ((xs[i] as number) - (xs[i - 1] as number));
            }
        }
        return xs[xs.length - 1] as number;
    };
    const quantiles = [0.1, 0.5, 0.9].map(quantile);

    yield {
        stepNumber: step,
        entities: makeBars(pdf, points + 1, true),
        edges: [],
        description: `Skew normal curve complete: mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}, median ${quantiles[1]?.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { xi, omega, alpha, points, xs, pdf, cdf: normalized, quantiles, mean, variance, delta, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Start with a bell curve and tilt it by mixing in a second bell curve truncated to one side; that is what the factor Phi of alpha times z does. A positive alpha pushes mass to the right and gives a right-skewed hump, a negative alpha pushes it left, and alpha zero leaves the familiar symmetric normal untouched.",
        invariants: [
            "Setting alpha to zero reduces the density to the ordinary normal density.",
            "The density is always nonnegative and integrates to one.",
            "The mean equals xi plus omega times delta times sqrt(2/pi), where delta is alpha over sqrt(1+alpha^2).",
        ],
        correctness:
            "Writing Phi for the standard normal cumulative and phi for its density, the skew normal density is 2 phi(z) Phi(alpha z) / omega. Substituting u = alpha z shows it integrates to one because the integrand splits into two symmetric half-normal pieces that each contribute one half. The moment integrals give the stated mean and variance, and alpha zero makes Phi zero equal one half, recovering phi(z)/omega exactly.",
        complexityRationale:
            "Each grid point computes one exponential, one error-function approximation, and a trapezoid update, so building the density and cumulative curves takes O(points) time and O(points) space.",
        uses: [
            "Modeling skewed measurement data without leaving the normal family",
            "Fitting wind speed and rainfall distributions",
            "A flexible link function in semiparametric regression",
        ],
        references: [
            "Azzalini, A Class of Distributions Which Includes the Normal Ones, 1985",
            "Genton, Skew-Elliptical Distributions and Their Applications, 2004",
        ],
        workedExample:
            "With xi = 0, omega = 1, and alpha = 5 the density at zero is 2 phi(0) Phi(0) = phi(0), about 0.399. Delta is 5/sqrt(26) about 0.981, so the mean is about 0.783 and the variance about 0.386, both shifted right of the symmetric normal.",
    },
    id: "skew-normal",
    name: "Skew Normal Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points)", space: "O(points)" },
    defaultInput: { xi: 0, omega: 1, alpha: 5, points: 80, zRange: 6 },
    visualType: "array",
    run,
    pseudocode: [
        "read location xi, scale omega, shape alpha, and grid size",
        "build a grid from xi minus zRange omega to xi plus zRange omega",
        "for each x compute z and set density to 2 phi(z) Phi(alpha z) / omega",
        "accumulate the cumulative area with the trapezoid rule and normalize",
        "invert the cumulative curve at 0.1, 0.5, and 0.9 for quantiles",
        "compute delta and from it the closed-form mean and variance",
        "done: report the density curve, quantiles, and moments",
    ],
};

export default module;
