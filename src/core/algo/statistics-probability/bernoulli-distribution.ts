/**
 * bernoulli-distribution.ts - Bernoulli Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Bernoulli trial is a single yes-or-no experiment that succeeds with
 * probability p. The random variable X is 1 on success and 0 on failure, so
 * its probability mass function is P(X = 1) = p and P(X = 0) = 1 - p. This
 * module builds the two outcome probabilities, their cumulative values, the
 * mean and variance, the moment generating function at a chosen point, and
 * the Shannon entropy in bits. It is the building block of the binomial and
 * geometric distributions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for every quantity
 *   Space: O(1) for the two outcomes and the summary statistics
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two bars show the probabilities of the outcomes zero and one.
 *   - The bar being computed is yellow; the finished distribution is green.
 *   - The metadata carries the cumulative values and all summary statistics.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BernoulliInput {
    p?: number;
    t?: number;
}

/** Build the two outcome bars. */
function makeBars(probabilities: Array<number | null>, current: number, done: boolean): VisualEntity[] {
    return probabilities.map((probability, index) => {
        let state: EntityState = "idle";
        if (done || index < current) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
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
            metadata: { index, outcome: index },
        };
    });
}

/** Shannon entropy in bits, using the convention 0 log 0 = 0. */
function entropyBits(p: number): number {
    let nats = 0;
    if (p > 0) {
        nats -= p * Math.log(p);
    }
    const q = 1 - p;
    if (q > 0) {
        nats -= q * Math.log(q);
    }
    return nats / Math.LN2;
}

/** The Bernoulli distribution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BernoulliInput | null) ?? {};
    const p = typeof task.p === "number" && Number.isFinite(task.p) ? Math.min(1, Math.max(0, task.p)) : 0.5;
    const t = typeof task.t === "number" && Number.isFinite(task.t) ? task.t : 1;
    const q = 1 - p;
    const mean = p;
    const variance = p * q;
    const mgf = q + p * Math.exp(t);
    const entropy = entropyBits(p);
    const stats = {
        p,
        t,
        mean,
        variance,
        mgf,
        entropy,
        cdf0: q,
        cdf1: 1,
    };

    yield {
        stepNumber: 0,
        entities: makeBars([null, null], -1, false),
        edges: [],
        description: `A Bernoulli trial succeeds with probability ${p.toFixed(4)}; computing the two outcome probabilities.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...stats, pmf: [] },
    };

    yield {
        stepNumber: 1,
        entities: makeBars([q, null], 0, false),
        edges: [],
        description: `P(X = 0) = 1 - p = ${q.toFixed(4)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...stats, pmf: [q] },
    };

    yield {
        stepNumber: 2,
        entities: makeBars([q, p], 1, false),
        edges: [],
        description: `P(X = 1) = p = ${p.toFixed(4)}; the two probabilities sum to ${(q + p).toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...stats, pmf: [q, p] },
    };

    yield {
        stepNumber: 3,
        entities: makeBars([q, p], 1, false),
        edges: [],
        description: `Cumulative probabilities are F(0) = ${q.toFixed(4)} and F(1) = 1.0000.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...stats, pmf: [q, p] },
    };

    yield {
        stepNumber: 4,
        entities: makeBars([q, p], 1, true),
        edges: [],
        description: `Mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}, MGF(${t.toFixed(2)}) ${mgf.toFixed(4)}, entropy ${entropy.toFixed(4)} bits.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...stats, pmf: [q, p] },
    };
}

/** The Bernoulli distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A Bernoulli trial is the smallest random experiment: exactly two outcomes, called failure and success. All of its behavior is captured by one number p, the chance of success. Everything else, including the average, the spread, and the entropy, follows from writing down the two probabilities p and one minus p.",
        invariants: [
            "The two probabilities one minus p and p always add to one.",
            "The random variable takes only the values zero and one.",
            "The cumulative probability at the largest outcome is exactly one.",
        ],
        correctness:
            "By definition the success probability is p and the failure probability is one minus p. The mean is the probability-weighted sum zero times one minus p plus one times p, which is p. The second moment is p, so the variance is p minus p squared, which is p times one minus p. The moment generating function is the weighted sum of exp of t times the outcome, giving one minus p plus p exp of t. The entropy formula follows directly from the definition of Shannon entropy on a two-point distribution, with the term for a zero probability taken as zero by continuity.",
        complexityRationale:
            "Every quantity is a closed-form expression in p and t, so each frame costs constant time and the module stores only a handful of scalars, giving constant time and space.",
        uses: [
            "Modeling a single success or failure such as a coin flip",
            "The building block of the binomial, geometric, and negative binomial distributions",
            "Binary outcomes in logistic regression and classification",
        ],
        references: [
            "Ross, Introduction to Probability Models, Chapter 1",
            "Cover and Thomas, Elements of Information Theory, Chapter 2",
        ],
        workedExample:
            "For a fair coin p is 0.5, so P(X=0) and P(X=1) are both 0.5, the mean is 0.5, the variance is 0.25, and the entropy is one bit. For p equal to one the distribution is certain, the variance and entropy are zero, and P(X=1) is one.",
    },
    id: "bernoulli-distribution",
    name: "Bernoulli Distribution",
    category: "statistics-probability",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { p: 0.5, t: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "read the success probability p and clamp it to zero through one",
        "set P(X = 0) to one minus p",
        "set P(X = 1) to p",
        "form the cumulative values F(0) and F(1)",
        "compute the mean p and the variance p times one minus p",
        "compute the moment generating function and the entropy",
        "done: report the two probabilities and the summary statistics",
    ],
};

export default module;
