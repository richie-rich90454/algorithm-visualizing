/**
 * z-test.ts - One-Sample Z Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The one-sample z test asks whether a sample mean differs significantly from
 * a hypothesized population mean when the population standard deviation is
 * already known. It standardizes the observed mean into a z score and converts
 * that score into a two-sided p value using the standard normal distribution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n observations
 *   Space: O(n) for the observation cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per observation shows its value and deviation.
 *   - The final frame reports the mean, z score, p value, and decision.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    data?: number[];
    mu0?: number;
    sigma?: number;
    alpha?: number;
}

/** Standard normal CDF via the Abramowitz-Stegun 7.1.26 approximation. */
function normalCdf(x: number): number {
    if (x === 0) return 0.5;
    if (x < 0) return 1 - normalCdf(-x);
    const p = 0.2316419;
    const b1 = 0.319381530;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;
    const t = 1 / (1 + p * x);
    const phi = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    return 1 - phi * (b1 * t + b2 * t ** 2 + b3 * t ** 3 + b4 * t ** 4 + b5 * t ** 5);
}

/** Build one cell per observation. */
function makeCells(
    data: number[],
    mean: number,
    current: number,
    done: boolean,
): VisualEntity[] {
    return data.map((value, index) => {
        let state: EntityState = "idle";
        if (done) state = "sorted";
        if (index === current && !done) state = "comparing";
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${value.toFixed(2)} (dev ${(value - mean).toFixed(2)})`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, value, deviation: value - mean },
        };
    });
}

/** The one-sample z test generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const data = Array.isArray(task.data) && task.data.length > 0
        ? task.data.map(Number)
        : [105, 102, 108, 99, 111, 107, 104, 98, 112, 106];
    const mu0 = typeof task.mu0 === "number" ? task.mu0 : 100;
    const sigma = typeof task.sigma === "number" && task.sigma > 0 ? task.sigma : 15;
    const alpha = typeof task.alpha === "number" ? task.alpha : 0.05;
    const n = data.length;

    let total = 0;
    const summary = (currentMean: number, z: number, pValue: number) => ({
        rows: 1,
        cols: n,
        n,
        mu0,
        sigma,
        alpha,
        mean: currentMean,
        z,
        pValue,
        reject: pValue < alpha,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(data, 0, -1, false),
        edges: [],
        description: `One-sample z test of ${n} observations against mean ${mu0} with known sigma ${sigma}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: summary(0, 0, 1),
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        total += data[i] ?? 0;
        const runningMean = total / (i + 1);
        yield {
            stepNumber: step,
            entities: makeCells(data, total / n, i, false),
            edges: [],
            description: `Adding observation ${i} (${(data[i] ?? 0).toFixed(2)}); running sum ${total.toFixed(2)}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: summary(runningMean, 0, 1),
        };
        step += 1;
    }

    const mean = total / n;
    const z = (mean - mu0) / (sigma / Math.sqrt(n));
    const pValue = 2 * (1 - normalCdf(Math.abs(z)));
    const reject = pValue < alpha;
    yield {
        stepNumber: step,
        entities: makeCells(data, mean, n - 1, true),
        edges: [],
        description: `Mean ${mean.toFixed(3)}, z=${z.toFixed(3)}, p=${pValue.toFixed(4)}; ${reject ? "reject" : "do not reject"} the null at alpha ${alpha}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: summary(mean, z, pValue),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A z test converts the gap between the sample mean and a claimed population mean into units of standard error. If that gap is many standard errors wide, it is unlikely to be luck, so the claim is rejected. Knowing the population standard deviation in advance is what makes the standard normal distribution the right yardstick.",
        invariants: [
            "The standard error equals sigma divided by the square root of n.",
            "The z score is the mean difference divided by the standard error.",
            "The two-sided p value decreases as the absolute z score grows.",
        ],
        correctness:
            "By the central limit theorem the sample mean is approximately normal with mean mu0 and standard error sigma/sqrt(n) under the null. Standardizing gives a statistic distributed as standard normal, and the two-sided p value is the probability of a result at least as extreme, computed as twice the upper tail. Comparing that probability with alpha gives a test with the stated significance level.",
        complexityRationale:
            "One pass adds the n observations, and the remaining work is constant-time arithmetic, so time is O(n). The observation cells require O(n) space.",
        uses: [
            "Checking whether a manufacturing batch mean meets a target",
            "Testing whether a changed conversion rate differs from a baseline",
            "Quality assurance when the process variance is historically known",
        ],
        references: [
            "Neyman and Pearson, On the Use and Interpretation of Certain Test Criteria, 1928",
            "Casella and Berger, Statistical Inference, Chapter 8",
        ],
        workedExample:
            "For ten observations with mean 106 and a claimed mean of 100 with sigma 15, the standard error is 15/sqrt(10) about 4.74. The z score is about 1.26 and the two-sided p value is about 0.21, above 0.05, so the null is not rejected.",
    },
    id: "z-test",
    name: "One-Sample Z Test",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { data: [105, 102, 108, 99, 111, 107, 104, 98, 112, 106], mu0: 100, sigma: 15, alpha: 0.05 },
    visualType: "grid",
    run,
    pseudocode: [
        "set the running sum to zero",
        "for each observation in the sample",
        "add the observation to the running sum",
        "set the mean to the sum divided by n",
        "compute z as (mean minus mu0) over sigma divided by sqrt(n)",
        "set p to twice the upper standard normal tail at absolute z",
        "reject the null when p is below alpha",
        "done: report the mean, z, p value, and decision",
    ],
};

export default module;
