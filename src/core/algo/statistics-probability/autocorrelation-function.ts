/**
 * autocorrelation-function.ts - Autocorrelation Function
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The autocorrelation function measures how strongly a series resembles a
 * shifted copy of itself. At each lag h it correlates the series with a version
 * delayed by h steps, normalized so that lag zero equals one. This module
 * computes the sample autocorrelation for lags up to a chosen maximum and
 * reports the series mean and variance used in the calculation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * maxLag) for all lagged sums
 *   Space: O(maxLag) for the displayed coefficients
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per lag shows its autocorrelation coefficient.
 *   - The lag currently being evaluated is highlighted.
 *   - The final frame reports the lag-zero value and the series variance.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, lag: index, autocorrelation: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { series?: number[]; maxLag?: number } | null) ?? {};
    const series = task.series ?? [1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2];
    const n = series.length;
    const maxLag = typeof task.maxLag === "number" ? Math.max(1, Math.min(Math.max(1, n - 1), Math.floor(task.maxLag))) : Math.min(8, n - 1);
    const mean = n > 0 ? series.reduce((a, b) => a + b, 0) / n : 0;
    const centered = series.map((value) => value - mean);
    const denominator = centered.reduce((a, value) => a + value * value, 0) || 1;

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(maxLag + 1).fill(0), -1, false),
        edges: [],
        description: `Computing the autocorrelation of ${n} observations for lags 0 through ${maxLag}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, maxLag, mean, variance: denominator / Math.max(1, n), acf: [], complete: false },
    };
    let step = 1;
    const acf: number[] = [];
    for (let lag = 0; lag <= maxLag; lag += 1) {
        let sum = 0;
        for (let t = lag; t < n; t += 1) sum += (centered[t] as number) * (centered[t - lag] as number);
        const value = sum / denominator;
        acf.push(value);
        yield {
            stepNumber: step,
            entities: makeBars([...acf, ...new Array<number>(maxLag - lag).fill(0)], lag, false),
            edges: [],
            description: `Lag ${lag}: autocorrelation ${value.toFixed(4)} from ${n - lag} overlapping pairs.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, maxLag, mean, variance: denominator / Math.max(1, n), acf: [...acf], complete: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(acf, maxLag + 1, true),
        edges: [],
        description: `Autocorrelation complete: lag zero is ${(acf[0] as number).toFixed(4)}, variance ${(denominator / Math.max(1, n)).toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, maxLag, mean, variance: denominator / Math.max(1, n), acf, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Autocorrelation asks how well a time series predicts itself after a delay. At lag one it pairs each observation with the next, at lag two with the one after that, and so on. A value near one means the series is smooth and persistent, a value near zero means little linear memory, and a negative value means alternating behavior.",
        invariants: [
            "The lag-zero autocorrelation is exactly one for any nonconstant series.",
            "Every coefficient lies between minus one and one by the Cauchy-Schwarz inequality.",
            "The same centered series and denominator are used at every lag.",
        ],
        correctness:
            "Centering subtracts the sample mean, so the denominator is the total sum of squared deviations. At lag zero the numerator equals that same sum, giving one. For any lag the numerator is an inner product of two equally long centered subsequences, whose magnitude is at most the product of their norms and hence at most the full denominator, so coefficients stay in the interval from minus one to one.",
        complexityRationale:
            "For each of the maxLag plus one lags the computation scans up to n pairs, so the total work is O(n times maxLag). Only the coefficient array and the centered copy are stored, giving O(n + maxLag) space.",
        uses: [
            "Detecting seasonality and periodicity in time-series data",
            "Checking residual independence after model fitting",
            "Estimating the memory of a stochastic process",
        ],
        references: [
            "Box, Jenkins, and Reinsel, Time Series Analysis: Forecasting and Control, Chapter 2",
            "Brockwell and Davis, Introduction to Time Series and Forecasting, Chapter 1",
        ],
        workedExample:
            "For the alternating series 1, -1, 1, -1 the mean is zero and the denominator is four. At lag one every product is minus one across three pairs, giving minus 0.75. At lag two every product is plus one across two pairs, giving 0.5, showing the characteristic alternating pattern.",
    },
    id: "autocorrelation-function",
    name: "Autocorrelation Function",
    category: "statistics-probability",
    complexity: { time: "O(n * maxLag)", space: "O(n + maxLag)" },
    defaultInput: { series: [1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2], maxLag: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "read the series and the maximum lag",
        "compute the sample mean and center every observation",
        "set the denominator to the sum of squared centered values",
        "for each lag h from zero to maxLag sum centered[t] times centered[t-h]",
        "divide that sum by the denominator to get the autocorrelation",
        "done: report the autocorrelation for every lag and the series variance",
    ],
};

export default module;
