/**
 * uniform-distribution.ts - Continuous Uniform Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The uniform distribution on [a, b] has constant density 1/(b-a) inside the
 * interval and zero outside. Its CDF rises linearly from zero to one, the mean
 * is (a+b)/2, and the variance is (b-a)^2/12. Inverse-transform sampling maps
 * a uniform probability u to the value a + (b-a) * u.
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
 *   - One bar per grid point shows the density (flat inside the interval).
 *   - The bar being evaluated is yellow; the finished curve is green.
 *   - The final frame reports sampled mean and variance against theory.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface UniformInput {
    lower?: number;
    upper?: number;
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

/** The uniform distribution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as UniformInput | null) ?? {};
    let lower = typeof task.lower === "number" && Number.isFinite(task.lower) ? task.lower : 0;
    let upper = typeof task.upper === "number" && Number.isFinite(task.upper) ? task.upper : 1;
    if (upper <= lower) {
        const mid = lower;
        lower = mid - 0.5;
        upper = mid + 0.5;
    }
    const points = typeof task.points === "number" ? Math.max(3, Math.min(101, Math.floor(task.points))) : 25;
    const samples = typeof task.samples === "number" ? Math.max(1, Math.min(20000, Math.floor(task.samples))) : 2000;
    const seed = typeof task.seed === "number" ? (task.seed >>> 0) : 12345;
    const width = upper - lower;

    const xs: number[] = [];
    for (let i = 0; i < points; i += 1) {
        xs.push(lower - 0.15 * width + (1.3 * width * i) / (points - 1));
    }

    yield {
        stepNumber: 0,
        entities: makeBars(xs, [], -1),
        edges: [],
        description: `Evaluating the uniform density on [${lower.toFixed(3)}, ${upper.toFixed(3)}] over ${points} points.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lower, upper, points, samples, xs: [], pdf: [], cdf: [], sampleMean: 0, sampleVariance: 0, complete: false },
    };
    let step = 1;

    const pdf: number[] = [];
    const cdf: number[] = [];
    for (let i = 0; i < points; i += 1) {
        const x = xs[i] as number;
        const density = x >= lower && x <= upper ? 1 / width : 0;
        const cumulative = x < lower ? 0 : x > upper ? 1 : (x - lower) / width;
        pdf.push(density);
        cdf.push(cumulative);
        yield {
            stepNumber: step,
            entities: makeBars(xs, pdf, i),
            edges: [],
            description: `At x = ${x.toFixed(3)}: density ${density.toFixed(5)}, CDF ${cumulative.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { lower, upper, points, samples, xs: xs.slice(0, i + 1), pdf: [...pdf], cdf: [...cdf], sampleMean: 0, sampleVariance: 0, complete: false },
        };
        step += 1;
    }

    const uniform = makeUniform(seed);
    let sum = 0;
    let sumSquares = 0;
    for (let i = 0; i < samples; i += 1) {
        const value = lower + width * uniform();
        sum += value;
        sumSquares += value * value;
    }
    const sampleMean = sum / samples;
    const sampleVariance = Math.max(0, sumSquares / samples - sampleMean * sampleMean);

    yield {
        stepNumber: step,
        entities: makeBars(xs, pdf, -1),
        edges: [],
        description: `Drew ${samples} samples: mean ${sampleMean.toFixed(4)} (theory ${((lower + upper) / 2).toFixed(4)}), variance ${sampleVariance.toFixed(5)} (theory ${((width * width) / 12).toFixed(5)}).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { lower, upper, points, samples, xs, pdf, cdf, sampleMean, sampleVariance, complete: true },
    };
}

/** The uniform distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Every value in the interval is equally likely, so the density is a flat plateau. Outside the interval the density is zero. The cumulative distribution climbs in a straight line from zero at the lower endpoint to one at the upper endpoint, which makes sampling a simple scaling of a uniform random number.",
        invariants: [
            "The density equals one over (upper minus lower) inside the interval and zero outside.",
            "The CDF is zero below lower, (x minus lower) over the width inside, and one above upper.",
            "Every generated sample lies inside the interval.",
        ],
        correctness:
            "The integral of a constant density 1/(b-a) over an interval of length b-a is one, so this is a valid distribution. The CDF is the integral of that density from a to x, which is (x-a)/(b-a). Setting the CDF equal to u and solving gives x = a + (b-a)u, so inverse-transform sampling produces exactly the uniform law. Integrating x times the density gives (a+b)/2 and integrating (x-mean) squared gives (b-a)^2/12.",
        complexityRationale:
            "Each grid point needs a constant-time density and CDF evaluation, and each draw needs one arithmetic expression, so the total work is O(points plus samples). Two arrays of grid values and one pass of accumulator variables use O(points) space beyond the drawn values.",
        uses: [
            "Generating baseline random numbers for simulation",
            "Modeling equally likely outcomes and randomized algorithms",
            "Prior distributions bounded to a known range",
        ],
        references: [
            "Ross, Introduction to Probability Models, Chapter 2",
            "Knuth, The Art of Computer Programming, Volume 2, Section 3.2.1",
        ],
        workedExample:
            "For the interval [2, 6] the width is four, so the density inside is 0.25. At x = 4 the CDF is (4-2)/4 = 0.5. A uniform draw of 0.75 maps to 2 + 4 times 0.75 = 5. The theoretical mean is 4 and the variance is 16/12 about 1.333.",
    },
    id: "uniform-distribution",
    name: "Uniform Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points + samples)", space: "O(points + samples)" },
    defaultInput: { lower: 0, upper: 1, points: 25, samples: 2000, seed: 12345 },
    visualType: "array",
    run,
    pseudocode: [
        "read the lower and upper endpoints and the grid size",
        "compute the width as upper minus lower",
        "for each grid x set density to 1/width inside, else zero",
        "set the CDF to the clipped fraction (x - lower)/width",
        "for each draw pick uniform u and set x = lower + width * u",
        "accumulate the mean and variance of the draws",
        "done: report the density curve and sampled moments",
    ],
};

export default module;
