/**
 * gaussian-mixture-em.ts - Expectation-Maximization for a Two-Component Mixture
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Expectation-Maximization fits a mixture of two Gaussian distributions to
 * unlabeled one-dimensional data. The E-step computes, for every point, the
 * probability that it came from each component. The M-step refits each
 * component's mean, variance, and weight using those probabilities as soft
 * counts. Repeating the two steps never decreases the data log-likelihood.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n) for n points and two components
 *   Space: O(n) for the responsibilities and point entities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each data point is a node at (value, responsibility for component 1).
 *   - A point is green when component 1 dominates and idle when component 0
 *     dominates, so assignments become clearer on each iteration.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Params {
    means: [number, number];
    variances: [number, number];
    weights: [number, number];
}

/** Normal density with a variance floor to keep the E-step finite. */
function normalDensity(x: number, mean: number, variance: number): number {
    const v = Math.max(1e-9, variance);
    return Math.exp(-0.5 * ((x - mean) * (x - mean)) / v) / Math.sqrt(2 * Math.PI * v);
}

/** E-step: soft responsibilities for component 1 and the total log-likelihood. */
function eStep(data: number[], params: Params) {
    const responsibilities: number[] = [];
    let logLikelihood = 0;
    for (const x of data) {
        const d0 = (params.weights[0] ?? 0) * normalDensity(x, params.means[0] ?? 0, params.variances[0] ?? 1);
        const d1 = (params.weights[1] ?? 0) * normalDensity(x, params.means[1] ?? 0, params.variances[1] ?? 1);
        const total = d0 + d1 || 1e-300;
        responsibilities.push(d1 / total);
        logLikelihood += Math.log(total);
    }
    return { responsibilities, logLikelihood };
}

/** Build the data-point entities from the current responsibilities. */
function makeEntities(data: number[], responsibilities: number[]): VisualEntity[] {
    return data.map((x, index) => {
        const r1 = responsibilities[index] ?? 0;
        return {
            id: `point-${index}`,
            type: "node" as const,
            label: x.toFixed(1),
            value: x,
            state: (r1 >= 0.5 ? "sorted" : "idle") as EntityState,
            x,
            y: r1,
            width: 0,
            height: 0,
            metadata: { index, value: x, responsibility: r1 },
        };
    });
}

/** The EM generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            data?: number[];
            iterations?: number;
            initMeans?: [number, number];
            initVariances?: [number, number];
            initWeights?: [number, number];
        } | null
    ) ?? {};
    const data: number[] = task.data ?? [0, 0.2, 0.5, 1, 9.5, 10, 10.2, 10.5];
    const iterations = typeof task.iterations === "number" ? Math.max(1, task.iterations) : 12;
    const params: Params = {
        means: task.initMeans ? [task.initMeans[0] ?? 0, task.initMeans[1] ?? 1] : [1, 9],
        variances: task.initVariances ? [task.initVariances[0] ?? 1, task.initVariances[1] ?? 1] : [2, 2],
        weights: task.initWeights ? [task.initWeights[0] ?? 0.5, task.initWeights[1] ?? 0.5] : [0.5, 0.5],
    };
    const n = Math.max(1, data.length);

    let { responsibilities, logLikelihood } = eStep(data, params);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(data, responsibilities),
        edges: [],
        description: `Fitting a two-component Gaussian mixture to ${data.length} points for ${iterations} iterations.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {
            iteration: 0,
            means: params.means,
            variances: params.variances,
            weights: params.weights,
            logLikelihood,
            responsibilities,
        },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        let n0 = 0;
        let n1 = 0;
        let sum0 = 0;
        let sum1 = 0;
        for (let i = 0; i < data.length; i += 1) {
            const r1 = responsibilities[i] ?? 0;
            const r0 = 1 - r1;
            const x = data[i] ?? 0;
            n0 += r0;
            n1 += r1;
            sum0 += r0 * x;
            sum1 += r1 * x;
        }
        const mean0 = n0 > 1e-12 ? sum0 / n0 : (params.means[0] ?? 0);
        const mean1 = n1 > 1e-12 ? sum1 / n1 : (params.means[1] ?? 0);
        let var0 = 0;
        let var1 = 0;
        for (let i = 0; i < data.length; i += 1) {
            const r1 = responsibilities[i] ?? 0;
            const r0 = 1 - r1;
            const x = data[i] ?? 0;
            var0 += r0 * (x - mean0) * (x - mean0);
            var1 += r1 * (x - mean1) * (x - mean1);
        }
        params.means = [mean0, mean1];
        params.variances = [var0 / Math.max(n0, 1e-12), var1 / Math.max(n1, 1e-12)];
        params.weights = [n0 / n, n1 / n];
        ({ responsibilities, logLikelihood } = eStep(data, params));

        yield {
            stepNumber: step,
            entities: makeEntities(data, responsibilities),
            edges: [],
            description: `Iteration ${iteration}: means (${mean0.toFixed(2)}, ${mean1.toFixed(2)}), log-likelihood ${logLikelihood.toFixed(3)}.`,
            codeLineNumber: 6,
            layout: "point",
            meta: {
                iteration,
                means: params.means,
                variances: params.variances,
                weights: params.weights,
                logLikelihood,
                responsibilities,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(data, responsibilities),
        edges: [],
        description: `Done: component means ${params.means.map((mean) => mean.toFixed(2)).join(", ")} with log-likelihood ${logLikelihood.toFixed(3)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: {
            iteration: iterations,
            means: params.means,
            variances: params.variances,
            weights: params.weights,
            logLikelihood,
            responsibilities,
            converged: true,
        },
    };
}

/** The Gaussian mixture EM module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Pretend each point has a hidden label saying which Gaussian generated it. Start with a guess about the two Gaussians, then alternate between assigning points softly to components and refitting each component to the points that favor it. Each round makes the assignments and the fitted curves more consistent.",
        invariants: [
            "For every point, the two responsibilities are nonnegative and sum to one.",
            "The M-step re-estimates each mean as a responsibility-weighted average.",
            "The log-likelihood of the data under the current parameters never decreases from one iteration to the next.",
        ],
        correctness:
            "The E-step computes the exact posterior component probability by Bayes' rule. The M-step maximizes the expected complete-data log-likelihood with respect to each parameter, so the generalized EM inequality guarantees a nondecreasing observed log-likelihood. Repeated improvement converges to a stationary point of the likelihood.",
        complexityRationale:
            "Each iteration evaluates two Gaussian densities per point in the E-step and accumulates weighted sums in the M-step, both O(n). Storing one responsibility per point and a constant number of parameters uses O(n) space.",
        uses: [
            "Unsupervised clustering when groups overlap",
            "Background subtraction and anomaly detection",
            "Filling in missing values from a learned data distribution",
        ],
        references: [
            "Dempster, Laird, and Rubin, Maximum Likelihood from Incomplete Data via the EM Algorithm, 1977",
            "Bishop, Pattern Recognition and Machine Learning, Chapter 9",
        ],
        workedExample:
            "Two clusters near 0 and 10 are initialized with means 1 and 9. In the first E-step a point at 0.2 is assigned almost entirely to component 0, while a point at 9.8 favors component 1. The M-step moves the means toward 0.4 and 10.0, and the likelihood rises.",
    },
    id: "gaussian-mixture-em",
    name: "Gaussian Mixture EM",
    category: "ml-ai",
    complexity: { time: "O(iterations * n)", space: "O(n)" },
    defaultInput: {
        data: [0, 0.2, 0.5, 1, 9.5, 10, 10.2, 10.5],
        iterations: 12,
        initMeans: [1, 9],
        initVariances: [2, 2],
        initWeights: [0.5, 0.5],
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize component means, variances, and weights",
        "E-step: for each point compute its responsibility for each component",
        "normalize the responsibilities so they sum to one",
        "M-step: recompute each weight from the total responsibility",
        "recompute each mean as a weighted average of the points",
        "recompute each variance from weighted squared deviations",
        "repeat the E and M steps for a fixed number of iterations",
        "done: report the fitted components and log-likelihood",
    ],
};

export default module;
