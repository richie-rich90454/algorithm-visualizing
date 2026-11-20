/**
 * expectation-and-variance.ts - Expectation and Variance of a Discrete Variable
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * For a discrete random variable with outcomes x_i and probabilities p_i, the
 * expectation is the probability-weighted average E[X] = sum(x_i * p_i). The
 * variance is the expected squared deviation Var(X) = sum((x_i - E[X])^2 * p_i),
 * which is computed with the shortcut E[X^2] - E[X]^2 to avoid a second pass.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n outcomes
 *   Space: O(n) for the accumulated moments and the bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per outcome, its height encoding the probability.
 *   - The outcome being accumulated is yellow; completed ones are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build one bar per outcome. */
function makeBars(
    values: number[],
    probabilities: number[],
    current: number,
    done: boolean,
): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (done || index < current) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        const p = probabilities[index] ?? 0;
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `x=${value}, p=${p.toFixed(3)}`,
            value: p,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, outcome: value },
        };
    });
}

/** Compute the expectation and variance of a discrete distribution. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; probabilities?: number[] } | null) ?? {};
    const values = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map(Number)
        : [1, 2, 3, 4, 5, 6];
    let probabilities = Array.isArray(task.probabilities) ? task.probabilities.map(Number) : [];
    if (probabilities.length !== values.length) {
        probabilities = values.map(() => 1 / values.length);
    }
    const rawTotal = probabilities.reduce((a, b) => a + b, 0);
    if (rawTotal <= 0) {
        probabilities = values.map(() => 1 / values.length);
    } else if (Math.abs(rawTotal - 1) > 1e-9) {
        probabilities = probabilities.map((p) => p / rawTotal);
    }

    let mean = 0;
    let secondMoment = 0;
    yield {
        stepNumber: 0,
        entities: makeBars(values, probabilities, -1, false),
        edges: [],
        description: `Accumulating the expectation and variance over ${values.length} outcome(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { mean: 0, variance: 0, secondMoment: 0, probSum: 1, values, probabilities },
    };
    let step = 1;

    for (let i = 0; i < values.length; i += 1) {
        const x = values[i] as number;
        const p = probabilities[i] as number;
        mean += x * p;
        secondMoment += x * x * p;
        yield {
            stepNumber: step,
            entities: makeBars(values, probabilities, i, false),
            edges: [],
            description: `Outcome ${x} with probability ${p.toFixed(4)}: partial mean ${(mean).toFixed(4)}, partial second moment ${secondMoment.toFixed(4)}.`,
            codeLineNumber: i === 0 ? 1 : i === 1 ? 2 : 3,
            layout: "array",
            meta: {
                mean,
                variance: secondMoment - mean * mean,
                secondMoment,
                probSum: probabilities.reduce((a, b) => a + b, 0),
                values,
                probabilities,
            },
        };
        step += 1;
    }

    const variance = Math.max(0, secondMoment - mean * mean);
    yield {
        stepNumber: step,
        entities: makeBars(values, probabilities, values.length, true),
        edges: [],
        description: `Expectation ${mean.toFixed(4)}, variance ${variance.toFixed(4)}, standard deviation ${Math.sqrt(variance).toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { mean, variance, secondMoment, probSum: 1, values, probabilities },
    };
}

/** The expectation and variance module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The expectation is the long-run average outcome if you sampled the distribution many times, so each outcome contributes its value times its probability. The variance measures the average squared distance from that average. Computing the average of the squares first and then subtracting the square of the average gives the same answer with one pass.",
        invariants: [
            "The probabilities sum to one after normalization.",
            "After each outcome the running mean equals the weighted average of the outcomes processed so far.",
            "The variance is the second moment minus the square of the mean.",
        ],
        correctness:
            "By definition E[X] is the sum of x times p over all outcomes, and Var(X) is the sum of (x - E[X]) squared times p. Expanding the squared term gives E[X^2] - 2 E[X] E[X] + E[X]^2, which simplifies to E[X^2] - E[X]^2 because the probabilities sum to one. The running accumulation computes exactly these two sums, so the final difference is the variance.",
        complexityRationale:
            "Each of the n outcomes adds two products in constant time, giving O(n) time. Only the running moments and the probability array are kept, so space is O(n).",
        uses: [
            "Summarizing the center and spread of a discrete distribution",
            "Computing the mean and risk of a discrete payoff in finance",
            "Providing the moments needed by the central limit theorem and Chebyshev bounds",
        ],
        references: [
            "Grimmett and Stirzaker, Probability and Random Processes, Chapter 3",
            "Ross, A First Course in Probability, Chapter 4",
        ],
        workedExample:
            "For a fair die, the mean is (1 plus 2 plus 3 plus 4 plus 5 plus 6) over six, which is 3.5. The second moment is (1 plus 4 plus 9 plus 16 plus 25 plus 36) over six, about 15.1667. The variance is 15.1667 minus 3.5 squared, about 2.9167.",
    },
    id: "expectation-and-variance",
    name: "Expectation and Variance",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        values: [1, 2, 3, 4, 5, 6],
        probabilities: [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the mean and second moment to zero",
        "for each outcome x with probability p",
        "add x times p to the mean",
        "add x squared times p to the second moment",
        "set the variance to the second moment minus the mean squared",
        "done: report the mean, variance, and standard deviation",
    ],
};

export default module;
