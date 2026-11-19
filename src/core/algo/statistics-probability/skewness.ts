/**
 * skewness.ts - Sample Skewness (Fisher-Pearson)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Skewness measures the asymmetry of a distribution around its mean. The
 * module computes the mean, accumulates the second and third central moments
 * in a second pass, and reports the standardized third moment g1 together
 * with the sample-bias-corrected value G1. Positive values mean a long right
 * tail; negative values mean a long left tail; symmetric data give zero.
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
 *   - The final frame is green and reports skewness.
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

/** Compute Fisher-Pearson skewness with a frame per accumulated value. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values =
        Array.isArray(task.values) && task.values.length > 0
            ? task.values.map(Number)
            : [1, 2, 2, 3, 3, 4, 4, 5, 8];
    const n = values.length;
    const mean = values.reduce((sum, value) => sum + value, 0) / n;
    let sum2 = 0;
    let sum3 = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(values, -1, false),
        edges: [],
        description: `Computing Fisher-Pearson skewness for ${n} value(s) with mean ${mean.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, mean, m2: 0, m3: 0, g1: 0, g1Adjusted: 0 },
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        const deviation = values[i] - mean;
        const squared = deviation * deviation;
        sum2 += squared;
        sum3 += squared * deviation;
        yield {
            stepNumber: step,
            entities: makeBars(values, i, false),
            edges: [],
            description: `Value ${i} = ${values[i]}: deviation ${deviation.toFixed(4)}, accumulated second moment sum ${sum2.toFixed(4)}, third ${sum3.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, mean, m2: sum2 / n, m3: sum3 / n, g1: 0, g1Adjusted: 0 },
        };
        step += 1;
    }

    const m2 = sum2 / n;
    const m3 = sum3 / n;
    const g1 = m2 === 0 ? 0 : m3 / Math.pow(m2, 1.5);
    const g1Adjusted = n > 2 && m2 !== 0 ? (g1 * Math.sqrt(n * (n - 1))) / (n - 2) : 0;
    yield {
        stepNumber: step,
        entities: makeBars(values, -1, true),
        edges: [],
        description: `Skewness g1 = ${g1.toFixed(6)}, sample-adjusted G1 = ${g1Adjusted.toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { n, mean, m2, m3, g1, g1Adjusted },
    };
}

/** The skewness module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A distribution can lean to one side. Skewness compares the average cubed deviation from the mean with the cube of the typical deviation: because cubing keeps the sign, a longer tail on one side pushes the answer positive or negative. Symmetric data cancel out to zero.",
        invariants: [
            "The second central moment m2 is nonnegative and zero only for a constant sample.",
            "Cubed deviations keep their sign, so left-tail and right-tail contributions oppose each other.",
            "The bias-corrected value G1 approaches g1 as the sample size grows.",
        ],
        correctness:
            "The mean is computed first, so every deviation is measured from the same center. Dividing the sums of squared and cubed deviations by n gives m2 and m3, and g1 = m3 / m2^(3/2) is exactly the standardized third central moment. Multiplying by sqrt(n(n-1))/(n-2) is the standard Fisher-Pearson small-sample correction, which removes the downward bias of g1.",
        complexityRationale:
            "One pass finds the mean and a second pass accumulates two moment sums, so time is O(n). The running sums use constant space; the bars kept for the visualization use O(n).",
        uses: [
            "Describing the shape of returns in finance",
            "Checking normality assumptions before parametric tests",
            "Detecting skewed measurement error in quality control",
        ],
        references: [
            "Fisher, Contributions to Mathematical Statistics, 1950",
            "Wackerly, Mendenhall, and Scheaffer, Mathematical Statistics with Applications, Chapter 3",
        ],
        workedExample:
            "For the sample 1, 2, 2, 3, 3, 4, 4, 5, 8 the mean is about 3.56. The cubed high-tail deviations dominate the low ones, so g1 is about 0.73, a mild right skew; the sample-adjusted G1 is a little larger because n is small.",
    },
    id: "skewness",
    name: "Skewness",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [1, 2, 2, 3, 3, 4, 4, 5, 8] },
    visualType: "array",
    run,
    pseudocode: [
        "read the sample values and count n",
        "compute the arithmetic mean of the values",
        "set the second and third central-moment sums to zero",
        "for each value add squared and cubed deviations from the mean",
        "divide both sums by n to obtain m2 and m3",
        "set g1 equal to m3 divided by m2 to the three halves",
        "apply the Fisher-Pearson small-sample correction using n",
        "done: report the skewness coefficient",
    ],
};

export default module;
