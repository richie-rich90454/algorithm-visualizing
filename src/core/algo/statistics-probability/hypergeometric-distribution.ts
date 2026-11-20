/**
 * hypergeometric-distribution.ts - Hypergeometric Probability Mass Function
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The hypergeometric distribution counts successes when drawing n items without
 * replacement from a population of N items that contains K successes. Its
 * probability mass function is C(K, k) times C(N-K, n-k) divided by C(N, n).
 * Unlike the binomial distribution, each draw changes the composition of what
 * remains, so the trials are dependent.
 *
 * Every coefficient is computed by an exact multiplicative recurrence, and the
 * probabilities are checked against the combinatorial definition.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) to compute coefficients and probabilities
 *   Space: O(n) for the array of probabilities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per possible success count k, from zero through n.
 *   - The bar being computed is yellow; the finished distribution is green.
 *   - Mean, variance, and total probability are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Exact integer binomial coefficient for the small ranges used here. */
export function binomial(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    const symmetric = Math.min(k, n - k);
    let result = 1;
    for (let i = 0; i < symmetric; i += 1) {
        result = Math.round((result * (n - i)) / (i + 1));
    }
    return result;
}

/** Lower and upper support bounds for the number of successes. */
export function hypergeometricSupport(N: number, K: number, n: number): [number, number] {
    return [Math.max(0, n - (N - K)), Math.min(n, K)];
}

/** Probability of exactly k successes in n draws without replacement. */
export function hypergeometricPmf(N: number, K: number, n: number, k: number): number {
    const denominator = binomial(N, n);
    if (denominator === 0) return 0;
    return binomial(K, k) * binomial(N - K, n - k) / denominator;
}

/** Build one bar per success count from zero to n. */
function makeBars(
    probabilities: Array<number | null>,
    current: number,
    done: boolean,
): VisualEntity[] {
    return probabilities.map((probability, index) => {
        let state: EntityState = "idle";
        if (done || index < current) state = "sorted";
        else if (index === current) state = "comparing";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: probability === null ? `k=${index}` : `${index}: ${probability.toFixed(4)}`,
            value: probability ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, k: index },
        };
    });
}

/** The hypergeometric PMF generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { N?: number; K?: number; n?: number } | null) ?? {};
    const N = typeof task.N === "number" ? Math.max(1, Math.floor(task.N)) : 12;
    const K = typeof task.K === "number" ? Math.max(0, Math.min(N, Math.floor(task.K))) : 5;
    const n = typeof task.n === "number" ? Math.max(0, Math.min(N, Math.floor(task.n))) : 4;
    const mean = (n * K) / N;
    const variance = N > 1 ? (n * (K / N) * (1 - K / N) * (N - n)) / (N - 1) : 0;
    const unknown = new Array<number | null>(n + 1).fill(null);

    yield {
        stepNumber: 0,
        entities: makeBars(unknown, -1, false),
        edges: [],
        description: `Drawing ${n} items without replacement from ${N} items with ${K} successes.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { N, K, n, sum: 0, mean, variance, pmf: [] },
    };

    let step = 1;
    const probabilities: number[] = [];
    for (let k = 0; k <= n; k += 1) {
        const value = hypergeometricPmf(N, K, n, k);
        probabilities.push(value);
        const display = [...probabilities, ...new Array<number | null>(n - k).fill(null)];
        yield {
            stepNumber: step++,
            entities: makeBars(display, k, false),
            edges: [],
            description: `P(X = ${k}) = C(${K}, ${k}) * C(${N - K}, ${n - k}) / C(${N}, ${n}) = ${value.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                N,
                K,
                n,
                sum: probabilities.reduce((a, b) => a + b, 0),
                mean,
                variance,
                pmf: [...probabilities],
            },
        };
    }

    const sum = probabilities.reduce((a, b) => a + b, 0);
    yield {
        stepNumber: step,
        entities: makeBars(probabilities, n, true),
        edges: [],
        description: `Distribution complete: ${n + 1} outcomes, total probability ${sum.toFixed(6)}, mean ${mean.toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { N, K, n, sum, mean, variance, pmf: [...probabilities] },
    };
}

/** The hypergeometric distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "When you draw without replacement, every draw changes the odds of the next one. The number of successes therefore follows a hypergeometric law: choose which k of the K successes and which n-k of the failures end up in your sample, then divide by the number of ways to choose any n items. It is the finite-population cousin of the binomial distribution.",
        invariants: [
            "The support runs from max(0, n - (N - K)) to min(n, K).",
            "Every probability lies between zero and one.",
            "The probabilities over all k from zero to n sum to one.",
        ],
        correctness:
            "There are C(N, n) equally likely samples. A sample with exactly k successes is formed by choosing k of the K success items and n-k of the N-K failure items, giving C(K, k) times C(N-K, n-k) samples. Dividing by C(N, n) gives the probability, and Vandermonde's identity makes the sum over k equal one. The stated mean and variance follow from the indicator representation of the draws.",
        complexityRationale:
            "Each coefficient is built with a short multiplicative loop, so computing one probability is constant for the fixed ranges used; producing all n+1 entries takes O(n) time and O(n) space.",
        uses: [
            "Quality-control sampling from a finite batch",
            "Fisher's exact test for contingency tables",
            "Election audits and capture-recapture population estimation",
        ],
        references: [
            "Haldane, The Logic of Exact Tests, Biometrika, 1939",
            "Ross, Introduction to Probability Models, Chapter 3",
        ],
        workedExample:
            "From a lot of 12 items with 5 defective, drawing 4 without replacement gives P(2 defective) = C(5,2)*C(7,2)/C(12,4) = 10*21/495 = 0.4242. The mean is 4*5/12 = 1.667.",
    },
    id: "hypergeometric-distribution",
    name: "Hypergeometric Distribution",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { N: 12, K: 5, n: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "compute the total number of samples C of N choose n",
        "for each success count k from zero to n",
        "choose k successes from the K available",
        "choose n minus k failures from the remaining N minus K",
        "divide the product of choices by the total number of samples",
        "store the probability for k and accumulate the total",
        "accumulate the mean and variance of the distribution",
        "done: report the full probability mass function",
    ],
};

export default module;
