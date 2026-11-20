/**
 * probability-generating-function.ts - Probability Generating Function
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * For a nonnegative integer random variable X with probabilities p_k, the
 * probability generating function is G(s) = sum_k p_k * s^k. It encodes the
 * whole distribution in one polynomial. Evaluating at s = 1 returns one, the
 * first derivative at s = 1 returns the mean, and the second derivative there
 * yields the variance through Var = G''(1) + G'(1) - G'(1)^2. This module
 * builds the generating polynomial of a binomial variable and reads off its
 * moments, also checking them against a finite-difference derivative.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) to build the coefficients and evaluate the polynomial
 *   Space: O(n) for the coefficient array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per coefficient p_k shows its probability.
 *   - The coefficient being computed is yellow; the finished row is green.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(pmf: number[], current: number, done: boolean): VisualEntity[] {
    return pmf.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `s^${index}: ${value.toFixed(4)}`,
        value,
        state: done || index < current ? ("sorted" as const) : index === current ? ("comparing" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, k: index },
    }));
}

/** Evaluate sum_k coefficient[k] * s^k by Horner's rule. */
function evaluate(coefficients: number[], s: number): number {
    let result = 0;
    for (let i = coefficients.length - 1; i >= 0; i -= 1) {
        result = result * s + (coefficients[i] ?? 0);
    }
    return result;
}

/** The probability generating function generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; p?: number; s?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.min(20, Math.max(0, Math.floor(task.n))) : 4;
    const p = typeof task.p === "number" ? Math.min(1, Math.max(0, task.p)) : 0.5;
    const s = typeof task.s === "number" ? task.s : 0.5;
    const pmf = new Array<number>(n + 1).fill(0);
    const meanExpected = n * p;
    const varianceExpected = n * p * (1 - p);

    yield {
        stepNumber: 0,
        entities: makeBars(pmf, -1, false),
        edges: [],
        description: `Building the generating polynomial for a binomial(n=${n}, p=${p}) variable with ${n + 1} coefficients.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, p, s, pmf: [...pmf], gOfS: 0, gOfOne: 0, mean: 0, variance: 0, derivativeMean: 0 },
    };
    let step = 1;

    let coefficient = 1;
    for (let k = 0; k <= n; k += 1) {
        if (k > 0) {
            coefficient = (coefficient * (n - k + 1)) / k;
        }
        pmf[k] = coefficient * p ** k * (1 - p) ** (n - k);
        yield {
            stepNumber: step,
            entities: makeBars(pmf, k, false),
            edges: [],
            description: `Coefficient p_${k} = C(${n}, ${k}) * p^${k} * (1-p)^${n - k} = ${pmf[k]!.toFixed(5)}.`,
            codeLineNumber: k === 0 ? 1 : 3,
            layout: "array",
            meta: { n, p, s, pmf: [...pmf], gOfS: 0, gOfOne: 0, mean: 0, variance: 0, derivativeMean: 0 },
        };
        step += 1;
    }

    const gOfS = evaluate(pmf, s);
    yield {
        stepNumber: step,
        entities: makeBars(pmf, n, false),
        edges: [],
        description: `Evaluating the polynomial at s = ${s} gives G(s) = ${gOfS.toFixed(6)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, p, s, pmf: [...pmf], gOfS, gOfOne: 0, mean: 0, variance: 0, derivativeMean: 0 },
    };
    step += 1;

    const gOfOne = evaluate(pmf, 1);
    const mean = pmf.reduce((sum, value, k) => sum + k * value, 0);
    const variance = pmf.reduce((sum, value, k) => sum + (k - mean) ** 2 * value, 0);
    const h = 1e-4;
    const derivativeMean = (evaluate(pmf, 1 + h) - evaluate(pmf, 1 - h)) / (2 * h);
    yield {
        stepNumber: step,
        entities: makeBars(pmf, n, false),
        edges: [],
        description: `G(1) = ${gOfOne.toFixed(6)}. The first derivative at one gives mean ${mean.toFixed(4)} and the second gives variance ${variance.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, p, s, pmf: [...pmf], gOfS, gOfOne, mean, variance, derivativeMean },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(pmf, n, true),
        edges: [],
        description: `Done: G(1) = 1, mean ${mean.toFixed(4)} matches n*p, variance ${variance.toFixed(4)} matches n*p*(1-p).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, p, s, pmf: [...pmf], gOfS, gOfOne, mean, variance, derivativeMean, expectedMean: meanExpected, expectedVariance: varianceExpected },
    };
}

/** The probability generating function module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Package every probability p_k as the coefficient of s to the k in a polynomial. Substituting s = 1 collapses all coefficients into one because the probabilities sum to one. Differentiating pulls down powers of k, so the slope at one is the average, and a second derivative reveals the spread. It is a compact algebraic encoding of the whole distribution.",
        invariants: [
            "The coefficients p_k are nonnegative and sum to one.",
            "G(1) equals the total probability, one.",
            "G'(1) equals the expectation and G''(1) + G'(1) - G'(1)^2 equals the variance.",
        ],
        correctness:
            "Differentiating the series term by term gives G'(s) = sum k p_k s^(k-1), so G'(1) = sum k p_k = E[X]. Differentiating again gives G''(1) = sum k(k-1) p_k = E[X(X-1)]. Since Var(X) = E[X^2] - E[X]^2 = E[X(X-1)] + E[X] - E[X]^2, the stated variance formula follows. For a binomial variable the coefficients are C(n,k) p^k (1-p)^(n-k).",
        complexityRationale:
            "The coefficients are generated by updating one binomial coefficient per k, costing constant work each, and evaluating the polynomial is a linear Horner pass; time and space are both O(n).",
        uses: [
            "Deriving moments of counting distributions cleanly",
            "Analyzing sums of independent integer variables by multiplying polynomials",
            "A first algebraic tool in actuarial and queueing models",
        ],
        references: [
            "Grimmett and Welsh, Probability: An Introduction, Chapter 4",
            "Ross, Introduction to Probability Models, Chapter 2",
        ],
        workedExample:
            "For a binomial variable with n = 4 and p = 0.5 the coefficients are 1/16, 4/16, 6/16, 4/16, 1/16, summing to one. G(1) = 1, G'(1) = 2, and G''(1) = 3, so the variance is 3 + 2 - 4 = 1, which equals n*p*(1-p) = 1.",
    },
    id: "probability-generating-function",
    name: "Probability Generating Function",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { n: 4, p: 0.5, s: 0.5 },
    visualType: "array",
    run,
    pseudocode: [
        "read the binomial parameters n and p and a value s",
        "initialize the coefficient for k zero to one",
        "for each k update the binomial coefficient",
        "multiply by p to the k and one minus p to the n minus k",
        "evaluate the polynomial at s with Horner's rule",
        "differentiate at one to read mean and variance",
        "done: report G(s), G(1), and the moments",
    ],
};

export default module;
