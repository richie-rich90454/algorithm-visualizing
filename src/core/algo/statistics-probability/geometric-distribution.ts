/**
 * geometric-distribution.ts - Geometric Distribution PMF and CDF
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The geometric distribution models repeated independent Bernoulli trials
 * until the first success. In the trial-count form its support is 1, 2, 3, ...
 * and P(K = k) = (1-p)^(k-1) p. In the failure-count form the support starts
 * at zero and P(K = k) = (1-p)^k p. This module builds the probability mass
 * function one value at a time, accumulates the distribution function, and
 * reports the exact mean and variance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(K) for K terms of the distribution
 *   Space: O(K) for the probability arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per support value shows its probability mass.
 *   - The newest bar is highlighted as the PMF is built.
 *   - Frame metadata carries the PMF, the CDF, and the theoretical moments.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Support = "trials" | "failures";

function makeBars(pmf: number[], highlight: number, state: EntityState, shift: number): VisualEntity[] {
    return pmf.map((probability, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `k=${index + shift} p=${probability.toFixed(4)}`,
        value: probability,
        state: index === highlight ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { k: index + shift, probability },
    }));
}

/** The geometric distribution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { p?: number; kMax?: number; support?: Support } | null) ?? {};
    const p = typeof task.p === "number" && task.p > 0 && task.p <= 1 ? Math.min(1, task.p) : 0.3;
    const support: Support = task.support === "failures" ? "failures" : "trials";
    const shift = support === "trials" ? 1 : 0;
    const kMax = Math.max(1, Math.min(60, Math.floor(task.kMax ?? 12)));
    const q = 1 - p;
    const mean = (support === "trials" ? 1 : q) / p;
    const variance = q / (p * p);

    const pmf: number[] = [];
    const cdf: number[] = [];
    let step = 0;

    const emit = (description: string, codeLine: number, highlight: number, state: EntityState, extra: object = {}) => {
        const frame: VisualFrame = {
            stepNumber: step,
            entities: makeBars(pmf, highlight, state, shift),
            edges: [],
            description,
            codeLineNumber: codeLine,
            layout: "array",
            meta: {
                p,
                support,
                shift,
                pmf: [...pmf],
                cdf: [...cdf],
                mean,
                variance,
                ...extra,
            },
        };
        step += 1;
        return frame;
    };

    yield emit(`Building the geometric distribution with success probability ${p} (${support} form).`, 0, -1, "idle");

    for (let k = 0; k < kMax; k += 1) {
        const probability = q ** k * p;
        pmf.push(probability);
        cdf.push((cdf[k - 1] ?? 0) + probability);
        yield emit(
            `P(K = ${k + shift}) = (1 - p)^${k} * p = ${probability.toFixed(6)}; cumulative probability ${(cdf[k] ?? 0).toFixed(6)}.`,
            2,
            k,
            "comparing",
            { k: k + shift },
        );
    }

    yield emit(
        `Distribution complete: mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}.`,
        4,
        -1,
        "sorted",
        { done: true, mass: cdf[kMax - 1] ?? 0 },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Repeatedly flip a biased coin until heads appears. The geometric distribution describes how many flips that takes. Each extra failure multiplies the probability by the failure chance, so the probabilities form a decaying sequence. Depending on convention you count either the total number of trials, which starts at one, or the number of failures before success, which starts at zero.",
        invariants: [
            "P(K = k) equals (1-p) to the appropriate power times p.",
            "The CDF is the running sum of the PMF values.",
            "The PMF values form a geometric sequence with ratio 1-p.",
        ],
        correctness:
            "The event that the first success occurs at trial k requires k-1 independent failures followed by a success (in the trial-count form), whose probability is the product (1-p)^(k-1) p by independence. Summing this geometric series gives one, so it is a valid distribution. Differentiating the series gives the mean 1/p and the second moment, from which the variance (1-p)/p squared follows; the failure-count form simply subtracts one from the support and therefore shifts the mean by one.",
        complexityRationale:
            "Computing each term by multiplying the previous one by (1-p) is constant time, so K terms take O(K) time and O(K) space to store the PMF and CDF arrays.",
        uses: [
            "Modeling the number of attempts until the first success",
            "Queueing and reliability analysis of repeated trials",
            "The geometric distribution underlying the memoryless property",
        ],
        references: [
            "Ross, Introduction to Probability Models, Chapter 2",
            "Grimmett and Stirzaker, Probability and Random Processes, Chapter 3",
        ],
        workedExample:
            "With success probability p = 0.3 in the trials form, P(K = 1) = 0.3, P(K = 2) = 0.7 times 0.3 = 0.21, and P(K = 3) = 0.49 times 0.3 = 0.147. The mean number of trials is 1 over 0.3, about 3.33.",
    },
    id: "geometric-distribution",
    name: "Geometric Distribution",
    category: "statistics-probability",
    complexity: { time: "O(K)", space: "O(K)" },
    defaultInput: { p: 0.3, kMax: 12, support: "trials" },
    visualType: "array",
    run,
    pseudocode: [
        "read the success probability and the counting convention",
        "set q equal to one minus the success probability",
        "for k from zero to the requested maximum",
        "set P(K) equal to q to the k times p",
        "add that value to the running cumulative total",
        "report the theoretical mean and variance",
        "done: return the PMF and CDF arrays",
    ],
};

export default module;
