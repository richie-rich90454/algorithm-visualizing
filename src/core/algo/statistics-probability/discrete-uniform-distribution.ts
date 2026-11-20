/**
 * discrete-uniform-distribution.ts - Discrete Uniform Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The discrete uniform law puts equal probability 1/n on each of the n integers
 * from lower to upper inclusive. Its cumulative function rises in equal steps,
 * the mean is the midpoint (lower+upper)/2, and the variance is (n^2 - 1)/12.
 * Inverse-transform sampling maps a uniform probability u to lower plus the
 * floor of n times u. This is the discrete counterpart of the continuous
 * uniform distribution and underlies fair dice and random selection.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + samples) to build the probability table and draw samples
 *   Space: O(n) for the probability and cumulative tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per integer shows its probability mass (flat inside the range).
 *   - The bar being evaluated is yellow; the finished table is green.
 *   - The final frame reports theoretical and sampled mean and variance.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeUniform(seed: number): () => number {
    let state = (seed >>> 0) || 1;
    return () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return (state + 0.5) / 4294967296;
    };
}

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, mass: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { lower?: number; upper?: number; samples?: number; seed?: number } | null) ?? {};
    let lower = typeof task.lower === "number" && Number.isFinite(task.lower) ? Math.floor(task.lower) : 1;
    let upper = typeof task.upper === "number" && Number.isFinite(task.upper) ? Math.floor(task.upper) : 6;
    if (upper < lower) {
        const swap = lower;
        lower = upper;
        upper = swap;
    }
    if (upper - lower + 1 > 40) upper = lower + 39;
    const samples = typeof task.samples === "number" ? Math.max(1, Math.min(20000, Math.floor(task.samples))) : 6000;
    const seed = typeof task.seed === "number" ? (task.seed >>> 0) : 98765;
    const n = upper - lower + 1;
    const mass = 1 / n;
    const mean = (lower + upper) / 2;
    const variance = (n * n - 1) / 12;

    const values: number[] = [];
    for (let v = lower - 1; v <= upper + 1; v += 1) values.push(v);
    const pmf: number[] = [];
    const cdf: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(values.length).fill(0), -1, false),
        edges: [],
        description: `Building the discrete uniform table on integers ${lower} through ${upper} (${n} values).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lower, upper, n, values, pmf: [], cdf: [], mean, variance, sampleMean: 0, sampleVariance: 0, complete: false },
    };
    let step = 1;

    for (let i = 0; i < values.length; i += 1) {
        const value = values[i] as number;
        const inside = value >= lower && value <= upper;
        const probability = inside ? mass : 0;
        const cumulative = value < lower ? 0 : value > upper ? 1 : (value - lower + 1) * mass;
        pmf.push(probability);
        cdf.push(cumulative);
        yield {
            stepNumber: step,
            entities: makeBars([...pmf, ...new Array<number>(values.length - i - 1).fill(0)], i, false),
            edges: [],
            description: `Value ${value}: mass ${probability.toFixed(5)}, cumulative ${cumulative.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { lower, upper, n, values, pmf: [...pmf], cdf: [...cdf], mean, variance, sampleMean: 0, sampleVariance: 0, complete: false },
        };
        step += 1;
    }

    const uniform = makeUniform(seed);
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < samples; i += 1) {
        const draw = lower + Math.floor(n * uniform());
        sum += draw;
        sumSq += draw * draw;
    }
    const sampleMean = sum / samples;
    const sampleVariance = Math.max(0, sumSq / samples - sampleMean * sampleMean);

    yield {
        stepNumber: step,
        entities: makeBars(pmf, values.length, true),
        edges: [],
        description: `Discrete uniform table complete: mean ${mean.toFixed(4)} (sample ${sampleMean.toFixed(4)}), variance ${variance.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { lower, upper, n, values, pmf, cdf, mean, variance, sampleMean, sampleVariance, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Every integer in a finite range is equally likely, like rolling a fair die. The probability table is a flat plateau, and the cumulative table climbs by the same amount at each step. Sampling is especially simple: scale a uniform probability by the number of values, take the floor, and shift by the lower endpoint.",
        invariants: [
            "Every integer in the range receives probability one over n and no other value receives mass.",
            "The cumulative probability at value k is (k - lower + 1) over n inside the range.",
            "The theoretical mean is the midpoint and the variance is (n^2 - 1)/12.",
        ],
        correctness:
            "Summing n equal masses of 1/n gives one, so the table is a valid probability distribution. The cumulative sum through k counts k - lower + 1 equally likely outcomes, giving the stated step function. The mean is the average of an arithmetic progression, which is its midpoint, and summing squared deviations gives (n^2 - 1)/12. Inverse transform works because the cumulative steps are exactly one over n wide.",
        complexityRationale:
            "Building the table touches each of the n integers once and each draw is one arithmetic expression, so the cost is O(n plus samples) with O(n) space for the two tables.",
        uses: [
            "Modeling fair dice, lottery draws, and random tie-breaking",
            "Generating uniform random indices for resampling",
            "A null model for permutation and randomization tests",
        ],
        references: [
            "Ross, Introduction to Probability Models, Chapter 2",
            "Knuth, The Art of Computer Programming, Volume 2, Section 3.2.1",
        ],
        workedExample:
            "For a fair die lower is 1 and upper is 6, so n is 6, each face has mass 1/6, the mean is 3.5, and the variance is (36 - 1)/12 about 2.917. A uniform draw of 0.7 gives 1 plus the floor of 4.2, which is the outcome 5.",
    },
    id: "discrete-uniform-distribution",
    name: "Discrete Uniform Distribution",
    category: "statistics-probability",
    complexity: { time: "O(n + samples)", space: "O(n)" },
    defaultInput: { lower: 1, upper: 6, samples: 6000, seed: 98765 },
    visualType: "array",
    run,
    pseudocode: [
        "read lower and upper integer bounds and the sample count",
        "set n to upper minus lower plus one and mass to one over n",
        "for each value from lower minus one to upper plus one",
        "set mass to 1/n inside the range and zero outside",
        "set cumulative to the count of attained values over n",
        "draw uniform probabilities and map each to lower plus floor(n u)",
        "done: report the probability table, moments, and sample check",
    ],
};

export default module;
