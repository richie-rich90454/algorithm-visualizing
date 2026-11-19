/**
 * ddsketch.ts - DDSketch (relative-error quantile sketch)
 *
 * DDSketch stores values in buckets whose boundaries grow geometrically with
 * ratio gamma = (1 + alpha) / (1 - alpha). A value v lands in bucket
 * ceil(log_gamma(v)), so every value in a bucket is within alpha relative
 * error of the bucket center. Counting the buckets gives quantile estimates
 * with a guaranteed relative error instead of an additive one.
 *
 * Time:  O(n) build, O(b log b) to sort buckets for a quantile
 * Space: O(b) for b nonempty buckets
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Sketch {
    positive: Map<number, number>;
    negative: Map<number, number>;
    zero: number;
    count: number;
}

function emptySketch(): Sketch {
    return { positive: new Map(), negative: new Map(), zero: 0, count: 0 };
}

function add(sketch: Sketch, value: number, logGamma: number): void {
    if (value > 0) {
        const i = Math.ceil(Math.log(value) / logGamma);
        sketch.positive.set(i, (sketch.positive.get(i) ?? 0) + 1);
    } else if (value < 0) {
        const i = Math.ceil(Math.log(-value) / logGamma);
        sketch.negative.set(i, (sketch.negative.get(i) ?? 0) + 1);
    } else {
        sketch.zero += 1;
    }
    sketch.count += 1;
}

function sortedKeys(map: Map<number, number>, descending: boolean): number[] {
    return [...map.keys()].sort((a, b) => (descending ? b - a : a - b));
}

/** Lower-biased nearest-rank quantile over the whole sketch. */
function quantile(sketch: Sketch, gamma: number, q: number): number {
    const rank = Math.ceil(q * sketch.count);
    let remaining = rank;
    const negKeys = sortedKeys(sketch.negative, true);
    for (const key of negKeys) {
        const c = sketch.negative.get(key) ?? 0;
        if (remaining <= c) return -Math.pow(gamma, key - 0.5);
        remaining -= c;
    }
    if (remaining <= sketch.zero) return 0;
    remaining -= sketch.zero;
    for (const key of sortedKeys(sketch.positive, false)) {
        const c = sketch.positive.get(key) ?? 0;
        if (remaining <= c) return Math.pow(gamma, key - 0.5);
        remaining -= c;
    }
    return Math.pow(gamma, (sortedKeys(sketch.positive, false).pop() ?? 0) - 0.5);
}

/** Exact nearest-rank quantile for the oracle comparison. */
function exactQuantile(sorted: number[], q: number): number {
    const index = Math.max(0, Math.ceil(q * sorted.length) - 1);
    return sorted[index] ?? 0;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; quantiles?: number[]; alpha?: number } | null) ?? {};
    const values = Array.isArray(task.values) && task.values.length > 0
        ? [...task.values]
        : [1.1, 1.5, 2.2, 3.1, 4.7, 6.3, 8.8, 12.4, 18.1, 26.7, 40.2, 61.5];
    const qs = Array.isArray(task.quantiles) && task.quantiles.length > 0 ? task.quantiles : [0.5, 0.9, 0.99];
    const alpha = typeof task.alpha === "number" && task.alpha > 0 && task.alpha < 1 ? task.alpha : 0.01;
    const gamma = (1 + alpha) / (1 - alpha);
    const logGamma = Math.log(gamma);
    const sketch = emptySketch();
    let step = 0;

    const cells = (hot: number | null): VisualEntity[] => {
        const keys = sortedKeys(sketch.positive, false);
        if (keys.length === 0) {
            return [
                {
                    id: "dd-empty",
                    type: "cell" as const,
                    label: "(empty)",
                    value: 0,
                    state: "idle" as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: 0, col: 0 },
                },
            ];
        }
        return keys.map((key, col) => {
            const center = Math.pow(gamma, key - 0.5);
            const state: EntityState = hot === key ? "comparing" : "idle";
            return {
                id: `dd-${key}`,
                type: "cell" as const,
                label: `${center.toFixed(1)}:${sketch.positive.get(key) ?? 0}`,
                value: center,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col, bucket: key, count: sketch.positive.get(key) ?? 0 },
            };
        });
    };

    yield {
        stepNumber: step,
        entities: cells(null),
        edges: [],
        description: `Empty DDSketch; gamma is ${gamma.toFixed(4)} for alpha ${alpha}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { values: 0, buckets: 0, alpha },
    };
    step += 1;

    for (const value of values) {
        add(sketch, value, logGamma);
        const key = value > 0 ? Math.ceil(Math.log(value) / logGamma) : null;
        yield {
            stepNumber: step,
            entities: cells(key),
            edges: [],
            description: `Added ${value}; bucket ${key ?? "zero/negative"} now holds the value with relative error at most alpha.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { values: sketch.count, buckets: sketch.positive.size, lastKey: key ?? 0 },
        };
        step += 1;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const approx = qs.map((q) => quantile(sketch, gamma, q));
    const exact = qs.map((q) => exactQuantile(sorted, q));
    let maxRel = 0;
    approx.forEach((a, i) => {
        const e = exact[i] ?? 0;
        if (e !== 0) maxRel = Math.max(maxRel, Math.abs(a - e) / Math.abs(e));
    });
    yield {
        stepNumber: step,
        entities: cells(null).map((entity) => ({ ...entity, state: "sorted" as EntityState })),
        edges: [],
        description: `Estimated ${qs.length} quantile(s) with maximum relative error ${maxRel.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            quantiles: qs,
            approx,
            exact,
            maxRelError: maxRel,
            buckets: sketch.positive.size,
            values: sketch.count,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of remembering every value, DDSketch sorts values into buckets whose edges grow by a fixed ratio. Because the ratio is chosen from the target relative accuracy, a bucket's center is always close to any member in relative terms. Counting how many values fall in each bucket is enough to answer quantiles with a guarantee stated as a percentage of the true value, which matters for latencies that span orders of magnitude.",
        invariants: [
            "Every stored value is within alpha relative error of its bucket center.",
            "The counts across all buckets, the negative store, and the zero store sum to the number of added values.",
            "Quantiles are estimated from cumulative bucket counts in sorted bucket order.",
        ],
        correctness:
            "A value v in bucket i satisfies gamma to the power i-1 < v <= gamma to the power i, so the geometric center gamma to the power i-0.5 has relative error at most (sqrt(gamma) - 1), which is bounded by alpha for the chosen gamma. Ranking buckets by cumulative count returns the same rank as ranking the raw values, so the selected bucket is the correct one and its center inherits the relative error bound.",
        complexityRationale:
            "Adding a value computes one logarithm and updates one bucket, O(1). Sorting the b nonempty buckets costs O(b log b) per quantile, with b much smaller than n in practice. Storage is O(b), independent of the stream length at fixed accuracy.",
        uses: [
            "Latency percentile tracking in monitoring and observability systems",
            "Streaming analytics where data arrives once and cannot be re-sorted",
            "Distributed aggregations that merge sketches by adding bucket counts",
        ],
        references: [
            "Masson, DDSketch: A Fast and Fully-Mergeable Quantile Sketch with Relative-Error Guarantees, 2019",
            "Cormode, Sketches and Coresets for Big Data, 2020",
        ],
        workedExample:
            "With alpha 0.01, gamma is about 1.0202. The value 4.7 maps to ceil(log_gamma 4.7) = 79 and raises that bucket's count to one. After twelve values, the median is found by walking buckets until the cumulative count passes six, then reporting that bucket's geometric center, which differs from the exact median by well under one percent.",
    },
    id: "ddsketch",
    name: "DDSketch",
    category: "data-structures",
    complexity: { time: "O(n) build", space: "O(b) buckets" },
    defaultInput: {
        values: [1.1, 1.5, 2.2, 3.1, 4.7, 6.3, 8.8, 12.4, 18.1, 26.7, 40.2, 61.5],
        quantiles: [0.5, 0.9, 0.99],
        alpha: 0.01,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose relative accuracy alpha and compute gamma",
        "for each value map it to a logarithmic bucket index",
        "increment the count stored in that bucket",
        "route zero and negative values to their own stores",
        "to answer a quantile rank buckets by cumulative count",
        "find the bucket whose cumulative count passes the rank",
        "estimate its value as the geometric center of the bucket",
        "repeat for each quantile and report the estimates",
    ],
};

export default module;
