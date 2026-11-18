/**
 * expectation-maximization.ts - Expectation-Maximization for a Two-Component Mixture
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Expectation-Maximization (EM) fits a probabilistic model with hidden group
 * labels. This module fits a two-component Gaussian mixture on one-dimensional
 * data with known variance. The E-step computes, for each point, the
 * responsibility (posterior probability) that it belongs to each component;
 * the M-step updates the mixing weights and means using those responsibilities.
 * Each full iteration never decreases the observed-data log-likelihood.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n) for n data points
 *   Space: O(n) for the responsibilities and log-likelihood terms
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per data point shows its responsibility for component one.
 *   - Bars near one belong to the first cluster, bars near zero to the second.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Univariate normal density with a fixed variance. */
function normal(x: number, mu: number, variance: number): number {
    return Math.exp(-((x - mu) ** 2) / (2 * variance)) / Math.sqrt(2 * Math.PI * variance);
}

function makeBars(responsibilities: number[]): VisualEntity[] {
    return responsibilities.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${index}: ${value.toFixed(3)}`,
        value,
        state: value >= 0.5 ? ("sorted" as const) : ("comparing" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, k: index },
    }));
}

/** The expectation-maximization generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { data?: number[]; iterations?: number; initialMeans?: number[]; variance?: number } | null) ?? {};
    const data = Array.isArray(task.data) && task.data.length > 0
        ? [...task.data]
        : [1.0, 1.2, 1.5, 0.9, 1.1, 5.0, 5.3, 4.8, 5.5, 5.1];
    const iterations = typeof task.iterations === "number" ? Math.min(50, Math.max(1, Math.floor(task.iterations))) : 8;
    const variance = typeof task.variance === "number" && task.variance > 0 ? task.variance : 1;
    const initial = Array.isArray(task.initialMeans) && task.initialMeans.length === 2 ? [...task.initialMeans] : [2, 4];
    let mu1 = initial[0] ?? 2;
    let mu2 = initial[1] ?? 4;
    let w1 = 0.5;
    const n = data.length;

    let resp1 = new Array<number>(n).fill(0.5);
    let logLikelihood = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(resp1),
        edges: [],
        description: `Fitting a two-component mixture to ${n} points with initial means ${mu1.toFixed(2)} and ${mu2.toFixed(2)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, iterations, variance, iteration: 0, means: [mu1, mu2], weights: [w1, 1 - w1], responsibilities: [...resp1], resp2: [...resp1], logLikelihood: 0 },
    };
    let step = 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const nextResp1: number[] = [];
        const nextResp2: number[] = [];
        let ll = 0;
        for (const x of data) {
            const a = w1 * normal(x, mu1, variance);
            const b = (1 - w1) * normal(x, mu2, variance);
            const total = a + b;
            nextResp1.push(total === 0 ? 0.5 : a / total);
            nextResp2.push(total === 0 ? 0.5 : b / total);
            ll += Math.log(Math.max(total, Number.MIN_VALUE));
        }
        resp1 = nextResp1;
        logLikelihood = ll;
        yield {
            stepNumber: step,
            entities: makeBars(resp1),
            edges: [],
            description: `Iteration ${iteration} E-step: posterior responsibilities computed; log-likelihood ${logLikelihood.toFixed(4)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { n, iterations, variance, iteration, means: [mu1, mu2], weights: [w1, 1 - w1], responsibilities: [...resp1], resp2: [...nextResp2], logLikelihood },
        };
        step += 1;

        const n1 = resp1.reduce((sum, r) => sum + r, 0);
        const n2 = nextResp2.reduce((sum, r) => sum + r, 0);
        w1 = n1 / n;
        const newMu1 = n1 === 0 ? mu1 : resp1.reduce((sum, r, i) => sum + r * (data[i] ?? 0), 0) / n1;
        const newMu2 = n2 === 0 ? mu2 : nextResp2.reduce((sum, r, i) => sum + r * (data[i] ?? 0), 0) / n2;
        mu1 = newMu1;
        mu2 = newMu2;
        yield {
            stepNumber: step,
            entities: makeBars(resp1),
            edges: [],
            description: `Iteration ${iteration} M-step: means updated to ${mu1.toFixed(4)} and ${mu2.toFixed(4)}, mixing weight ${w1.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, iterations, variance, iteration, means: [mu1, mu2], weights: [w1, 1 - w1], responsibilities: [...resp1], resp2: [...nextResp2], logLikelihood },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(resp1),
        edges: [],
        description: `After ${iterations} iteration(s), means are ${mu1.toFixed(4)} and ${mu2.toFixed(4)} with log-likelihood ${logLikelihood.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, iterations, variance, iteration: iterations, means: [mu1, mu2], weights: [w1, 1 - w1], responsibilities: [...resp1], resp2: [...resp1.map((r) => 1 - r)], logLikelihood },
    };
}

/** The expectation-maximization module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine each data point secretly belongs to one of two clusters, but you cannot see the labels. Make a guess about the clusters, then ask how likely each point is under each guess. Re-estimate the clusters using those soft assignments, and repeat. Every round makes the data more plausible under the model, so the clusters settle into place.",
        invariants: [
            "The two responsibilities for a point are nonnegative and add to one.",
            "The mixing weights are nonnegative and add to one.",
            "The observed-data log-likelihood never decreases after a full E and M cycle.",
        ],
        correctness:
            "Jensen's inequality gives a lower bound on the log-likelihood equal to an expectation of complete-data log-likelihoods plus an entropy term. The E-step makes the bound tight at the current parameters; the M-step maximizes that bound, which cannot lower the true log-likelihood. Repeating therefore converges to a stationary point of the likelihood, and with fixed variance the M-step updates are exact weighted averages.",
        complexityRationale:
            "Each E-step evaluates two normal densities per point and each M-step forms two weighted sums, so an iteration costs O(n) time and O(n) space for the stored responsibilities.",
        uses: [
            "Clustering when soft membership is more honest than hard labels",
            "Filling in missing data under a probabilistic model",
            "The teaching example behind Gaussian mixture models",
        ],
        references: [
            "Dempster, Laird, and Rubin, Maximum Likelihood from Incomplete Data via the EM Algorithm, 1977",
            "Bishop, Pattern Recognition and Machine Learning, Chapter 9",
        ],
        workedExample:
            "Start with means 2 and 4 on the data 1.0, 1.2, 1.5, 0.9, 1.1, 5.0, 5.3, 4.8, 5.5, 5.1. Points near one get responsibility near one for the first component; points near five get near zero. After a few rounds the means move close to 1.1 and 5.1 and the weights stay near one half.",
    },
    id: "expectation-maximization",
    name: "Expectation-Maximization (Gaussian Mixture)",
    category: "statistics-probability",
    complexity: { time: "O(iterations * n)", space: "O(n)" },
    defaultInput: { data: [1.0, 1.2, 1.5, 0.9, 1.1, 5.0, 5.3, 4.8, 5.5, 5.1], iterations: 8, variance: 1, initialMeans: [2, 4] },
    visualType: "array",
    run,
    pseudocode: [
        "initialize two means and equal mixing weights",
        "E-step: compute each point's responsibility per component",
        "accumulate the observed-data log-likelihood",
        "M-step: update weights and means from the responsibilities",
        "repeat the E and M steps for the chosen iterations",
        "done: report fitted means, weights, and likelihood",
    ],
};

export default module;
