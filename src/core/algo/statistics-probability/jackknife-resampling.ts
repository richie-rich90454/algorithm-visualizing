/**
 * jackknife-resampling.ts - Jackknife Resampling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The jackknife estimates the bias and variance of a statistic by recomputing
 * it on every sample obtained by deleting one observation. For the sample mean
 * the average of the leave-one-out estimates equals the full-sample mean, and
 * the jackknife variance estimate equals the usual standard error squared.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) for n observations when each leave-one-out mean is summed
 *   Space: O(n) for the leave-one-out estimates
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per deleted observation shows its leave-one-out mean.
 *   - The cell being recomputed is yellow; finished cells are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    data?: number[];
}

/** Build one cell per leave-one-out replicate. */
function makeCells(
    sums: number[],
    values: number[],
    replicates: Array<number | null>,
    current: number,
    done: boolean,
): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (done || replicates[index] !== null) state = "sorted";
        if (index === current && !done) state = "comparing";
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: replicates[index] === null ? `drop ${value}` : `drop ${value}: ${(replicates[index] ?? 0).toFixed(3)}`,
            value: replicates[index] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, dropped: value, sum: sums[index] ?? 0 },
        };
    });
}

/** The jackknife generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const data = Array.isArray(task.data) && task.data.length > 1 ? task.data.map(Number) : [4, 6, 5, 9, 3, 7, 5, 8];
    const n = data.length;
    const total = data.reduce((sum, x) => sum + x, 0);
    const fullMean = total / n;
    const replicates: Array<number | null> = data.map(() => null);

    const summary = () => {
        const present = replicates.filter((r): r is number => r !== null);
        const jackMean = present.length === 0 ? 0 : present.reduce((s, r) => s + r, 0) / present.length;
        const jackVar = present.length === 0
            ? 0
            : ((n - 1) / n) * present.reduce((s, r) => s + (r - jackMean) ** 2, 0);
        return {
            rows: 1,
            cols: n,
            n,
            fullMean,
            jackknifeMean: jackMean,
            jackknifeVariance: jackVar,
            replicates: present.slice(),
        };
    };

    yield {
        stepNumber: 0,
        entities: makeCells(data.map(() => total), data, replicates, -1, false),
        edges: [],
        description: `Jackknife on ${n} observations: recompute the mean after deleting each value in turn.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: summary(),
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        const leaveOutSum = total - (data[i] ?? 0);
        replicates[i] = leaveOutSum / (n - 1);
        yield {
            stepNumber: step,
            entities: makeCells(data.map(() => total), data, replicates, i, false),
            edges: [],
            description: `Delete observation ${i} (${(data[i] ?? 0).toFixed(2)}): leave-one-out mean is ${(replicates[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: summary(),
        };
        step += 1;
    }

    const final = summary();
    const sampleVariance = data.reduce((s, x) => s + (x - fullMean) ** 2, 0) / (n - 1);
    yield {
        stepNumber: step,
        entities: makeCells(data.map(() => total), data, replicates, n - 1, true),
        edges: [],
        description: `Jackknife mean ${final.jackknifeMean.toFixed(4)}; variance ${final.jackknifeVariance.toFixed(4)} equals sample variance over n, ${(sampleVariance / n).toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...final, sampleVariance, standardErrorSquared: sampleVariance / n },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To see how sensitive a statistic is to individual observations, recompute it once for each data point you throw away. The spread of those leave-one-out answers estimates the statistic's own variability without any distributional assumptions or random draws.",
        invariants: [
            "Every replicate is the mean of exactly n minus one observations.",
            "The average of the leave-one-out means equals the full-sample mean.",
            "The jackknife variance estimate is nonnegative.",
        ],
        correctness:
            "For the mean, deleting observation x_i gives (S - x_i)/(n-1) = mean + (mean - x_i)/(n-1). Averaging over i cancels the deviations, so the jackknife mean equals the full mean. Summing squared deviations gives sum (x_i-mean)^2/(n-1)^2, and multiplying by (n-1)/n yields sum (x_i-mean)^2/(n(n-1)), which is exactly the unbiased sample variance divided by n.",
        complexityRationale:
            "Each of the n replicates is formed from a running total in constant time here, but the general pattern of recomputing a statistic over n-1 points gives O(n^2) time; storing the n replicates uses O(n) space.",
        uses: [
            "Estimating standard errors for complex survey statistics",
            "Assessing the influence of individual observations in regression",
            "Bias correction where bootstrapping is too expensive",
        ],
        references: [
            "Quenouille, Approximate Tests of Correlation in Time Series, 1949",
            "Tukey, Bias and Confidence in Not-Quite Large Samples, 1958",
        ],
        workedExample:
            "For data 4, 6, 5, 9 the full mean is 6. Deleting 4, 6, 5, 9 gives means 6.667, 6, 6, 5, whose average is 6. The jackknife variance is (3/4) times the average squared deviation of those replicates, matching the usual sample variance divided by four.",
    },
    id: "jackknife-resampling",
    name: "Jackknife Resampling",
    category: "statistics-probability",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { data: [4, 6, 5, 9, 3, 7, 5, 8] },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the full-sample mean from the total",
        "for each observation i",
        "subtract the observation from the total and divide by n minus one",
        "store the resulting leave-one-out mean",
        "average the stored replicates for the jackknife mean",
        "multiply the average squared replicate deviation by (n-1)/n",
        "done: report the jackknife mean and variance",
    ],
};

export default module;
