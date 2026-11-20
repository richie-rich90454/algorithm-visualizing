/**
 * anderson-darling-test.ts - Anderson-Darling Goodness-of-Fit Statistic
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Anderson-Darling test measures how far a sorted sample departs from a
 * fitted normal distribution. It standardizes each order statistic, weights
 * both tail probabilities by (2i-1), and accumulates a statistic that is more
 * sensitive to deviations in the tails than the Kolmogorov-Smirnov distance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for sorting plus O(n) for the statistic
 *   Space: O(n) for the sorted sample bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per sorted observation, highlighted while its tails are added.
 *   - The final frame reports the Anderson-Darling A squared statistic.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function erf(x: number): number {
    const sign = x >= 0 ? 1 : -1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const poly =
        ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
            0.254829592) *
        t;
    return sign * (1 - poly * Math.exp(-ax * ax));
}

function normalCdf(z: number): number {
    return 0.5 * (1 + erf(z / Math.SQRT2));
}

function safeLog(value: number): number {
    return Math.log(Math.min(1 - 1e-12, Math.max(1e-12, value)));
}

function makeBars(sample: number[], active: number, done: boolean): VisualEntity[] {
    return sample.map((value, index) => {
        let state: EntityState = done ? "sorted" : "idle";
        if (!done && index === active) {
            state = "active";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(2),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { sample?: number[] } | null) ?? {};
    const sample: number[] = Array.isArray(task.sample)
        ? task.sample.slice().sort((a, b) => a - b)
        : [0.7, -1.2, 0.3, 1.4, -0.5, 0.1, 2.1, -0.9];
    const n = sample.length;

    yield {
        stepNumber: 0,
        entities: makeBars(sample, -1, false),
        edges: [],
        description: `Anderson-Darling test on a sorted sample of size ${n}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, mean: 0, sd: 0, statistic: 0 },
    };
    let step = 1;

    if (n === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(sample, -1, true),
            edges: [],
            description: "Empty sample; Anderson-Darling statistic is zero.",
            codeLineNumber: 6,
            layout: "array",
            meta: { n, mean: 0, sd: 0, statistic: 0 },
        };
        return;
    }

    const mean = sample.reduce((sum, value) => sum + value, 0) / n;
    if (n === 1) {
        yield {
            stepNumber: step,
            entities: makeBars(sample, -1, true),
            edges: [],
            description: "A single observation cannot depart from a fitted normal.",
            codeLineNumber: 6,
            layout: "array",
            meta: { n, mean, sd: 0, statistic: 0 },
        };
        return;
    }

    let sumSquares = 0;
    for (const value of sample) {
        sumSquares += (value - mean) ** 2;
    }
    const sd = Math.sqrt(sumSquares / (n - 1));
    let weightedSum = 0;

    if (sd > 0) {
        for (let i = 0; i < n; i += 1) {
            const zLow = ((sample[i] ?? 0) - mean) / sd;
            const zHigh = ((sample[n - 1 - i] ?? 0) - mean) / sd;
            const low = normalCdf(zLow);
            const high = 1 - normalCdf(zHigh);
            weightedSum += (2 * (i + 1) - 1) * (safeLog(low) + safeLog(high));
            yield {
                stepNumber: step,
                entities: makeBars(sample, i, false),
                edges: [],
                description: `Order statistic ${i + 1}: z = ${zLow.toFixed(3)}, weighted tail sum is ${weightedSum.toFixed(4)}.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { n, mean, sd, statistic: 0, weightedSum },
            };
            step += 1;
        }
    }

    const statistic = sd > 0 ? Math.max(0, -n - weightedSum / n) : 0;
    yield {
        stepNumber: step,
        entities: makeBars(sample, -1, true),
        edges: [],
        description: `Anderson-Darling A squared = ${statistic.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, mean, sd, statistic, weightedSum },
    };
}

/** The Anderson-Darling module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Anderson-Darling compares the empirical distribution of a sample with a fitted normal curve, but pays special attention to the tails. Each sorted observation is converted to a normal score and both tail probabilities are weighted by how far out in the order the observation sits.",
        invariants: [
            "The sample is sorted before any order statistic is processed.",
            "The mean and standard deviation are fitted once from the whole sample.",
            "The weights two i minus one sum to n squared.",
        ],
        correctness:
            "Under a fitted normal model each standardized order statistic has expected tail probability matching its rank, so the weighted log sum is minimized when the sample match is close. The formula subtracts that sum from minus n, producing a nonnegative statistic that grows as the sample departs from normality, especially in the tails.",
        complexityRationale:
            "Sorting dominates at n log n, after which the mean, variance and weighted log sum each take one linear pass. The sorted bars are the only linear storage.",
        uses: [
            "Testing whether residuals follow a normal distribution",
            "Goodness-of-fit checks in reliability and finance",
            "Comparing candidate distributions with tail-sensitive criteria",
        ],
        references: [
            "Anderson and Darling, A Test of Goodness of Fit, 1954",
            "Stephens, Goodness of Fit for the Normal Distribution, 1974",
        ],
        workedExample:
            "For the sample 1, 2, 3, 4, 5 the fitted mean is 3 and the sample standard deviation is about 1.58. Standardizing the sorted values and summing the weighted log tails gives a weighted sum near negative 8, so minus five minus that sum divided by five is a small positive A squared, consistent with a near-normal pattern.",
    },
    id: "anderson-darling-test",
    name: "Anderson-Darling Test",
    category: "statistics-probability",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { sample: [0.7, -1.2, 0.3, 1.4, -0.5, 0.1, 2.1, -0.9] },
    visualType: "array",
    run,
    pseudocode: [
        "read the sample and sort it in ascending order",
        "compute the sample mean and standard deviation",
        "for each sorted value standardize it to a z score",
        "add (2 i minus 1) times the two normal log tail probabilities",
        "divide the accumulated sum by the sample size",
        "subtract the sample size to obtain A squared",
        "done: report the Anderson-Darling statistic",
    ],
};

export default module;
