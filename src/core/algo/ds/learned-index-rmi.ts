/**
 * learned-index-rmi.ts - Recursive Model Index
 *
 * A learned index replaces the branching of a binary search with small linear
 * models. A first model maps a key to a bucket; a second model inside that
 * bucket predicts the key's rank in the sorted array. Because the models are
 * approximations, a short local search around the prediction finishes the
 * lookup. The error bound is measured on the training keys, so every stored
 * key is guaranteed to lie inside its search window.
 *
 * Time:  O(1) model evaluation plus O(log w) local search
 * Space: O(n + B)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LinearModel {
    slope: number;
    intercept: number;
}

export interface RmiModel {
    keys: number[];
    buckets: number;
    stage1: LinearModel;
    stage2: LinearModel[];
    window: number;
    predictions: number[];
}

/** Least-squares fit of rank against key value. */
function fit(xs: number[], ys: number[]): LinearModel {
    if (xs.length === 0) {
        return { slope: 0, intercept: 0 };
    }
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < xs.length; i += 1) {
        sx += xs[i] ?? 0;
        sy += ys[i] ?? 0;
    }
    const meanX = sx / xs.length;
    const meanY = sy / ys.length;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < xs.length; i += 1) {
        const dx = (xs[i] ?? 0) - meanX;
        numerator += dx * ((ys[i] ?? 0) - meanY);
        denominator += dx * dx;
    }
    const slope = denominator === 0 ? 0 : numerator / denominator;
    return { slope, intercept: meanY - slope * meanX };
}

function clamp(value: number, low: number, high: number): number {
    return Math.max(low, Math.min(high, value));
}

/** Train a two-stage recursive model index over sorted unique keys. */
export function buildRmi(rawKeys: number[], buckets = 4): RmiModel {
    const keys = [...new Set(rawKeys)].sort((a, b) => a - b);
    const n = keys.length;
    const bucketCount = Math.max(1, Math.trunc(buckets));
    const ranks = keys.map((_, index) => index);
    const stage1 = fit(keys, ranks);
    const assign = (key: number): number =>
        clamp(Math.floor(stage1.slope * key + stage1.intercept), 0, bucketCount - 1);

    const stage2: LinearModel[] = Array.from({ length: bucketCount }, () => ({ slope: 0, intercept: 0 }));
    for (let b = 0; b < bucketCount; b += 1) {
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i < n; i += 1) {
            if (assign(keys[i] ?? 0) === b) {
                xs.push(keys[i] ?? 0);
                ys.push(i);
            }
        }
        stage2[b] = fit(xs, ys);
    }

    const predictions = keys.map((key) => {
        const b = assign(key);
        const model = stage2[b] ?? { slope: 0, intercept: 0 };
        return clamp(Math.round(model.slope * key + model.intercept), 0, Math.max(0, n - 1));
    });
    const maxError = keys.reduce((worst, _, i) => Math.max(worst, Math.abs((predictions[i] ?? 0) - i)), 0);

    return { keys, buckets: bucketCount, stage1, stage2, window: maxError + 1, predictions };
}

/** Return the index of key, or -1 when it is absent from the model. */
export function rmiLookup(model: RmiModel, key: number): number {
    const n = model.keys.length;
    if (n === 0) {
        return -1;
    }
    const b = clamp(
        Math.floor(model.stage1.slope * key + model.stage1.intercept),
        0,
        model.buckets - 1,
    );
    const stage = model.stage2[b] ?? { slope: 0, intercept: 0 };
    const predicted = clamp(Math.round(stage.slope * key + stage.intercept), 0, n - 1);
    let lo = Math.max(0, predicted - model.window);
    let hi = Math.min(n - 1, predicted + model.window);
    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const value = model.keys[mid] ?? 0;
        if (value === key) {
            return mid;
        }
        if (value < key) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return -1;
}

function makeBars(
    keys: number[],
    predictions: number[],
    highlighted: number,
    phase: number,
): VisualEntity[] {
    return keys.map((key, index) => {
        let state: EntityState = "idle";
        if (phase === 3 && index === highlighted) {
            state = "active";
        } else if (phase >= 4) {
            state = (predictions[index] ?? 0) === index ? "sorted" : "comparing";
        } else if (phase >= 2) {
            state = "visited";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: phase >= 3 ? `${key}->${predictions[index]}` : String(key),
            value: key,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, key, prediction: predictions[index] ?? 0 },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { keys?: number[]; buckets?: number; query?: number } | null
    ) ?? {};
    const rawKeys = Array.isArray(task.keys) && task.keys.length > 0
        ? task.keys.map((value) => Math.trunc(value))
        : [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
    const buckets = typeof task.buckets === "number" ? Math.max(1, Math.trunc(task.buckets)) : 4;
    const query = typeof task.query === "number" ? Math.trunc(task.query) : 70;
    const model = buildRmi(rawKeys, buckets);
    const keys = model.keys;
    const predictions = model.predictions;
    const zeroPredictions = keys.map(() => 0);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(keys, zeroPredictions, -1, 0),
        edges: [],
        description: `Sorted array of ${keys.length} keys awaiting a learned two-stage index.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { count: keys.length, buckets, phase: "init", predictions: [] as number[] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(keys, zeroPredictions, -1, 1),
        edges: [],
        description: `Stage one fits rank = ${model.stage1.slope.toFixed(3)} * key + ${model.stage1.intercept.toFixed(3)} to map keys into ${buckets} bucket(s).`,
        codeLineNumber: 1,
        layout: "array",
        meta: {
            count: keys.length,
            buckets,
            phase: "stage1",
            slope: model.stage1.slope,
            intercept: model.stage1.intercept,
            predictions: [] as number[],
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(keys, zeroPredictions, -1, 2),
        edges: [],
        description: `Each bucket now holds its own linear model predicting the rank inside that bucket.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { count: keys.length, buckets, phase: "stage2", predictions: [] as number[] },
    };
    step += 1;

    for (let i = 0; i < keys.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(keys, predictions, i, 3),
            edges: [],
            description: `Key ${keys[i]} is predicted at rank ${predictions[i]}; the true rank is ${i}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                count: keys.length,
                buckets,
                phase: "predict",
                key: keys[i] ?? 0,
                prediction: predictions[i] ?? 0,
                actual: i,
                predictions: [] as number[],
            },
        };
        step += 1;
    }

    const found = rmiLookup(model, query);
    const maxError = keys.reduce((worst, _, i) => Math.max(worst, Math.abs((predictions[i] ?? 0) - i)), 0);
    yield {
        stepNumber: step,
        entities: makeBars(keys, predictions, -1, 4),
        edges: [],
        description:
            `Maximum training error is ${maxError}, so a window of ${model.window} suffices. ` +
            `Lookup of ${query} returned index ${found}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            count: keys.length,
            buckets,
            phase: "done",
            query,
            found,
            maxError,
            window: model.window,
            predictions,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A binary search ignores the actual key values and always splits in the middle. A learned index instead fits a simple line from keys to ranks: if the keys are roughly evenly spaced, that line nearly tells you where a key lives. A second set of lines refines the guess inside small buckets, and a tiny local search corrects any remaining error.",
        invariants: [
            "The training keys are sorted and unique, so each has one true rank.",
            "Every prediction is clamped into the valid rank range zero to n minus one.",
            "The search window is one larger than the largest training error.",
        ],
        correctness:
            "For every training key the true rank is at most maxError away from its predicted rank, and the window is maxError plus one, so binary search over that window contains the key and returns its correct index. If a queried value is not present, the local binary search finds no equal key and returns minus one. The models only narrow the search; they never remove a candidate that could be the answer.",
        complexityRationale:
            "Training fits one line over n keys and then one line per bucket, costing O(n + B). A lookup evaluates two lines and binary-searches a window of width w, costing O(log w), with the window typically a small constant. Space holds the n keys, n predictions, and B models, so O(n + B).",
        uses: [
            "Range indexes in read-heavy key-value stores",
            "Replacing binary search on static sorted arrays",
            "Teaching the difference between model-based and comparison-based search",
        ],
        references: [
            "Kraska et al., The Case for Learned Index Structures, 2018",
            "Ferragina and Vinciguerra, Learned Indexes: A Tutorial, 2020",
        ],
        workedExample:
            "For keys 10 through 120 in steps of ten with four buckets, the first line maps key 70 to bucket two. The second line in that bucket predicts rank six for 70, which is exactly its true rank. With a window of one, the local search starts at index six and immediately finds 70.",
    },
    id: "learned-index-rmi",
    name: "Learned Index (Recursive Model Index)",
    category: "data-structures",
    complexity: { time: "O(log w) lookup", space: "O(n + B)" },
    defaultInput: {
        keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
        buckets: 4,
        query: 70,
    },
    visualType: "array",
    run,
    pseudocode: [
        "sort and deduplicate the input keys",
        "fit a first linear model from key value to rank",
        "map every key to a bucket using that model",
        "fit one linear model per bucket on its member keys",
        "measure the largest prediction error on training keys",
        "for a query evaluate the first model to choose a bucket",
        "evaluate that bucket's model to predict a rank",
        "binary search only inside the bounded error window",
        "return the matching index or minus one when absent",
    ],
};

export default module;
