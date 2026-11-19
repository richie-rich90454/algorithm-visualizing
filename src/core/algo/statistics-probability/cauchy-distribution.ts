/**
 * cauchy-distribution.ts - Cauchy (Lorentz) Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Cauchy distribution is a heavy-tailed continuous law with location x0
 * and scale gamma. Its density is 1 / (pi * gamma * (1 + z^2)) with
 * z = (x - x0) / gamma, and its CDF is 1/2 + atan(z) / pi. Inverse-transform
 * sampling uses the quantile x0 + gamma * tan(pi * (u - 1/2)). The mean and
 * variance do not exist; the median is the location and the IQR is 2 gamma.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points + samples log samples) to build the curve and sort draws
 *   Space: O(points + samples)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the density at that x.
 *   - The bar being evaluated is yellow; the finished curve is green.
 *   - The final frame reports the sampled median and interquartile range.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CauchyInput {
    location?: number;
    scale?: number;
    points?: number;
    samples?: number;
    seed?: number;
}

/** Deterministic uniform draw in the open interval (0, 1). */
function makeUniform(seed: number): () => number {
    let state = (seed >>> 0) || 1;
    return () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return (state + 0.5) / 4294967296;
    };
}

/** Build density bars, revealing entries up to current. */
function makeBars(
    xs: number[],
    pdf: number[],
    current: number,
): VisualEntity[] {
    return xs.map((x, index) => {
        const known = index <= current;
        const value = known ? (pdf[index] ?? 0) : 0;
        let state: EntityState = "idle";
        if (known && index === current) state = "comparing";
        else if (known) state = "sorted";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: known ? `x=${x.toFixed(2)}: ${value.toFixed(4)}` : `x=${x.toFixed(2)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, x },
        };
    });
}

/** The Cauchy distribution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CauchyInput | null) ?? {};
    const location = typeof task.location === "number" && Number.isFinite(task.location) ? task.location : 0;
    const scale = typeof task.scale === "number" && Number.isFinite(task.scale) && task.scale > 0 ? task.scale : 1;
    const points = typeof task.points === "number" ? Math.max(3, Math.min(101, Math.floor(task.points))) : 25;
    const samples = typeof task.samples === "number" ? Math.max(1, Math.min(20000, Math.floor(task.samples))) : 2000;
    const seed = typeof task.seed === "number" ? (task.seed >>> 0) : 12345;

    const xs: number[] = [];
    for (let i = 0; i < points; i += 1) {
        xs.push(location + scale * (-6 + (12 * i) / (points - 1)));
    }

    yield {
        stepNumber: 0,
        entities: makeBars(xs, [], -1),
        edges: [],
        description: `Evaluating the Cauchy density on ${points} points with location ${location.toFixed(3)} and scale ${scale.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { location, scale, points, samples, xs: [], pdf: [], cdf: [], sampleMedian: 0, sampleIqr: 0, complete: false },
    };
    let step = 1;

    const pdf: number[] = [];
    const cdf: number[] = [];
    for (let i = 0; i < points; i += 1) {
        const x = xs[i] as number;
        const z = (x - location) / scale;
        const density = 1 / (Math.PI * scale * (1 + z * z));
        const cumulative = 0.5 + Math.atan(z) / Math.PI;
        pdf.push(density);
        cdf.push(cumulative);
        yield {
            stepNumber: step,
            entities: makeBars(xs, pdf, i),
            edges: [],
            description: `At x = ${x.toFixed(3)}, z = ${z.toFixed(3)}: density ${density.toFixed(5)}, CDF ${cumulative.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { location, scale, points, samples, xs: xs.slice(0, i + 1), pdf: [...pdf], cdf: [...cdf], sampleMedian: 0, sampleIqr: 0, complete: false },
        };
        step += 1;
    }

    const uniform = makeUniform(seed);
    const draws: number[] = [];
    for (let i = 0; i < samples; i += 1) {
        const u = Math.min(1 - 1e-12, Math.max(1e-12, uniform()));
        draws.push(location + scale * Math.tan(Math.PI * (u - 0.5)));
    }
    draws.sort((a, b) => a - b);
    const quantile = (p: number): number => {
        const index = Math.min(draws.length - 1, Math.max(0, Math.floor(p * (draws.length - 1))));
        return draws[index] as number;
    };
    const sampleMedian = quantile(0.5);
    const sampleIqr = quantile(0.75) - quantile(0.25);

    yield {
        stepNumber: step,
        entities: makeBars(xs, pdf, -1),
        edges: [],
        description: `Drew ${samples} samples: median ${sampleMedian.toFixed(3)}, IQR ${sampleIqr.toFixed(3)} (theoretical 2*scale = ${(2 * scale).toFixed(3)}).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { location, scale, points, samples, xs, pdf, cdf, sampleMedian, sampleIqr, complete: true },
    };
}

/** The Cauchy distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The Cauchy density is a bell-shaped curve with much heavier tails than a normal curve. It is centered at a location parameter and spread by a scale parameter. Drawing a value is easy: pick a uniform probability and push it through the inverse CDF, which is a tangent function.",
        invariants: [
            "The standardized coordinate z is (x minus location) divided by scale.",
            "The density at the location equals one over pi times scale.",
            "The CDF is one half plus atan(z) over pi, so it runs from zero to one.",
            "The interquartile range of the distribution is exactly twice the scale.",
        ],
        correctness:
            "Substituting u = x0 + gamma times tangent of pi times (p minus one half) into the CDF gives atan(tan(pi times (p minus one half))) over pi plus one half, which simplifies to p, so the sampler draws from the Cauchy law. The density differentiates the CDF by the chain rule. Because the tails decay only as one over x squared, the integrals defining the mean and variance diverge, while the median stays at x0 and the quartiles stay at x0 plus or minus gamma.",
        complexityRationale:
            "Evaluating the density at every grid point is constant work each, so building the curve costs O(points). Inverse-transform sampling is constant per draw and the median and quartiles come from one sort, giving O(points plus samples log samples) time and O(points plus samples) space.",
        uses: [
            "Modeling heavy-tailed financial returns",
            "Robust statistics as the sampling distribution of a ratio of normals",
            "Cauchy noise in optimization and Bayesian priors",
        ],
        references: [
            "Johnson, Kotz, and Balakrishnan, Continuous Univariate Distributions, Volume 1, Chapter 16",
            "Press et al., Numerical Recipes, Section 7.2",
        ],
        workedExample:
            "With location zero and scale one, the density at x = 0 is 1/pi about 0.3183, and the CDF there is 0.5. A uniform draw of 0.75 maps to tangent of pi over four, which is 1, so the sampled value is 1. The quartiles are minus one and plus one, giving an IQR of two.",
    },
    id: "cauchy-distribution",
    name: "Cauchy Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points + samples log samples)", space: "O(points + samples)" },
    defaultInput: { location: 0, scale: 1, points: 25, samples: 2000, seed: 12345 },
    visualType: "array",
    run,
    pseudocode: [
        "read location, scale, grid size, and sample count",
        "for each grid x compute z = (x - location) / scale",
        "set density to 1 / (pi * scale * (1 + z^2))",
        "set cumulative to 1/2 + atan(z) / pi",
        "for each draw pick uniform u and set x = location + scale * tan(pi * (u - 1/2))",
        "sort the draws and read the median and the two quartiles",
        "done: report the density curve and the sampled median and IQR",
    ],
};

export default module;
