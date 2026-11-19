/**
 * coefficient-of-variation.ts - Coefficient of Variation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The coefficient of variation (CV) is the standard deviation divided by the
 * absolute value of the mean. It expresses spread as a fraction of the typical
 * value, so it is dimensionless and lets data sets on different scales be
 * compared. The module accumulates the sum, the mean, and the squared
 * deviations, then reports the sample or population standard deviation over
 * the absolute mean.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n values, with two passes over the data
 *   Space: O(n) for the displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each value is a bar; the bar under consideration is YELLOW.
 *   - Final bars are GREEN and the frame reports the CV.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build one bar per value with the given per-index state overrides. */
function makeBars(values: number[], states: Map<number, EntityState>, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? (done ? "sorted" : "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; sample?: boolean } | null) ?? {};
    const values: number[] = Array.isArray(task.values) ? task.values.map((v) => Number(v) || 0) : [2, 4, 4, 4, 5, 5, 7, 9];
    const sample = task.sample === true;
    const n = values.length;
    let step = 0;

    const frame = (
        states: Map<number, EntityState>,
        done: boolean,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(values, states, done),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { n, sum: 0, mean: 0, squaredDeviations: 0, variance: 0, std: 0, cv: 0, sample, ...extra },
    });

    yield frame(new Map(), false, `Computing the coefficient of variation for ${n} value(s).`, 0);
    step += 1;

    let sum = 0;
    for (let i = 0; i < n; i += 1) {
        sum += values[i] ?? 0;
        yield frame(new Map([[i, "comparing"]]), false, `Added value ${values[i] ?? 0} to the running sum; sum is now ${sum}.`, 2, { sum });
        step += 1;
    }

    const mean = n === 0 ? 0 : sum / n;
    yield frame(new Map(), false, `Mean is ${mean} (sum ${sum} over ${n} value(s)).`, 3, { sum, mean });
    step += 1;

    let squaredDeviations = 0;
    for (let i = 0; i < n; i += 1) {
        const deviation = (values[i] ?? 0) - mean;
        squaredDeviations += deviation * deviation;
        yield frame(new Map([[i, "comparing"]]), false, `Value ${values[i] ?? 0} deviates from the mean by ${deviation}; running squared sum ${squaredDeviations}.`, 5, { sum, mean, squaredDeviations });
        step += 1;
    }

    const divisor = Math.max(1, n - (sample ? 1 : 0));
    const variance = squaredDeviations / divisor;
    const std = Math.sqrt(variance);
    const meanIsZero = Math.abs(mean) < 1e-12;
    const cv = meanIsZero ? 0 : std / Math.abs(mean);
    yield frame(
        new Map(),
        true,
        meanIsZero
            ? `Mean is zero, so the coefficient of variation is undefined; standard deviation is ${std}.`
            : `Standard deviation ${std} over absolute mean ${Math.abs(mean)} gives coefficient of variation ${cv}.`,
        7,
        { sum, mean, squaredDeviations, variance, std, cv, meanIsZero },
    );
}

/** The coefficient of variation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A standard deviation has units, so it cannot say whether a spread of 2 is large or small without knowing the typical value. Dividing by the mean turns the spread into a percentage-like ratio. A data set with a CV of 0.1 varies about ten percent around its mean, whether the values are grams or kilometers.",
        invariants: [
            "The running sum equals the total of all values processed so far.",
            "The squared-deviation sum is always nonnegative.",
            "The coefficient of variation does not change when every value is multiplied by the same positive constant.",
        ],
        correctness:
            "The first pass computes the exact arithmetic mean because it adds every value once. The second pass sums (x minus mean) squared for every value, which is the definition of the sum of squared deviations. Dividing by n gives the population variance, or by n minus one for the unbiased sample variance; taking the square root and dividing by the absolute mean yields the standard textbook coefficient of variation.",
        complexityRationale:
            "Each of the two passes visits all n values once, so the running time is O(n). The bars kept for the visualization are the only O(n) storage beyond a handful of scalar accumulators.",
        uses: [
            "Comparing variability of investments with different average returns",
            "Assaying precision of laboratory measurements across concentration levels",
            "Assessing consistency of manufacturing processes of different sizes",
        ],
        references: [
            "Devore, Probability and Statistics for Engineering and the Sciences, Chapter 2",
            "Montgomery and Runger, Applied Statistics and Probability for Engineers, Chapter 3",
        ],
        workedExample:
            "For the values 2, 4, 4, 4, 5, 5, 7, 9 the sum is 40 and the mean is 5. The squared deviations total 32, so the population standard deviation is 2. The coefficient of variation is 2 over 5, or 0.4.",
    },
    id: "coefficient-of-variation",
    name: "Coefficient of Variation",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [2, 4, 4, 4, 5, 5, 7, 9], sample: false },
    visualType: "array",
    run,
    pseudocode: [
        "read the numeric values and the sample flag",
        "set the running sum to zero",
        "add each value to the running sum",
        "set the mean to the sum divided by the count",
        "set the squared-deviation sum to zero",
        "add each squared deviation from the mean",
        "divide by the count, take the square root to get the standard deviation",
        "set the coefficient of variation to standard deviation over absolute mean",
        "done: report the coefficient of variation",
    ],
};

export default module;
