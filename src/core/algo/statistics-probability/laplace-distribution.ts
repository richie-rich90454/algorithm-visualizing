/**
 * laplace-distribution.ts - Laplace (Double Exponential) Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Laplace distribution is a symmetric, sharper-peaked alternative to the
 * normal with location mu and scale b. Its density is exp(-|x-mu|/b)/(2b) and
 * its CDF splits at mu into 0.5*exp((x-mu)/b) below and 1 - 0.5*exp(-(x-mu)/b)
 * above. Inverse sampling uses mu - b*sign(u-0.5)*ln(1 - 2|u-0.5|). The mean is
 * mu and the variance is 2 b squared.
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
 *   - One bar per grid point shows the density, peaked at the location.
 *   - The bar being evaluated is yellow; the finished curve is green.
 *   - The final frame reports sampled mean and variance against theory.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LaplaceInput {
    location?: number;
    scale?: number;
    points?: number;
    samples?: number;
    seed?: number;
}

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

/** The Laplace distribution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LaplaceInput | null) ?? {};
    const location = typeof task.location === "number" && Number.isFinite(task.location) ? task.location : 0;
    const scale = typeof task.scale === "number" && Number.isFinite(task.scale) && task.scale > 0 ? task.scale : 1;
    const points = typeof task.points === "number" ? Math.max(3, Math.min(101, Math.floor(task.points))) : 25;
    const samples = typeof task.samples === "number" ? Math.max(1, Math.min(20000, Math.floor(task.samples))) : 2000;
    const seed = typeof task.seed === "number" ? (task.seed >>> 0) : 12345;

    const xs: number[] = [];
    for (let i = 0; i < points; i += 1) {
        xs.push(location + scale * (-8 + (16 * i) / (points - 1)));
    }

    yield {
        stepNumber: 0,
        entities: makeBars(xs, [], -1),
        edges: [],
        description: `Evaluating the Laplace density on ${points} points with location ${location.toFixed(3)} and scale ${scale.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { location, scale, points, samples, xs: [], pdf: [], cdf: [], sampleMean: 0, sampleVariance: 0, complete: false },
    };
    let step = 1;

    const pdf: number[] = [];
    const cdf: number[] = [];
    for (let i = 0; i < points; i += 1) {
        const x = xs[i] as number;
        const density = Math.exp(-Math.abs(x - location) / scale) / (2 * scale);
        const cumulative = x < location
            ? 0.5 * Math.exp((x - location) / scale)
            : 1 - 0.5 * Math.exp(-(x - location) / scale);
        pdf.push(density);
        cdf.push(cumulative);
        yield {
            stepNumber: step,
            entities: makeBars(xs, pdf, i),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${density.toFixed(5)}, CDF ${cumulative.toFixed(5)}.`,
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
        const offset = u - 0.5;
        const value = location - scale * Math.sign(offset) * Math.log(1 - 2 * Math.abs(offset));
        sum += value;
        sumSquares += value * value;
    }
    const sampleMean = sum / samples;
    const sampleVariance = Math.max(0, sumSquares / samples - sampleMean * sampleMean);

    yield {
        stepNumber: step,
        entities: makeBars(xs, pdf, -1),
        edges: [],
        description: `Drew ${samples} samples: mean ${sampleMean.toFixed(4)} (theory ${location.toFixed(4)}), variance ${sampleVariance.toFixed(5)} (theory ${(2 * scale * scale).toFixed(5)}).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { location, scale, points, samples, xs, pdf, cdf, sampleMean, sampleVariance, complete: true },
    };
}

/** The Laplace distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The Laplace density looks like two exponential decay curves joined at a sharp peak. It assigns more probability to values near the location and to extreme outliers than a normal does, which makes it useful when large deviations are common. Sampling pushes a uniform probability through the inverse of its piecewise CDF using a logarithm.",
        invariants: [
            "The density is symmetric about the location parameter.",
            "The peak density at the location equals one over twice the scale.",
            "The CDF is below one half to the left of the location and above one half to the right.",
            "The variance of the law is twice the scale squared.",
        ],
        correctness:
            "For x below mu the CDF integrates the density exp((x-mu)/b)/(2b) from minus infinity and gives 0.5 exp((x-mu)/b); for x above mu symmetry gives 1 minus 0.5 exp(-(x-mu)/b). Inverting each branch yields the sampler mu minus b times sign(u-1/2) times log(1 minus 2|u-1/2|), so draws follow the Laplace law. The symmetry of the density forces the mean to be mu, and a direct second-moment integral yields 2 b squared.",
        complexityRationale:
            "Building the curve evaluates one exponential per grid point, and sampling evaluates one logarithm per draw, so both loops are linear. Storing the grid arrays uses O(points) space, plus O(samples) if the draws are retained.",
        uses: [
            "Differential privacy noise calibrated to sensitivity",
            "Robust regression with L1 loss priors",
            "Modeling heavy-tailed errors in signal processing",
        ],
        references: [
            "Johnson, Kotz, and Balakrishnan, Continuous Univariate Distributions, Volume 2, Chapter 24",
            "Dwork and Roth, The Algorithmic Foundations of Differential Privacy, Chapter 3",
        ],
        workedExample:
            "With location zero and scale one, the density at zero is 0.5 and the CDF is 0.5. A uniform draw of 0.75 has offset 0.25, so the value is minus log(1 minus 0.5), about 0.693. Two squared is the theoretical variance, and the theoretical mean is zero.",
    },
    id: "laplace-distribution",
    name: "Laplace Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points + samples)", space: "O(points + samples)" },
    defaultInput: { location: 0, scale: 1, points: 25, samples: 2000, seed: 12345 },
    visualType: "array",
    run,
    pseudocode: [
        "read location, scale, grid size, and sample count",
        "for each grid x compute the exponential density exp(-|x-mu|/b)/(2b)",
        "compute the piecewise CDF split at the location",
        "for each draw pick uniform u and invert the CDF with a logarithm",
        "accumulate the sample mean and sample variance",
        "done: report the density curve and sampled moments",
    ],
};

export default module;
