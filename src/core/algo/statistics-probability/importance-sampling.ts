/**
 * importance-sampling.ts - Importance Sampling Monte Carlo Estimator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Importance sampling estimates an expectation under a target density p by
 * drawing samples from an easier proposal density q and weighting each sample
 * by p(x) / q(x). Here the target is a standard normal, the proposal is uniform
 * on [-A, A], and the integrand is h(x) = x^2, whose true expectation is 1.
 * The module also computes the self-normalized estimator and the effective
 * sample size, which diagnose how much the weights concentrate.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(samples) for the draws and weight accumulation
 *   Space: O(batches) for the displayed running estimates
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per batch shows the running estimate after that batch.
 *   - The target value is reported in each frame's metadata.
 *   - The final frame states the estimate, effective sample size, and error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const INV_SQRT_2PI = 0.3989422804014327;

/** Deterministic mulberry32 generator so every replay is identical. */
function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const standardNormalPdf = (x: number): number => INV_SQRT_2PI * Math.exp((-x * x) / 2);

export interface ImportanceResult {
    samples: number;
    proposalHalfWidth: number;
    seed: number;
    estimate: number;
    selfNormalized: number;
    effectiveSampleSize: number;
    weights: number[];
    batchEstimates: number[];
    trueValue: number;
}

/**
 * Estimate E[X^2] for a standard normal using a uniform proposal on [-A, A].
 * Exported so the test can recompute the same arithmetic independently.
 */
export function importanceEstimate(
    proposalHalfWidth: number,
    samples: number,
    seed: number,
    batches: number,
): ImportanceResult {
    const A = Math.max(1, proposalHalfWidth);
    const n = Math.max(batches, Math.floor(samples));
    const random = mulberry32(seed);
    const q = 1 / (2 * A);
    let weightedSum = 0;
    let weightSum = 0;
    let weightSquares = 0;
    let normalizedNumerator = 0;
    const weights: number[] = [];
    const batchEstimates: number[] = [];
    const perBatch = Math.ceil(n / batches);

    for (let i = 0; i < n; i += 1) {
        const x = -A + 2 * A * random();
        const weight = standardNormalPdf(x) / q;
        const contribution = x * x * weight;
        weightedSum += contribution;
        weightSum += weight;
        weightSquares += weight * weight;
        normalizedNumerator += contribution;
        weights.push(weight);
        if ((i + 1) % perBatch === 0 && batchEstimates.length < batches) {
            batchEstimates.push(weightedSum / weightSum);
        }
    }
    while (batchEstimates.length < batches) {
        batchEstimates.push(weightedSum / weightSum);
    }

    return {
        samples: n,
        proposalHalfWidth: A,
        seed,
        estimate: weightedSum / n,
        selfNormalized: normalizedNumerator / weightSum,
        effectiveSampleSize: (weightSum * weightSum) / weightSquares,
        weights,
        batchEstimates,
        trueValue: 1,
    };
}

/** Build the running-estimate bars, highlighting the latest batch. */
function makeBars(estimates: number[], current: number, phase: string): VisualEntity[] {
    return estimates.map((value, index) => {
        let state: EntityState = "idle";
        if (index === current) {
            state = phase === "done" ? "sorted" : "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `batch ${index + 1}: ${value.toFixed(4)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, estimate: value, error: value - 1 },
        };
    });
}

/** The importance sampling generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { samples?: number; proposalHalfWidth?: number; seed?: number; batches?: number } | null) ??
        {};
    const samples = Math.min(50000, Math.max(10, Math.floor(Number(task.samples ?? 4000)) || 4000));
    const A = Math.min(20, Math.max(1, Number(task.proposalHalfWidth ?? 4) || 4));
    const seed = Math.floor(Number(task.seed ?? 12345)) || 12345;
    const batches = Math.min(20, Math.max(1, Math.floor(Number(task.batches ?? 8)) || 8));
    const result = importanceEstimate(A, samples, seed, batches);

    yield {
        stepNumber: 0,
        entities: [],
        edges: [],
        description: `Importance sampling: ${samples} proposal draws from a uniform law on -${A} to ${A}, target standard normal.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            samples,
            proposalHalfWidth: A,
            seed,
            batches,
            trueValue: result.trueValue,
            estimate: 0,
            selfNormalized: 0,
            effectiveSampleSize: 0,
            estimates: [] as number[],
        },
    };

    for (let b = 1; b <= batches; b += 1) {
        const shown = result.batchEstimates.slice(0, b);
        yield {
            stepNumber: b,
            entities: makeBars(shown, b - 1, b === batches ? "done" : "batch"),
            edges: [],
            description: `Batch ${b}: after ${((samples * b) / batches) | 0} draws the weighted estimate is ${(shown[b - 1] ?? 0).toFixed(5)}; target is 1.`,
            codeLineNumber: b === batches ? 6 : 3,
            layout: "array",
            meta: {
                samples,
                proposalHalfWidth: A,
                seed,
                batches,
                trueValue: result.trueValue,
                estimate: shown[b - 1] ?? 0,
                selfNormalized: result.selfNormalized,
                effectiveSampleSize: result.effectiveSampleSize,
                estimates: shown,
                batch: b,
            },
        };
    }

    yield {
        stepNumber: batches + 1,
        entities: makeBars(result.batchEstimates, batches - 1, "done"),
        edges: [],
        description: `Estimated E[X^2] = ${result.estimate.toFixed(5)} against the exact value 1; effective sample size ${result.effectiveSampleSize.toFixed(1)} of ${samples}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            samples,
            proposalHalfWidth: A,
            seed,
            batches,
            trueValue: result.trueValue,
            estimate: result.estimate,
            selfNormalized: result.selfNormalized,
            effectiveSampleSize: result.effectiveSampleSize,
            estimates: result.batchEstimates,
            absoluteError: Math.abs(result.estimate - 1),
            done: true,
        },
    };
}

/** The importance sampling module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "When samples from the target distribution are hard to obtain, draw from a proposal that covers the important region instead and correct each draw with a weight equal to target density over proposal density. The weighted average targets the same expectation. A proposal that is too narrow leaves parts of the target uncovered, which shows up as a few huge weights and a small effective sample size.",
        invariants: [
            "Every proposal weight equals the target density divided by the proposal density and is nonnegative.",
            "Both the weighted estimator and the self-normalized estimator target E[h(X)] under p.",
            "The effective sample size lies between one and the number of draws.",
        ],
        correctness:
            "For draws X_i from q, the expectation of h(X_i) p(X_i) / q(X_i) equals the integral of h(x) p(x) dx wherever q is positive on the support of h p, so the sample mean is unbiased. The self-normalized ratio converges to the same integral divided by the integral of p, which is one. With a uniform proposal covering the target, the support condition holds, and the law of large numbers gives convergence as the number of draws grows.",
        complexityRationale:
            "Each draw needs one proposal sample, one target density evaluation, and a few additions, so the estimator costs O(n) time. The running estimates kept for display use O(b) space for b batches, while storing every weight uses O(n) space.",
        uses: [
            "Estimating rare-event probabilities in reliability and risk analysis",
            "Bayesian posterior approximation when direct sampling is difficult",
            "Monte Carlo integration in physics and computational finance",
        ],
        references: [
            "Rubinstein, Simulation and the Monte Carlo Method, importance sampling chapter",
            "Owen, Monte Carlo Theory, Methods and Examples, Chapter 9",
        ],
        workedExample:
            "Estimate E[X^2] for a standard normal with a uniform proposal on -4 to 4. A draw at x = 1 receives weight phi(1) / (1/8) about 1.936 and contributes 1 times that weight; a draw at x = 3 receives weight about 0.0178. Averaging the weighted contributions over thousands of draws gives a value close to 1.",
    },
    id: "importance-sampling",
    name: "Importance Sampling",
    category: "statistics-probability",
    complexity: { time: "O(samples)", space: "O(batches)" },
    defaultInput: { samples: 4000, proposalHalfWidth: 4, seed: 12345, batches: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a proposal density q that covers the target support",
        "draw a sample x from q with a seeded generator",
        "compute the importance weight p(x) divided by q(x)",
        "accumulate the weighted contribution h(x) times the weight",
        "record the running estimate after each batch of draws",
        "compute the self-normalized estimate and effective sample size",
        "done: report the estimate and its error against the exact answer",
    ],
};

export default module;
