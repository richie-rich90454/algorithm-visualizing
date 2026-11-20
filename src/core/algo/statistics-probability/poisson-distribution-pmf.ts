/**
 * poisson-distribution-pmf.ts - Poisson Probability Mass Function
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Poisson distribution models the number of independent events that occur
 * in a fixed interval when events arrive at a constant average rate lambda.
 * Its probability mass function is P(X = k) = e^(-lambda) * lambda^k / k!.
 * The probabilities are built multiplicatively from P(X = 0) so no factorial
 * table is needed: P(X = k) = P(X = k-1) * lambda / k.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) to build every probability up to maxK
 *   Space: O(k) for the array of probabilities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per outcome k, from zero through maxK.
 *   - The bar being computed is yellow; the finished distribution is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build one bar per possible outcome count. */
function makeBars(values: Array<number | null>, current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (done || index < current) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value === null ? `k=${index}` : `${index}: ${value.toFixed(4)}`,
            value: value ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, k: index },
        };
    });
}

/** The Poisson PMF generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { lambda?: number; maxK?: number } | null) ?? {};
    const lambda = typeof task.lambda === "number" ? Math.max(0, task.lambda) : 4;
    const maxK = typeof task.maxK === "number" ? Math.max(0, Math.floor(task.maxK)) : 10;
    const unknown = new Array<number | null>(maxK + 1).fill(null);

    yield {
        stepNumber: 0,
        entities: makeBars(unknown, -1, false),
        edges: [],
        description: `Computing Poisson probabilities for lambda ${lambda} over k = 0 to ${maxK}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lambda, maxK, sum: 0, mean: lambda, variance: lambda, pmf: [] },
    };
    let step = 1;

    const probabilities: number[] = [];
    let value = Math.exp(-lambda);
    for (let k = 0; k <= maxK; k += 1) {
        if (k > 0) {
            value = (value * lambda) / k;
        }
        probabilities.push(value);
        const display = [...probabilities, ...new Array<number | null>(maxK - k).fill(null)];
        yield {
            stepNumber: step,
            entities: makeBars(display, k, false),
            edges: [],
            description: `P(X = ${k}) = ${value.toFixed(6)}; running total ${probabilities.reduce((a, b) => a + b, 0).toFixed(6)}.`,
            codeLineNumber: k === 0 ? 1 : 3,
            layout: "array",
            meta: {
                lambda,
                maxK,
                sum: probabilities.reduce((a, b) => a + b, 0),
                mean: lambda,
                variance: lambda,
                pmf: [...probabilities],
            },
        };
        step += 1;
    }

    const sum = probabilities.reduce((a, b) => a + b, 0);
    yield {
        stepNumber: step,
        entities: makeBars(probabilities, maxK, true),
        edges: [],
        description: `Distribution complete: ${maxK + 1} outcomes, probability mass ${sum.toFixed(6)}, mean and variance both ${lambda}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { lambda, maxK, sum, mean: lambda, variance: lambda, pmf: [...probabilities] },
    };
}

/** The Poisson distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "When events occur independently at a steady average rate, the count in one interval follows a Poisson distribution. Start with the probability of zero events, then get each next probability by multiplying the previous one by lambda divided by k. Each step reuses the last result instead of recomputing a factorial.",
        invariants: [
            "Each probability satisfies P(X = k) = P(X = k-1) times lambda divided by k.",
            "Every probability is nonnegative and at most one.",
            "The mean and the variance of the distribution both equal lambda.",
        ],
        correctness:
            "The Poisson mass function arises as the limit of a binomial distribution with n trials and success probability lambda over n. Substituting and taking n to infinity gives e to the minus lambda times lambda to the k over k factorial. The recurrence follows by dividing the formula for k by the formula for k minus one, so the multiplicative construction produces exactly the same values.",
        complexityRationale:
            "Each outcome needs one multiplication and one division, so building all probabilities through maxK takes O(maxK) time. Storing one bar and one value per outcome uses O(maxK) space.",
        uses: [
            "Modeling arrivals such as calls to a help desk or packets at a router",
            "Counting defects per unit in quality control",
            "Serving as the null model in count-data statistical tests",
        ],
        references: [
            "Poisson, Recherches sur la probabilite des jugements, 1837",
            "Ross, Introduction to Probability Models, Chapter 3",
        ],
        workedExample:
            "With lambda two, P(X = 0) is e to the minus two, about 0.1353. Then P(X = 1) is 0.1353 times two, about 0.2707, and P(X = 2) is 0.2707 times two over two, again 0.2707. The mean and variance are both two.",
    },
    id: "poisson-distribution-pmf",
    name: "Poisson Distribution PMF",
    category: "statistics-probability",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { lambda: 4, maxK: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "set probability for zero to exp of negative lambda",
        "for each outcome k from one to maxK",
        "multiply the previous probability by lambda over k",
        "store the result as the probability for k",
        "accumulate the total probability mass",
        "done: report the full distribution, mean, and variance",
    ],
};

export default module;
