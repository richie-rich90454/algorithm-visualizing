/**
 * kurtosis.ts - Sample Excess Kurtosis
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Kurtosis measures the heaviness of a distribution's tails relative to a
 * normal distribution. The module finds the mean, accumulates the second and
 * fourth central moments, and reports the excess kurtosis m4 / m2^2 - 3.
 * Positive excess means heavier tails; negative excess means lighter tails.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for two passes over the sample
 *   Space: O(n) for the displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each sample value is a bar.
 *   - The bar whose deviation is being accumulated is highlighted.
 *   - The final frame is green and reports excess kurtosis.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], current = -1, done = false): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        } else if (index < current) {
            state = "visited";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: String(value),
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

/** Compute excess kurtosis with a frame per accumulated value. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values =
        Array.isArray(task.values) && task.values.length > 0
            ? task.values.map(Number)
            : [2, 3, 3, 4, 4, 4, 5, 5, 6, 10];
    const n = values.length;
    const mean = values.reduce((sum, value) => sum + value, 0) / n;
    let sum2 = 0;
    let sum4 = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(values, -1, false),
        edges: [],
        description: `Computing excess kurtosis for ${n} value(s) with mean ${mean.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, mean, m2: 0, m4: 0, excess: 0 },
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        const deviation = values[i] - mean;
        const squared = deviation * deviation;
        sum2 += squared;
        sum4 += squared * squared;
        yield {
            stepNumber: step,
            entities: makeBars(values, i, false),
            edges: [],
            description: `Value ${i} = ${values[i]}: squared deviation ${squared.toFixed(4)}, fourth-power sum ${sum4.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, mean, m2: sum2 / n, m4: sum4 / n, excess: 0 },
        };
        step += 1;
    }

    const m2 = sum2 / n;
    const m4 = sum4 / n;
    const excess = m2 === 0 ? 0 : m4 / (m2 * m2) - 3;
    yield {
        stepNumber: step,
        entities: makeBars(values, -1, true),
        edges: [],
        description: `Excess kurtosis = ${excess.toFixed(6)} (tails are ${excess >= 0 ? "heavier" : "lighter"} than normal).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, mean, m2, m4, excess },
    };
}

/** The kurtosis module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Kurtosis looks at how often a distribution produces extreme values. It raises each deviation from the mean to the fourth power, which makes rare large deviations count heavily, then divides by the squared variance so the scale of the data no longer matters. Subtracting three makes a normal distribution score zero.",
        invariants: [
            "The fourth central moment m4 is always nonnegative.",
            "Because the fourth power discards the sign, kurtosis ignores tail direction and measures tail weight only.",
            "The ratio m4 / m2^2 is unchanged if the sample is shifted or scaled.",
        ],
        correctness:
            "Computing the mean first centers every deviation. Dividing the fourth-power sum by n gives m4 and dividing the squared sum by n gives m2, so m4 / m2^2 is the standardized fourth central moment. A normal distribution has that ratio equal to three, so subtracting three gives excess kurtosis with zero as the reference point.",
        complexityRationale:
            "A pass for the mean and a pass for the two moment sums take O(n) time. Only constant-size accumulators are required beyond the O(n) bars shown in the visualization.",
        uses: [
            "Assessing tail risk in financial returns",
            "Checking whether residuals have outliers beyond normality",
            "Choosing between heavy-tailed and light-tailed models",
        ],
        references: [
            "Pearson, Skewness and Kurtosis, 1905",
            "Wackerly, Mendenhall, and Scheaffer, Mathematical Statistics with Applications, Chapter 3",
        ],
        workedExample:
            "For the sample 2, 3, 3, 4, 4, 4, 5, 5, 6, 10 the value 10 lies far from the mean of 4.6. Its fourth-power deviation dominates m4, giving an excess kurtosis near 2.0, so this small sample has noticeably heavier tails than a normal curve.",
    },
    id: "kurtosis",
    name: "Kurtosis",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [2, 3, 3, 4, 4, 4, 5, 5, 6, 10] },
    visualType: "array",
    run,
    pseudocode: [
        "read the sample values and count n",
        "compute the arithmetic mean of the values",
        "set the second and fourth central-moment sums to zero",
        "for each value add the squared and fourth-power deviations",
        "divide both sums by n to obtain m2 and m4",
        "set excess kurtosis equal to m4 over m2 squared minus three",
        "done: report the excess kurtosis coefficient",
    ],
};

export default module;
