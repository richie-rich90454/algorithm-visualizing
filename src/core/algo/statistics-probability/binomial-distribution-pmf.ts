/**
 * binomial-distribution-pmf.ts - Binomial Probability Mass Function
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The binomial distribution counts the number of successes in n independent
 * yes-or-no trials that each succeed with probability p. Its probability mass
 * function is the binomial coefficient C(n, k) times p to the k times (1 - p)
 * to the (n - k). The coefficients are computed multiplicatively so no
 * factorial table is needed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) to compute every coefficient and probability
 *   Space: O(n) for the array of n + 1 probabilities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per possible success count k, from zero through n.
 *   - The bar being computed is yellow; the finished distribution is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build one bar per success count. */
function makeBars(
    probabilities: Array<number | null>,
    current: number,
    done: boolean,
): VisualEntity[] {
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
            metadata: { index, k: index },
        };
    });
}

/** The binomial PMF generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; p?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(0, Math.floor(task.n)) : 10;
    const p = typeof task.p === "number" ? Math.min(1, Math.max(0, task.p)) : 0.5;
    const unknown = new Array<number | null>(n + 1).fill(null);

    yield {
        stepNumber: 0,
        entities: makeBars(unknown, -1, false),
        edges: [],
        description: `Computing the binomial distribution for ${n} trials with success probability ${p}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, p, sum: 0, mean: n * p, variance: n * p * (1 - p), pmf: [] },
    };
    let step = 1;

    const probabilities: number[] = [];
    let coefficient = 1;
    let coefficientIndex = 0;
    for (let k = 0; k <= n; k += 1) {
        while (coefficientIndex < k) {
            coefficient = (coefficient * (n - coefficientIndex)) / (coefficientIndex + 1);
            coefficientIndex += 1;
        }
        const value = coefficient * p ** k * (1 - p) ** (n - k);
        probabilities.push(value);
        const display = [...probabilities, ...new Array<number | null>(n - k).fill(null)];
        yield {
            stepNumber: step,
            entities: makeBars(display, k, false),
            edges: [],
            description: `P(X = ${k}) = C(${n}, ${k}) * ${p.toFixed(3)}^${k} * ${(1 - p).toFixed(3)}^${n - k} = ${value.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, p, sum: probabilities.reduce((a, b) => a + b, 0), mean: n * p, variance: n * p * (1 - p), pmf: [...probabilities] },
        };
        step += 1;
    }

    const sum = probabilities.reduce((a, b) => a + b, 0);
    yield {
        stepNumber: step,
        entities: makeBars(probabilities, n, true),
        edges: [],
        description: `Distribution complete: ${n + 1} outcomes, total probability ${sum.toFixed(6)}, mean ${(n * p).toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, p, sum, mean: n * p, variance: n * p * (1 - p), pmf: [...probabilities] },
    };
}

/** The binomial distribution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Each outcome with exactly k successes has probability p to the k times (1 - p) to the (n - k). There are C(n, k) ways to choose which trials succeed, so multiply those two quantities. Computing the coefficients one step at a time avoids large factorials.",
        invariants: [
            "The coefficient for k is obtained from the one for k - 1 by multiplying by (n - k + 1) / k.",
            "Every probability lies between zero and one.",
            "The probabilities over all k from zero to n sum to one.",
        ],
        correctness:
            "The n trials are independent, so the probability of any particular sequence with k successes is p to the k times (1 - p) to the (n - k). There are C(n, k) such sequences, and the binomial theorem states that the sum of C(n, k) p to the k times (1 - p) to the (n - k) over all k equals (p plus 1 - p) to the n, which is one.",
        complexityRationale:
            "Updating the coefficient and evaluating a power at each k takes constant amortized work, so building all n + 1 entries costs O(n) time and O(n) space.",
        uses: [
            "Modeling the number of successes in repeated trials",
            "Quality control and defect counting",
            "Null distributions for binomial hypothesis tests",
        ],
        references: [
            "De Moivre, The Doctrine of Chances, 1718",
            "Ross, Introduction to Probability Models, Chapter 3",
        ],
        workedExample:
            "For four fair coin flips, the probabilities for zero through four heads are 1/16, 4/16, 6/16, 4/16, and 1/16. They add to 16/16 and the average is 4 times 1/2 = 2 heads.",
    },
    id: "binomial-distribution-pmf",
    name: "Binomial Distribution PMF",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { n: 10, p: 0.5 },
    visualType: "array",
    run,
    pseudocode: [
        "set the coefficient for zero successes to one",
        "for each success count k from zero to n",
        "update the coefficient from the previous value",
        "multiply by p to the k and by one minus p to the n minus k",
        "store the result as the probability for k",
        "accumulate the total and the mean",
        "done: report the full probability mass function",
    ],
};

export default module;
