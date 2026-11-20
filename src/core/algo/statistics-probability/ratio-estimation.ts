/**
 * ratio-estimation.ts - Ratio Estimator for a Population Total
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When an auxiliary variable x is known for the whole population and correlated
 * with a study variable y, a ratio estimator uses the sampled ratio of y to x
 * to estimate y's population total. The point estimate is the sample ratio
 * times the known population total of x. Its approximate variance comes from
 * the scatter of residuals y minus R x around the fitted ratio line.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n sampled units
 *   Space: O(n) for the residuals and bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per sampled unit shows its residual from the ratio line.
 *   - The final frame reports the ratio, estimated total, and variance.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RatioInput {
    pairs?: Array<[number, number]>;
    populationX?: number;
    finiteCorrection?: number;
}

/** Build one bar per unit showing its ratio residual. */
function makeBars(residuals: number[], current: number, done: boolean): VisualEntity[] {
    return residuals.map((value, index) => {
        let state: EntityState = "idle";
        if (done || index < current) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `unit ${index}: residual ${value.toFixed(3)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, residual: value },
        };
    });
}

/** Estimate a population total with the classical ratio estimator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RatioInput | null) ?? {};
    const pairs: Array<[number, number]> = (task.pairs ?? []).filter(
        (p) => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number" && p[0] !== 0,
    );
    const populationX = typeof task.populationX === "number" ? task.populationX : 0;
    const finiteCorrection = typeof task.finiteCorrection === "number"
        ? Math.min(1, Math.max(0, task.finiteCorrection))
        : 0;
    const n = pairs.length;

    if (n === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "No sampled pairs were supplied; the ratio is undefined.",
            codeLineNumber: 0,
            layout: "array",
            meta: { ratio: 0, total: 0, variance: 0, count: 0 },
        };
        return;
    }

    const sumX = pairs.reduce((acc, p) => acc + p[0], 0);
    const sumY = pairs.reduce((acc, p) => acc + p[1], 0);
    const xbar = sumX / n;
    const ratio = sumY / sumX;
    const total = ratio * populationX;
    const residuals = pairs.map((p) => p[1] - ratio * p[0]);
    const meanResidual = residuals.reduce((a, b) => a + b, 0) / n;
    const ssResidual = n > 1 ? residuals.reduce((acc, v) => acc + (v - meanResidual) ** 2, 0) / (n - 1) : 0;
    const variance = n > 1 ? ((1 - finiteCorrection) / n) * ssResidual : 0;

    yield {
        stepNumber: 0,
        entities: makeBars(residuals, -1, false),
        edges: [],
        description: `Estimating a total from ${n} pairs using the known auxiliary total ${populationX.toFixed(2)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ratio, total, variance, xbar, sumX, sumY, residuals, count: n },
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(residuals, i, false),
            edges: [],
            description: `Unit ${i}: x ${pairs[i]![0].toFixed(2)}, y ${pairs[i]![1].toFixed(2)}, residual ${residuals[i]!.toFixed(3)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { ratio, total, variance, xbar, sumX, sumY, residuals, count: n, revealed: i + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(residuals, -1, true),
        edges: [],
        description: `Ratio ${ratio.toFixed(4)} gives total ${total.toFixed(3)} with approximate variance ${variance.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ratio, total, variance, xbar, sumX, sumY, residuals, count: n },
    };
}

/** The ratio estimation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "If a cheap auxiliary measurement is known for every unit, it can act as a proxy for an expensive measurement known only in a sample. The ratio estimator scales the sampled relationship up to the whole population by multiplying the sample ratio of y to x by the known population total of x. It works best when y and x are nearly proportional, so the residuals from the ratio line are small.",
        invariants: [
            "The estimated ratio equals the total sampled y divided by the total sampled x.",
            "The average residual is zero, so the ratio line passes through the sample means.",
            "A finite population correction shrinks the variance as the sampling fraction grows.",
        ],
        correctness:
            "The estimator is Yhat equals R times X where R equals ybar over xbar and X is the known population total of x. When y is exactly proportional to x, R is the constant of proportionality and Yhat is exact. Linearizing R around the sample means gives an approximate variance of (1 minus f) over n times the sample variance of the residuals y minus R x, which is the standard ratio-estimator variance. The residuals sum to zero because R equals ybar over xbar.",
        complexityRationale:
            "Computing the ratio, residuals, and their variance each scan the n sampled units once, for O(n) time. The residual array and bars use O(n) space.",
        uses: [
            "Estimating crop yield from sampled plots and total acreage",
            "Auditing total expenditure using recorded transaction counts",
            "Scaling sampled network traffic to a full-day total",
        ],
        references: [
            "Cochran, Sampling Techniques, Chapter 6 on ratio estimation",
            "Lohr, Sampling: Design and Analysis, Chapter 4",
        ],
        workedExample:
            "Five sampled households report income y and number of workers x, with totals of 2500 and 10, giving a ratio of 250 income per worker. If the population has 400 workers, the estimated total income is 100000. Residuals measure how far each household is from 250 times its worker count, and their spread sets the margin of error.",
    },
    id: "ratio-estimation",
    name: "Ratio Estimation",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        pairs: [[2, 480], [3, 760], [1, 240], [4, 1010], [2, 510]],
        populationX: 400,
        finiteCorrection: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read paired samples and the known population total of x",
        "sum the sampled x and y values",
        "set the ratio to total y divided by total x",
        "multiply the ratio by the population x total",
        "compute each residual y minus ratio times x",
        "estimate variance from residual spread and finite correction",
        "done: report the ratio, total estimate, and variance",
    ],
};

export default module;
