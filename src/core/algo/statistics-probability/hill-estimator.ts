/**
 * hill-estimator.ts - Hill Estimator of the Tail Index
 *
 * For heavy-tailed data whose upper tail decays like x to the minus alpha, the
 * Hill estimator uses the k largest order statistics to estimate alpha. It is
 * the maximum-likelihood estimator under a Pareto tail above the k-th order
 * statistic. This module plots the estimate for every choice of k so the stable
 * region of the Hill plot is visible.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HillInput {
    sample?: number[];
    k?: number;
}

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (done) state = "sorted";
        else if (index === active) state = "comparing";
        else if (index < active) state = "visited";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: Number.isFinite(value) ? value.toFixed(3) : "n/a",
            value: Number.isFinite(value) ? value : 0,
            state,
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { k: index + 2, estimate: Number.isFinite(value) ? value : 0 },
        };
    });
}

/** Hill estimate using the k largest observations of a descending sample. */
function hill(sample: number[], k: number): number {
    if (k < 1 || k >= sample.length) return Number.NaN;
    const threshold = sample[k]!;
    if (threshold <= 0) return Number.NaN;
    let sum = 0;
    for (let i = 0; i < k; i += 1) {
        const xi = sample[i]!;
        if (xi <= 0) return Number.NaN;
        sum += Math.log(xi / threshold);
    }
    return sum > 0 ? k / sum : Number.NaN;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HillInput | null) ?? {};
    const raw = Array.isArray(task.sample) ? task.sample.map(Number).filter((v) => Number.isFinite(v) && v > 0) : [];
    const sample = (raw.length >= 3 ? raw : Array.from({ length: 60 }, (_, i) =>
        Math.pow((i + 1) / 61, -1 / 2.5)))
        .slice()
        .sort((a, b) => b - a)
        .slice(0, 400);
    const requested = Math.min(sample.length - 1, Math.max(2, Math.floor(Number(task.k ?? 30)) || 30));
    const estimates: number[] = [];
    for (let k = 1; k < sample.length; k += 1) estimates.push(hill(sample, k));

    yield {
        stepNumber: 0,
        entities: makeBars(estimates.map(() => 0), -1, false),
        edges: [],
        description: `Hill estimator on ${sample.length} positive observations sorted from largest to smallest.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: sample.length, requested, estimates: [], chosen: 0, threshold: 0 },
    };

    // Batch large samples so the precomputed frame buffer stays small.
    const batch = Math.max(1, Math.ceil(estimates.length / 40));
    let step = 1;
    for (let i = 0; i < estimates.length; i += batch) {
        const upto = Math.min(estimates.length, i + batch);
        yield {
            stepNumber: step,
            entities: makeBars(estimates, i, false),
            edges: [],
            description: `With k = ${i + 1} upper order statistics the tail index estimate is ${Number.isFinite(estimates[i]) ? estimates[i]!.toFixed(4) : "undefined"}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                n: sample.length,
                requested,
                estimates: estimates.slice(0, upto).map((v) => Number.isFinite(v) ? v : 0),
                chosen: 0,
                threshold: sample[i + 1] ?? 0,
            },
        };
        step += 1;
    }

    const chosen = Number.isFinite(estimates[requested - 1]) ? estimates[requested - 1]! : 0;
    yield {
        stepNumber: step,
        entities: makeBars(estimates, -1, true),
        edges: [],
        description: `At k = ${requested} the Hill estimate of the tail index is ${chosen.toFixed(4)}; a flat region of the plot indicates a stable estimate.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            n: sample.length,
            requested,
            estimates: estimates.map((v) => Number.isFinite(v) ? v : 0),
            chosen,
            threshold: sample[requested] ?? 0,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A heavy-tailed distribution has a tail that falls off like a power rather than exponentially. The exponent is the tail index. If the largest observations really come from a Pareto tail, their log spacings above a threshold carry all the information needed: the Hill estimate is simply the number of exceedances divided by the average log spacing.",
        invariants: [
            "The sample is sorted in nonincreasing order before estimation.",
            "The threshold for a given k is the observation at rank k plus one.",
            "For each k the estimate uses only observations at least as large as that threshold.",
        ],
        correctness:
            "Above the threshold the excess distribution is approximately Pareto with index alpha, whose log-likelihood for the exceedances is k log alpha minus alpha times the sum of log ratios to the threshold. Setting the derivative to zero gives alpha equal to k over that sum of logs, which is the Hill estimator. Consistency follows because the average log spacing above a fixed high threshold converges to one over alpha as the sample grows.",
        complexityRationale:
            "Computing every estimate naively sums up to k terms, giving O(n squared) time for a full Hill plot; only the order statistics and the displayed estimates are stored, O(n) space.",
        uses: [
            "Estimating tail risk for insurance and financial losses",
            "Analyzing heavy tails in network traffic and file sizes",
            "Extreme value analysis of environmental data",
        ],
        references: [
            "Hill, A Simple General Approach to Inference About the Tail of a Distribution, 1975",
            "Embrechts, Kluppelberg and Mikosch, Modelling Extremal Events",
        ],
        workedExample:
            "If the four largest observations are 8, 4, 2 and 1.5, using k = 3 gives a threshold of 1.5 and log spacings log(8/1.5), log(4/1.5) and log(2/1.5). Their sum divided into three yields the tail-index estimate for that k.",
    },
    id: "hill-estimator",
    name: "Hill Estimator",
    category: "statistics-probability",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: {
        sample: Array.from({ length: 60 }, (_, i) => Number(Math.pow((i + 1) / 61, -1 / 2.5).toFixed(6))),
        k: 30,
    },
    visualType: "array",
    run,
    pseudocode: [
        "sort the positive observations from largest to smallest",
        "for each candidate number k of upper order statistics",
        "set the threshold to the observation at rank k plus one",
        "sum the logarithms of the top k values over that threshold",
        "divide k by the sum to obtain the tail index estimate",
        "store the estimate to form the Hill plot",
        "done: report the estimate at the chosen k",
    ],
};

export default module;
