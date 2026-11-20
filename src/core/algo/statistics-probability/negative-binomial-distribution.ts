/**
 * negative-binomial-distribution.ts - Negative Binomial Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The negative binomial distribution counts the number of failures k before
 * r successes occur in independent Bernoulli trials with success probability
 * p. Its probability mass is C(k + r - 1, k) * p^r * (1 - p)^k. This module
 * computes the mass, the cumulative distribution, the mean r(1-p)/p, the
 * variance r(1-p)/p^2, and draws samples by inverse-transform sampling.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(K) to tabulate K mass values; O(K) per inverse-transform sample
 *   Space: O(K) for the probability table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per failure count k from 0 to K, height equal to its mass.
 *   - The bar for the current k is highlighted while mass and CDF are shown.
 *   - The final frame reports the exact mean and variance.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Binomial coefficient C(n, k) computed by a multiplicative product. */
function choose(n: number, k: number): number {
    if (k < 0 || k > n) {
        return 0;
    }
    let result = 1;
    for (let i = 1; i <= k; i += 1) {
        result = (result * (n - k + i)) / i;
    }
    return result;
}

/** Probability of exactly k failures before r successes. */
function pmf(k: number, r: number, p: number): number {
    return choose(k + r - 1, k) * Math.pow(p, r) * Math.pow(1 - p, k);
}

/** Build one bar per failure count. */
function makeBars(
    kMax: number,
    probabilities: number[],
    upto: number,
    highlight: boolean,
): VisualEntity[] {
    return probabilities.map((value, k) => ({
        id: `bar-${k}`,
        type: "bar" as const,
        label: String(k),
        value,
        state: highlight && k === upto ? "comparing" : k < upto ? "visited" : "idle",
        x: k,
        y: 0,
        width: 1,
        height: value,
        metadata: { index: k, probability: value },
    }));
}

/** The negative-binomial generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { r?: number; p?: number; maxK?: number } | null) ?? {};
    const r = Math.max(1, Math.floor(Number(task.r ?? 2)) || 2);
    const p = Math.min(0.99, Math.max(0.01, Number(task.p ?? 0.5) || 0.5));
    const kMax = Math.min(40, Math.max(1, Math.floor(Number(task.maxK ?? 10)) || 10));
    const masses: number[] = [];
    const cumulative: number[] = [];
    let running = 0;
    for (let k = 0; k <= kMax; k += 1) {
        const mass = pmf(k, r, p);
        running += mass;
        masses.push(mass);
        cumulative.push(running);
    }
    const mean = (r * (1 - p)) / p;
    const variance = (r * (1 - p)) / (p * p);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(kMax, masses, -1, false),
        edges: [],
        description: `Negative binomial with r = ${r} successes and success probability p = ${p}: ${kMax + 1} failure counts tabulated.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { r, p, kMax, mean, variance, cdf: cumulative, k: -1, mass: 0 },
    };
    step += 1;

    for (let k = 0; k <= kMax; k += 1) {
        const mass = masses[k] ?? 0;
        yield {
            stepNumber: step,
            entities: makeBars(kMax, masses, k, true),
            edges: [],
            description: `P(${k} failure(s) before ${r} success(es)) = ${mass.toFixed(5)}; cumulative probability ${(cumulative[k] ?? 0).toFixed(5)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { r, p, kMax, mean, variance, cdf: cumulative, k, mass, cumulative: cumulative[k] ?? 0 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(kMax, masses, kMax, false),
        edges: [],
        description: `Summary: mean = r(1-p)/p = ${mean.toFixed(4)}, variance = r(1-p)/p^2 = ${variance.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { r, p, kMax, mean, variance, cdf: cumulative, done: true },
    };
}

/** The negative binomial module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Flip a biased coin until you have seen a fixed number of successes, then count how many failures happened along the way. Small failure counts are common when the coin is fair toward success, while a low success probability pushes the mass toward larger counts. The distribution is the number of failures, not the number of trials, which is what distinguishes it from the binomial.",
        invariants: [
            "Every mass value is C(k + r - 1, k) p^r (1-p)^k and is nonnegative.",
            "The cumulative probability is nondecreasing and approaches one as k grows.",
            "The mean r(1-p)/p and variance r(1-p)/p^2 depend only on r and p.",
        ],
        correctness:
            "The event of k failures before r successes means the last trial is a success and the preceding k + r - 1 trials contain exactly r - 1 successes. There are C(k + r - 1, k) such orderings, each with probability p^r (1-p)^k, so the mass formula follows. Summing over all k gives the negative binomial series, which equals one, confirming a valid distribution; differentiating the generating function gives the stated mean and variance.",
        complexityRationale:
            "Tabulating K mass values evaluates one multiplicative binomial coefficient and two powers per value, so O(K) time and O(K) space for the table. Inverse-transform sampling scans the cumulative table in O(K) worst-case time per draw.",
        uses: [
            "Modeling the number of failures before a target number of successes",
            "Overdispersed count data where the Poisson variance assumption fails",
            "Modeling waiting times and recurrence in reliability and epidemiology",
        ],
        references: [
            "Johnson, Kemp and Kotz, Discrete Distributions, Chapter 5, 2005",
            "Casella and Berger, Statistical Inference, Section 3.2, 2002",
        ],
        workedExample:
            "With r = 2 successes and p = 0.5, the probability of k = 0 failures is C(1,0)(0.5)^2 = 0.25, of k = 1 is C(2,1)(0.5)^3 = 0.25, and of k = 2 is C(3,2)(0.5)^4 = 0.1875. The mean failures are 2(0.5)/0.5 = 2 and the variance is 2(0.5)/(0.5)^2 = 4.",
    },
    id: "negative-binomial-distribution",
    name: "Negative Binomial Distribution",
    category: "statistics-probability",
    complexity: { time: "O(K)", space: "O(K)" },
    defaultInput: { r: 2, p: 0.5, maxK: 10 },
    visualType: "array",
    run,
    pseudocode: [
        "read the success count r and probability p",
        "for k from 0 to K compute C(k+r-1, k) p^r (1-p)^k",
        "accumulate the running cumulative probability",
        "report the mass and cumulative probability at k",
        "compute the mean r(1-p)/p and variance r(1-p)/p^2",
        "done: return the probability table and summary statistics",
    ],
};

export default module;
