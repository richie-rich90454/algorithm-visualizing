/**
 * beta-binomial.ts - Beta-Binomial Probability Mass Function
 *
 * The beta-binomial distribution is the number of successes in n trials when
 * the success probability itself is drawn from a Beta(a, b) distribution. It
 * is the compound of a binomial with a beta prior, so it is overdispersed
 * relative to the ordinary binomial. This module evaluates the closed-form
 * mass function with log-gamma arithmetic and reveals it one count at a time.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const LANCZOS = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953,
];

/** Log-gamma via the Lanczos approximation (positive arguments). */
function logGamma(z: number): number {
    let y = z;
    let t = z + 5.5;
    t -= (z + 0.5) * Math.log(t);
    let ser = 1.000000000190015;
    for (const c of LANCZOS) {
        y += 1;
        ser += c / y;
    }
    return -t + Math.log((2.5066282746310005 * ser) / z);
}

/** log C(n, k) using log factorials. */
function logChoose(n: number, k: number): number {
    return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

/** P(X = k) for X ~ BetaBinomial(n, a, b). */
function pmf(k: number, n: number, a: number, b: number): number {
    const logP = logChoose(n, k) + logGamma(k + a) + logGamma(n - k + b)
        - logGamma(a) - logGamma(b) + logGamma(a + b) - logGamma(n + a + b);
    return Math.exp(logP);
}

function makeBars(pmfValues: number[], active: number, done: boolean): VisualEntity[] {
    return pmfValues.map((p, k) => {
        let state: EntityState = "idle";
        if (done) state = "sorted";
        else if (k === active) state = "comparing";
        else if (k < active) state = "visited";
        return {
            id: `bar-${k}`,
            type: "bar" as const,
            label: p.toFixed(5),
            value: p,
            state,
            x: k,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: k, probability: p },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; a?: number; b?: number } | null) ?? {};
    const n = Math.min(60, Math.max(1, Math.floor(Number(task.n ?? 10)) || 10));
    const a = Math.max(0.1, Number(task.a ?? 2));
    const b = Math.max(0.1, Number(task.b ?? 3));
    const values = Array.from({ length: n + 1 }, (_, k) => pmf(k, n, a, b));
    const mean = (n * a) / (a + b);
    const variance = (n * a * b * (a + b + n)) / ((a + b) ** 2 * (a + b + 1));
    const total = values.reduce((sum, p) => sum + p, 0);

    yield {
        stepNumber: 0,
        entities: makeBars(values.map(() => 0), -1, false),
        edges: [],
        description: `Beta-binomial with n = ${n}, a = ${a}, b = ${b}; evaluating the mass at each success count.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, a, b, mean, variance, total, pmf: values.map(() => 0) },
    };

    let step = 1;
    for (let k = 0; k <= n; k += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(values, k, false),
            edges: [],
            description: `P(X = ${k}) = C(n,k) B(k+a, n-k+b) / B(a,b) = ${values[k]!.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, a, b, mean, variance, total, pmf: values.slice(0, k + 1) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(values, -1, true),
        edges: [],
        description: `The ${n + 1} masses sum to ${total.toFixed(9)}; mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, a, b, mean, variance, total, pmf: [...values], done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A binomial count assumes one fixed success probability. The beta-binomial instead draws that probability once from a Beta(a, b) prior and then runs the n trials. Averaging the binomial mass over that prior gives heavier tails than a plain binomial, which is why it fits overdispersed count data.",
        invariants: [
            "All masses are nonnegative and sum to one over k = 0 through n.",
            "The mean is n a over a plus b.",
            "Setting a and b large with a fixed ratio recovers a binomial with that success probability.",
        ],
        correctness:
            "The beta-binomial mass equals C(n,k) times the ratio B(k+a, n-k+b) over B(a,b). Rewriting every beta function as a quotient of gamma functions and evaluating the logs with Lanczos log-gamma avoids overflow for large n. Summing the masses is Vandermonde's identity for beta integrals, and the mean and variance follow from the law of total expectation and total variance applied to the beta-distributed success probability.",
        complexityRationale:
            "Each of the n plus one masses needs a constant number of log-gamma evaluations, giving O(n) time; the displayed bars use O(n) space.",
        uses: [
            "Modeling overdispersed proportions in A/B testing",
            "Species abundance and ecological count modeling",
            "Bayesian predictive checks for binomial data",
        ],
        references: [
            "Johnson, Kotz and Balakrishnan, Discrete Multivariate Distributions",
            "Lee and Sabavala, Bayesian Inference for Bernoulli Processes, 1987",
        ],
        workedExample:
            "With n = 10, a = 2 and b = 3 the prior mean success rate is 0.4, so the count has mean 4. The probability of exactly four successes is about 0.175, slightly more spread out than a Binomial(10, 0.4) which assigns about 0.251 to the same count but has a smaller variance.",
    },
    id: "beta-binomial",
    name: "Beta-Binomial Distribution",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { n: 10, a: 2, b: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "read the trial count n and beta shapes a, b",
        "build log-gamma via the Lanczos approximation",
        "for each success count k from 0 to n",
        "compute log C(n,k) plus log B(k+a, n-k+b) minus log B(a,b)",
        "exponentiate to obtain the probability mass",
        "accumulate the closed-form mean and variance",
        "done: report the full mass function",
    ],
};

export default module;
