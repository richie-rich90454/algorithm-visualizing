/**
 * welford-algorithm.ts - Welford's Online Mean and Variance
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Welford's algorithm updates the mean and the sum of squared deviations from
 * the mean as each new sample arrives, using only constant memory. From those
 * two running quantities the sample mean and unbiased sample variance can be
 * reported after any prefix of the stream without storing the whole stream.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n observations, O(1) per observation
 *   Space: O(1) for the accumulators (frames hold the visible history)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A bar per observation shows its value; the current one is highlighted.
 *   - Each frame reports the running count, mean, and M2 accumulator in meta.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Build value bars with the current observation highlighted. */
function makeBars(values: number[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `x${index + 1}=${value.toFixed(2)}`,
        value,
        state: index === active ? ("highlight" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** Stream observations through Welford's online update. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = Array.isArray(task.values)
        ? task.values.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
        : [1, 2, 3, 4, 5, 6, 7, 8];

    let count = 0;
    let mean = 0;
    let m2 = 0;
    const seen: number[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(seen, -1),
        edges: [],
        description: `Starting Welford's online update over ${values.length} observations with empty accumulators.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { count, mean, m2, variance: 0, values: [...seen] },
    };
    step += 1;

    for (let i = 0; i < values.length; i += 1) {
        const x = values[i] ?? 0;
        count += 1;
        const delta = x - mean;
        mean += delta / count;
        const delta2 = x - mean;
        m2 += delta * delta2;
        seen.push(x);
        const variance = count > 1 ? m2 / (count - 1) : 0;
        yield {
            stepNumber: step,
            entities: makeBars(seen, i),
            edges: [],
            description: `Observation ${x.toFixed(3)}: count ${count}, running mean ${mean.toFixed(4)}, M2 ${m2.toFixed(4)}.`,
            codeLineNumber: count === 1 ? 2 : count < values.length ? 4 : 6,
            layout: "array",
            meta: { count, mean, m2, variance, delta, values: [...seen] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(seen, -1),
        edges: [],
        description: `Finished: ${count} observations, mean ${mean.toFixed(4)}, unbiased variance ${(count > 1 ? m2 / (count - 1) : 0).toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            count,
            mean,
            m2,
            variance: count > 1 ? m2 / (count - 1) : 0,
            values: [...seen],
        },
    };
}

/** Welford's online mean and variance module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Computing a variance from the sum of squares minus the squared mean is numerically fragile when values are large and nearly equal. Welford keeps a running mean and a running sum of squared deviations from that mean. Each new observation shifts the mean slightly, and the deviation is measured against the old and new means, which stays stable and needs no stored history.",
        invariants: [
            "The count increases by exactly one per observation.",
            "The running mean equals the arithmetic mean of all observations seen so far.",
            "M2 equals the sum of squared deviations of the seen observations from their running mean.",
        ],
        correctness:
            "For the k-th observation x, the algorithm forms delta = x - mean_{k-1}, updates mean_k = mean_{k-1} + delta/k, and accumulates M2 += delta * (x - mean_k). This recurrence is algebraically identical to the two-pass definition of the sum of squared deviations, so dividing M2 by k-1 gives the unbiased sample variance, while storing only count, mean, and M2.",
        complexityRationale:
            "Each observation requires a constant number of arithmetic operations, so the total time is linear in the stream length and the accumulator memory is constant, independent of how many values have arrived.",
        uses: [
            "Streaming statistics for sensor and telemetry data",
            "Online algorithms that cannot store the full data set",
            "Numerically stable variance in incremental machine learning",
        ],
        references: [
            "B. P. Welford, Note on a Method for Calculating Corrected Sums of Squares and Products, Technometrics, 1962",
            "J. Higham, Accuracy and Stability of Numerical Algorithms, 2002",
        ],
        workedExample:
            "For the stream [1, 2, 3, 4, 5] the final mean is 3 and M2 is 10, so the unbiased sample variance is 10/4 = 2.5, matching the two-pass computation.",
    },
    id: "welford-algorithm",
    name: "Welford Online Variance",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { values: [1, 2, 3, 4, 5, 6, 7, 8] },
    visualType: "array",
    run,
    pseudocode: [
        "initialize count = 0, mean = 0, M2 = 0",
        "for each observation x in the stream",
        "count = count + 1",
        "delta = x - mean",
        "mean = mean + delta / count",
        "M2 = M2 + delta * (x - mean)",
        "variance = M2 / (count - 1) when count > 1",
        "done: report count, mean, M2, and variance",
    ],
};

export default module;
