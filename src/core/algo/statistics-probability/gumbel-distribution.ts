/**
 * gumbel-distribution.ts - Gumbel Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Gumbel distribution models the maximum of many samples. With location mu
 * and scale beta, its CDF is exp(-exp(-(x-mu)/beta)) and its density is
 * exp(-(z + exp(-z)))/beta with z = (x-mu)/beta. Inverse sampling uses
 * mu - beta * ln(-ln(u)). The mean is mu plus beta times Euler's constant and
 * the variance is pi squared times beta squared over six.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points + samples) to build the curve and draw samples
 *   Space: O(points + samples)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the density, skewed toward the right.
 *   - The bar being evaluated is yellow; the finished curve is green.
 *   - The final frame reports sampled mean and variance against theory.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GumbelInput {
    location?: number;
    scale?: number;
    points?: number;
    samples?: number;
    seed?: number;
}

const EULER_GAMMA = 0.5772156649015329;

function makeUniform(seed: number): () => number {
    let state = (seed >>> 0) || 1;
    return () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return (state + 0.5) / 4294967296;
    };
}

function makeBars(xs: number[], pdf: number[], current: number): VisualEntity[] {
    return xs.map((x, index) => {
        const known = index <= current;
        const value = known ? (pdf[index] ?? 0) : 0;
        let state: EntityState = "idle";
        if (known && index === current) state = "comparing";
        else if (known) state = "sorted";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: known ? `${x.toFixed(2)}: ${value.toFixed(4)}` : x.toFixed(2),
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

/** The Gumbel distribution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GumbelInput | null) ?? {};
    const location = typeof task.location === "number" && Number.isFinite(task.location) ? task.location : 0;
    const scale = typeof task.scale === "number" && Number.isFinite(task.scale) && task.scale > 0 ? task.scale : 1;
    const points = typeof task.points === "number" ? Math.max(3, Math.min(101, Math.floor(task.points))) : 25;
    const samples = typeof task.samples === "number" ? Math.max(1, Math.min(20000, Math.floor(task.samples))) : 2000;
    const seed = typeof task.seed === "number" ? (task.seed >>> 0) : 12345;

    const xs: number[] = [];
    for (let i = 0; i < points; i += 1) {
        xs.push(location + scale * (-3 + (9 * i) / (points - 1)));
    }

    yield {
        stepNumber: 0,
        entities: makeBars(xs, [], -1),
        edges: [],
        description: `Evaluating the Gumbel density on ${points} points with location ${location.toFixed(3)} and scale ${scale.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { location, scale, points, samples, xs: [], pdf: [], cdf: [], sampleMean: 0, sampleVariance: 0, complete: false },
    };
    let step = 1;

    const pdf: number[] = [];
    const cdf: number[] = [];
    for (let i = 0; i < points; i += 1) {
        const x = xs[i] as number;
        const z = (x - location) / scale;
        const inner = Math.exp(-z);
        const density = Math.exp(-(z + inner)) / scale;
        const cumulative = Math.exp(-inner);
        pdf.push(density);
        cdf.push(cumulative);
        yield {
            stepNumber: step,
            entities: makeBars(xs, pdf, i),
            edges: [],
            description: `At x = ${x.toFixed(3)}, z = ${z.toFixed(3)}: density ${density.toFixed(5)}, CDF ${cumulative.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { location, scale, points, samples, xs: xs.slice(0, i + 1), pdf: [...pdf], cdf: [...cdf], sampleMean: 0, sampleVariance: 0, complete: false },
        };
        step += 1;
    }

    const uniform = makeUniform(seed);
    let sum = 0;
    let sumSquares = 0;
    for (let i = 0; i < samples; i += 1) {
        const u = Math.min(1 - 1e-12, Math.max(1e-12, uniform()));
        const value = location - scale * Math.log(-Math.log(u));
        sum += value;
        sumSquares += value * value;
    }
    const sampleMean = sum / samples;
    const sampleVariance = Math.max(0, sumSquares / samples - sampleMean * sampleMean);

    yield {
        stepNumber: step,
        entities: makeBars(xs, pdf, -1),
        edges: [],
        description: `Drew ${samples} samples: mean ${sampleMean.toFixed(4)} (theory ${(location + scale * EULER_GAMMA).toFixed(4)}), variance ${sampleVariance.toFixed(5)} (theory ${((Math.PI * Math.PI * scale * scale) / 6).toFixed(5)}).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { location, scale, points, samples, xs, pdf, cdf, sampleMean, sampleVariance, complete: true },
    };
}

/** The Gumbel distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The Gumbel distribution appears when you take the maximum of many independent samples and rescale it. Its density has a long right tail, which is why it fits records, floods, and annual maxima. Sampling is the inverse of its double-exponential CDF: apply a logarithm to a logarithm of a uniform probability.",
        invariants: [
            "The standardized coordinate z is (x minus location) divided by scale.",
            "The CDF is exp of negative exp of negative z.",
            "The density at a point equals the CDF times exp of negative z divided by scale.",
            "The variance is pi squared times scale squared over six.",
        ],
        correctness:
            "The CDF is exp(-exp(-z)), and differentiating gives the density exp(-(z plus exp(-z))) divided by scale, so the two functions agree. Setting the CDF equal to u and solving twice with logarithms gives x = mu minus beta times log of negative log u, so inverse-transform sampling follows the Gumbel law. The cumulant-generating function of the standard Gumbel is Gamma(1 minus t), whose derivatives at zero give the Euler-gamma mean and the pi squared over six variance.",
        complexityRationale:
            "Each grid point needs two exponentials and each draw needs two logarithms, both constant time, so the curve and sampler are linear in their inputs. The grid arrays dominate space at O(points).",
        uses: [
            "Extreme value analysis for annual maxima and record events",
            "Modeling the maximum load across many servers",
            "The Gumbel-max trick for sampling from categorical distributions",
        ],
        references: [
            "Gumbel, Statistics of Extremes, 1958",
            "Coles, An Introduction to Statistical Modeling of Extreme Values, Chapter 3",
        ],
        workedExample:
            "With location zero and scale one, at x = 0 the CDF is exp(-1) about 0.3679 and the density is also exp(-1). A uniform draw of 0.5 gives minus log of log 2, about 0.3665. The theoretical mean is the Euler constant about 0.5772 and the variance is pi squared over six about 1.6449.",
    },
    id: "gumbel-distribution",
    name: "Gumbel Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points + samples)", space: "O(points + samples)" },
    defaultInput: { location: 0, scale: 1, points: 25, samples: 2000, seed: 12345 },
    visualType: "array",
    run,
    pseudocode: [
        "read location, scale, grid size, and sample count",
        "for each grid x compute z = (x - location) / scale",
        "set density to exp(-(z + exp(-z)))/scale and CDF to exp(-exp(-z))",
        "for each draw pick uniform u and set x = location - scale * ln(-ln(u))",
        "accumulate the sample mean and sample variance",
        "done: report the density curve and sampled moments",
    ],
};

export default module;
