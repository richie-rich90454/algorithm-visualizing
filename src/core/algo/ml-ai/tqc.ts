/**
 * tqc.ts - Truncated Quantile Critics
 *
 * TQC controls overestimation in distributional reinforcement learning by
 * training several quantile critics and, at action selection time, discarding
 * the largest quantiles from the pooled distribution. Averaging only the
 * remaining quantiles yields a conservative estimate of the return, and the
 * number of dropped quantiles is the single knob that trades optimism for
 * caution.
 *
 * Time O(k q log(k q)) to sort all quantiles, space O(k q).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface TqcResult {
    sorted: number[];
    kept: number[];
    dropped: number[];
    target: number;
}

/** Pool, sort, truncate the largest quantiles, and return the mean target. */
export function tqcTruncate(quantiles: number[][], drop: number): TqcResult {
    const pooled = quantiles.flat();
    const sorted = [...pooled].sort((a, b) => a - b);
    const keepCount = Math.max(0, sorted.length - drop);
    const kept = sorted.slice(0, keepCount);
    const dropped = sorted.slice(keepCount);
    const target = kept.length > 0 ? kept.reduce((a, b) => a + b, 0) / kept.length : 0;
    return { sorted, kept, dropped, target };
}

function makeBars(result: TqcResult, current: number): VisualEntity[] {
    const dropStart = result.kept.length;
    return result.sorted.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: value.toFixed(2),
        value,
        state: (i === current ? "active" : i >= dropStart ? "error" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, dropped: i >= dropStart },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<{ quantiles: number[][]; drop: number }> | null) ?? {};
    const quantiles: number[][] = Array.isArray(task.quantiles) && task.quantiles.length > 0
        ? task.quantiles
        : [
            [10, 12, 14, 16, 18],
            [11, 13, 15, 17, 19],
            [9, 12, 15, 18, 21],
        ];
    const drop = typeof task.drop === "number" ? Math.max(0, task.drop) : 3;
    const result = tqcTruncate(quantiles, drop);
    const baseMeta = {
        count: result.sorted.length,
        drop,
        kept: result.kept.length,
        target: result.target,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(result, -1),
        edges: [],
        description: `Pool ${result.sorted.length} quantiles from ${quantiles.length} critics and sort them.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...baseMeta, sorted: result.sorted },
    };
    step += 1;

    for (let i = 0; i < result.kept.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(result, i),
            edges: [],
            description: `Keep quantile ${result.sorted[i]} in the conservative average.`,
            codeLineNumber: i === 0 ? 1 : 2,
            layout: "array",
            meta: { ...baseMeta, current: i, sorted: result.sorted },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(result, -1),
        edges: [],
        description: `Done: dropping the ${drop} largest quantiles gives a target of ${result.target.toFixed(3)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...baseMeta, sorted: result.sorted, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single critic can overestimate action values because of noise and maximization bias. TQC runs several distributional critics, pools all of their quantiles, and throws away the most optimistic ones before averaging. The remaining mass gives a deliberately cautious return estimate that is less likely to be fooled by a single noisy high sample.",
        invariants: [
            "The pooled quantiles are sorted in nondecreasing order.",
            "Exactly `drop` of the largest quantiles are removed, or all of them if drop exceeds the pool size.",
            "The reported target is the arithmetic mean of the kept quantiles.",
        ],
        correctness:
            "Pooling uses a stable concatenation of each critic's sorted quantiles followed by a full numeric sort. The largest `drop` entries are sliced off and the mean of the remainder is computed directly; the tests recompute this with an independent sort and mean. Because only the largest values are removed, increasing `drop` can never increase the target, which is verified as a monotonicity property.",
        complexityRationale:
            "Pooling k critics of q quantiles gives k q values; sorting dominates at O(k q log(k q)) time and O(k q) space for the pooled array.",
        uses: [
            "Continuous-control offline and online reinforcement learning",
            "Reducing overestimation in distributional Q-learning",
            "Conservative value estimates for risk-sensitive control",
        ],
        references: [
            "Kuznetsov et al., Controlling Overestimation Bias with Truncated Mixture of Continuous Distributional Quantile Critics, ICML 2020",
            "Dabney et al., Distributional Reinforcement Learning with Quantile Regression, AAAI 2018",
        ],
        workedExample:
            "Three critics contribute fifteen quantiles ranging from 9 to 21. Dropping the three largest values 19, 21, and 18 leaves twelve values whose mean is the conservative TQC target; dropping more would lower or preserve that target but never raise it.",
    },
    id: "tqc",
    name: "Truncated Quantile Critics",
    category: "ml-ai",
    complexity: { time: "O(k q log(k q))", space: "O(k q)" },
    defaultInput: {
        quantiles: [
            [10, 12, 14, 16, 18],
            [11, 13, 15, 17, 19],
            [9, 12, 15, 18, 21],
        ],
        drop: 3,
    },
    visualType: "array",
    run,
    pseudocode: [
        "pool the quantiles from every critic",
        "sort all pooled quantiles in ascending order",
        "mark the largest drop quantiles for removal",
        "sum and average only the remaining quantiles",
        "report the conservative target value",
    ],
};

export default module;
