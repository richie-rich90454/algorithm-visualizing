/**
 * bayesian-bootstrap.ts - Bayesian Bootstrap
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Bayesian bootstrap replaces the equal resampling probabilities of the
 * ordinary bootstrap with random Dirichlet weights over the observed data.
 * Drawing Dirichlet(1, ..., 1) weights is equivalent to drawing independent
 * exponential variables and normalizing them. Each draw gives a weighted mean,
 * and the collection of draws approximates the posterior distribution of the
 * mean without any parametric assumption.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(draws * n) for all weighted means
 *   Space: O(n) for the current weight vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per observation shows its weight in the most recent draw.
 *   - The bars move each frame as a new Dirichlet draw is taken.
 *   - The final frame reports simulated and exact posterior moments.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Deterministic linear congruential uniform generator in (0, 1). */
function makeUniform(seed: number): () => number {
    let state = (seed >>> 0) || 1;
    return () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return (state + 0.5) / 4294967296;
    };
}

function makeBars(weights: number[]): VisualEntity[] {
    return weights.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: "active",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, weight: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { data?: number[]; draws?: number; seed?: number } | null) ?? {};
    const data = task.data ?? [2, 4, 4, 4, 5, 5, 7, 9];
    const n = data.length;
    const draws = typeof task.draws === "number" ? Math.max(1, Math.min(20000, Math.floor(task.draws))) : 2000;
    const seed = typeof task.seed === "number" ? (task.seed >>> 0) : 4242;
    const uniform = makeUniform(seed);
    const sum = data.reduce((a, b) => a + b, 0);
    const analyticMean = n > 0 ? sum / n : 0;
    const second = data.reduce((a, value) => a + value * value, 0);
    const sampleVarianceN = n > 0 ? second / n - analyticMean * analyticMean : 0;
    const analyticVariance = n > 1 ? sampleVarianceN / (n + 1) : 0;

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(n).fill(1 / Math.max(1, n))),
        edges: [],
        description: `Preparing ${draws} Bayesian bootstrap draws over ${n} observations.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, draws, data, weights: new Array<number>(n).fill(1 / Math.max(1, n)), runningMean: analyticMean, analyticMean, analyticVariance, simulatedMean: 0, simulatedVariance: 0, complete: false },
    };
    let step = 1;
    let statSum = 0;
    let statSq = 0;
    let weights = new Array<number>(n).fill(1 / Math.max(1, n));
    for (let d = 0; d < draws; d += 1) {
        const exponentials = new Array<number>(n);
        let total = 0;
        for (let i = 0; i < n; i += 1) {
            const value = -Math.log(Math.max(1e-15, uniform()));
            exponentials[i] = value;
            total += value;
        }
        weights = exponentials.map((value) => value / total);
        let statistic = 0;
        for (let i = 0; i < n; i += 1) statistic += (weights[i] as number) * (data[i] as number);
        statSum += statistic;
        statSq += statistic * statistic;
        if (d % Math.max(1, Math.floor(draws / 40)) === 0 || d === draws - 1) {
            const simulatedMean = statSum / (d + 1);
            yield {
                stepNumber: step,
                entities: makeBars(weights),
                edges: [],
                description: `Draw ${d + 1}: weighted mean ${statistic.toFixed(4)}, running posterior mean ${simulatedMean.toFixed(4)}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { n, draws, data, weights: [...weights], runningMean: simulatedMean, analyticMean, analyticVariance, simulatedMean, simulatedVariance: Math.max(0, statSq / (d + 1) - simulatedMean * simulatedMean), complete: false },
            };
            step += 1;
        }
    }

    const simulatedMean = statSum / draws;
    const simulatedVariance = Math.max(0, statSq / draws - simulatedMean * simulatedMean);
    yield {
        stepNumber: step,
        entities: makeBars(weights),
        edges: [],
        description: `Posterior complete: simulated mean ${simulatedMean.toFixed(4)} versus exact ${analyticMean.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, draws, data, weights, runningMean: simulatedMean, analyticMean, analyticVariance, simulatedMean, simulatedVariance, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The Bayesian bootstrap treats the observed data points as the entire support of an unknown distribution and puts random probability mass on them. Instead of resampling rows, it draws a fresh set of weights for each iteration. This gives a posterior over statistics such as the mean while making no assumption about the underlying population.",
        invariants: [
            "Each draw's weights are nonnegative and sum to one.",
            "The expected value of each weight is one over the sample size.",
            "The posterior mean of the weighted mean equals the ordinary sample mean.",
        ],
        correctness:
            "Normalizing independent unit exponential variables produces Dirichlet(1, ..., 1) weights, so the nonzero components follow the uniform Dirichlet law and their expectation is one over n. The weighted mean is a linear function of the weights, so its posterior mean is the sample mean. Dirichlet moment formulas give a posterior variance equal to the sample variance computed with denominator n divided by n plus one.",
        complexityRationale:
            "Each draw generates n exponentials and forms one weighted sum, so the total is O(draws times n) time. Only the current weight vector and running sums are kept, giving O(n) space.",
        uses: [
            "Uncertainty quantification for statistics with minimal assumptions",
            "A Bayesian alternative to the frequentist bootstrap",
            "Posterior inference for weighted survey and machine-learning estimates",
        ],
        references: [
            "Rubin, The Bayesian Bootstrap, Annals of Statistics 9, 1981",
            "Efron and Tibshirani, An Introduction to the Bootstrap, Chapter 3",
        ],
        workedExample:
            "For the data 0 and 1, a Dirichlet(1, 1) draw makes the first weight uniform on the unit interval. The weighted mean is therefore uniform, with mean 0.5 and variance 1/12. The formula sample variance with denominator n, which is 0.25, divided by n plus one, gives 0.25/3 or about 0.0833, matching 1/12.",
    },
    id: "bayesian-bootstrap",
    name: "Bayesian Bootstrap",
    category: "statistics-probability",
    complexity: { time: "O(draws * n)", space: "O(n)" },
    defaultInput: { data: [2, 4, 4, 4, 5, 5, 7, 9], draws: 2000, seed: 4242 },
    visualType: "array",
    run,
    pseudocode: [
        "read the observed data, number of draws, and random seed",
        "compute the sample mean and the sample variance with denominator n",
        "for each draw generate n independent unit exponential variables",
        "normalize them by their sum to obtain Dirichlet weights",
        "form the weighted mean and accumulate its running moments",
        "set the exact posterior mean to the sample mean",
        "set the exact posterior variance to sample variance divided by n + 1",
        "done: report simulated and exact posterior moments",
    ],
};

export default module;
