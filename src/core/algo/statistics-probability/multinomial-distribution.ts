/**
 * multinomial-distribution.ts - Multinomial Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The multinomial distribution generalizes the binomial to more than two
 * outcomes. Running n independent trials that each fall into one of k
 * categories with probability p_i gives a count vector N_i. Its probability is
 * n! / (product N_i!) times the product of p_i to the N_i. Log factorials keep
 * the coefficient finite. Sampling draws each trial by inverting the cumulative
 * category probabilities.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k + n * samples * k) for the probability and the sampling passes
 *   Space: O(k) for counts and cumulative probabilities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per category shows the probability; the target count is labeled.
 *   - The bar being evaluated is yellow; the finished law is green.
 *   - The final frame reports the empirical proportions from sampling.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MultinomialInput {
    n?: number;
    probabilities?: number[];
    counts?: number[];
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

function logFactorial(value: number): number {
    let total = 0;
    for (let i = 2; i <= value; i += 1) total += Math.log(i);
    return total;
}

function makeBars(
    probabilities: number[],
    counts: number[],
    current: number,
    empirical: number[],
): VisualEntity[] {
    return probabilities.map((probability, index) => {
        const known = index <= current;
        const value = current < 0 ? probability : empirical[index] ?? probability;
        let state: EntityState = "idle";
        if (known && index === current && current >= 0) state = "comparing";
        else if (current < 0 || known) state = "sorted";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `cat ${index}: p=${probability.toFixed(3)} N=${counts[index] ?? 0}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, probability, count: counts[index] ?? 0 },
        };
    });
}

/** The multinomial distribution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MultinomialInput | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(1, Math.min(200, Math.floor(task.n))) : 8;
    const raw = Array.isArray(task.probabilities) && task.probabilities.length >= 2 && task.probabilities.length <= 12
        ? task.probabilities.map((value) => Math.max(0, Number(value) || 0))
        : [0.5, 0.3, 0.2];
    const sumProbabilities = raw.reduce((total, value) => total + value, 0);
    const probabilities = sumProbabilities > 0 ? raw.map((value) => value / sumProbabilities) : raw.map(() => 1 / raw.length);
    const k = probabilities.length;
    const counts = Array.isArray(task.counts) && task.counts.length === k
        ? task.counts.map((value) => Math.max(0, Math.floor(Number(value) || 0)))
        : probabilities.map((value) => Math.floor(n * value));
    const samples = typeof task.samples === "number" ? Math.max(1, Math.min(50000, Math.floor(task.samples))) : 4000;
    const seed = typeof task.seed === "number" ? (task.seed >>> 0) : 12345;
    const countsSum = counts.reduce((total, value) => total + value, 0);
    const valid = countsSum === n;

    yield {
        stepNumber: 0,
        entities: makeBars(probabilities, counts, -1, []),
        edges: [],
        description: `Evaluating a multinomial law with ${n} trials across ${k} categories.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, k, probabilities, counts, logPmf: 0, pmf: 0, sampledCounts: new Array<number>(k).fill(0), empirical: new Array<number>(k).fill(0), expected: probabilities.map((p) => n * p), valid, complete: false },
    };
    let step = 1;

    let logPmf = valid ? logFactorial(n) : Number.NEGATIVE_INFINITY;
    let runningTerm = logFactorial(n);
    for (let i = 0; i < k; i += 1) {
        if (valid) {
            runningTerm -= logFactorial(counts[i] as number);
            const probability = probabilities[i] as number;
            if (probability > 0) runningTerm += (counts[i] as number) * Math.log(probability);
            else if ((counts[i] as number) > 0) runningTerm = Number.NEGATIVE_INFINITY;
            logPmf = runningTerm;
        }
        yield {
            stepNumber: step,
            entities: makeBars(probabilities, counts, i, []),
            edges: [],
            description: valid
                ? `Category ${i}: count ${counts[i]}, contribution to log probability gives partial log P = ${logPmf.toFixed(4)}.`
                : `Count vector sums to ${countsSum}, not ${n}; the PMF is zero.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, k, probabilities, counts, logPmf, pmf: Number.isFinite(logPmf) ? Math.exp(logPmf) : 0, sampledCounts: new Array<number>(k).fill(0), empirical: new Array<number>(k).fill(0), expected: probabilities.map((p) => n * p), valid, complete: false },
        };
        step += 1;
    }

    const uniform = makeUniform(seed);
    const sampledCounts = new Array<number>(k).fill(0);
    for (let draw = 0; draw < samples; draw += 1) {
        for (let trial = 0; trial < n; trial += 1) {
            const u = uniform();
            let cumulative = 0;
            let chosen = k - 1;
            for (let i = 0; i < k; i += 1) {
                cumulative += probabilities[i] as number;
                if (u < cumulative) {
                    chosen = i;
                    break;
                }
            }
            sampledCounts[chosen] = (sampledCounts[chosen] as number) + 1;
        }
    }
    const totalDraws = samples * n;
    const empirical = sampledCounts.map((value) => value / totalDraws);

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, counts, -1, empirical),
        edges: [],
        description: `Sampled ${samples} vectors: proportions ${empirical.map((value) => value.toFixed(3)).join(", ")} versus theoretical ${probabilities.map((value) => value.toFixed(3)).join(", ")}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, k, probabilities, counts, logPmf, pmf: Number.isFinite(logPmf) ? Math.exp(logPmf) : 0, sampledCounts, empirical, expected: probabilities.map((p) => n * p), valid, complete: true },
    };
}

/** The multinomial distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A multinomial trial is like rolling a loaded die several times and counting how often each face appears. Any particular count pattern has a multinomial coefficient counting the orderings, multiplied by the probability of one such ordering. Sampling imitates the experiment directly by picking a category per trial from the cumulative probabilities.",
        invariants: [
            "The category probabilities are nonnegative and sum to one.",
            "A valid count vector sums to the number of trials.",
            "The expected count in category i is n times p_i.",
            "The sampled counts across all repetitions add up to n times the number of repetitions.",
        ],
        correctness:
            "Each of the n trials is independent, so the chance of a particular sequence with count vector N is the product of p_i to the N_i. There are n! divided by the product of N_i! distinct sequences with that vector, and summing the multinomial theorem over all valid vectors gives (sum p_i) to the n, which is one. Sampling by inverting the cumulative probabilities assigns each trial to category i with probability p_i, so the empirical proportions converge to the theoretical ones.",
        complexityRationale:
            "The log factorials take O(k) work beyond the n loop, and each sampled trial scans up to k cumulative probabilities, giving O(k plus n times samples times k) time. Only one count vector and a cumulative accumulator are needed, so space is O(k).",
        uses: [
            "Modeling word counts in a document topic model",
            "Chi-square goodness-of-fit null distributions",
            "Sampling categorical outcomes in Monte Carlo simulation",
        ],
        references: [
            "Johnson and Kotz, Discrete Multivariate Distributions, Chapter 5",
            "Ross, Introduction to Probability Models, Chapter 1",
        ],
        workedExample:
            "For three categories with probabilities 0.5, 0.3, and 0.2 over four trials, the count vector 2, 1, 1 has probability 4!/(2!1!1!) times 0.5 squared times 0.3 times 0.2, about 0.18. The expected counts are 2, 1.2, and 0.8.",
    },
    id: "multinomial-distribution",
    name: "Multinomial Distribution",
    category: "statistics-probability",
    complexity: { time: "O(k + n * samples * k)", space: "O(k)" },
    defaultInput: { n: 8, probabilities: [0.5, 0.3, 0.2], counts: [4, 3, 1], samples: 4000, seed: 12345 },
    visualType: "array",
    run,
    pseudocode: [
        "read trial count, probabilities, target counts, and sample count",
        "normalize the probabilities so they sum to one",
        "set log P to log(n!) minus the sum of log(N_i!)",
        "add N_i times log(p_i) for every category",
        "for each sampled vector pick n categories by inverse CDF",
        "tally the counts and divide by the total trials",
        "done: report the PMF and the empirical proportions",
    ],
};

export default module;
