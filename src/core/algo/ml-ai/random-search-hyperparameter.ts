/**
 * random-search-hyperparameter.ts - Random Search for Hyperparameter Tuning
 *
 * Random search samples configurations independently and uniformly from a
 * bounded box, evaluates each, and keeps the best one seen. It is a simple,
 * embarrassingly parallel alternative to grid search that spends its budget on
 * distinct values of every hyperparameter instead of repeating combinations.
 *
 * Time is O(samples * dim); space is O(samples * dim) for the sampled history.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic mulberry32 pseudo-random generator. */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Sphere objective: squared distance from a target configuration (minimize). */
export function sphereObjective(config: number[], center: number[]): number {
    return config.reduce((sum, x, i) => sum + (x - (center[i] ?? 0)) ** 2, 0);
}

export interface SearchSample {
    config: number[];
    value: number;
}

export interface SearchResult {
    bestConfig: number[];
    bestValue: number;
    history: SearchSample[];
}

/** Sample `count` uniform configurations and keep the lowest objective value. */
export function randomSearch(
    center: number[],
    bounds: [number, number],
    count: number,
    seed: number,
): SearchResult {
    const dim = Math.max(1, center.length);
    const rand = mulberry32(seed);
    const [lo, hi] = bounds;
    const history: SearchSample[] = [];
    let bestConfig = Array.from({ length: dim }, () => 0);
    let bestValue = Infinity;
    for (let s = 0; s < count; s += 1) {
        const config = Array.from({ length: dim }, () => lo + rand() * (hi - lo));
        const value = sphereObjective(config, center);
        history.push({ config, value });
        if (value < bestValue) {
            bestValue = value;
            bestConfig = [...config];
        }
    }
    return { bestConfig, bestValue, history };
}

function makePoints(history: SearchSample[], bestIndex: number, center: number[]): VisualEntity[] {
    const entities: VisualEntity[] = history.map((sample, i) => ({
        id: `sample-${i}`,
        type: "node" as const,
        label: `f=${sample.value.toFixed(3)}`,
        value: sample.config,
        state: (i === bestIndex ? "sorted" : "visited") as EntityState,
        x: sample.config[0] ?? 0,
        y: sample.config[1] ?? 0,
        width: 0,
        height: 0,
        metadata: { index: i, value: sample.value },
    }));
    entities.push({
        id: "optimum",
        type: "node",
        label: "optimum",
        value: center,
        state: "pivot",
        x: center[0] ?? 0,
        y: center[1] ?? 0,
        width: 0,
        height: 0,
        metadata: { optimum: true },
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            center?: number[];
            bounds?: [number, number];
            samples?: number;
            seed?: number;
        } | null
    ) ?? {};
    const center: number[] = task.center ?? [1.5, -1.5];
    const bounds: [number, number] =
        Array.isArray(task.bounds) && task.bounds.length === 2 ? task.bounds : [-2, 2];
    const count = typeof task.samples === "number" ? Math.max(1, Math.floor(task.samples)) : 12;
    const seed = typeof task.seed === "number" ? task.seed : 42;
    const result = randomSearch(center, bounds, count, seed);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makePoints([], -1, center),
        edges: [],
        description: `Random search over a ${center.length}-dimensional box [${bounds[0]}, ${bounds[1]}] with ${count} trials and seed ${seed}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { samples: 0, bestValue: Infinity, bounds, seed },
    };
    step += 1;

    let bestValue = Infinity;
    let bestIndex = -1;
    for (let i = 0; i < result.history.length; i += 1) {
        const sample = result.history[i]!;
        const isImprovement = sample.value < bestValue;
        if (isImprovement) {
            bestValue = sample.value;
            bestIndex = i;
        }
        yield {
            stepNumber: step,
            entities: makePoints(result.history.slice(0, i + 1), bestIndex, center),
            edges: [],
            description: `Trial ${i + 1}: configuration [${sample.config.map((v) => v.toFixed(2)).join(", ")}] scores ${sample.value.toFixed(4)}; best so far ${bestValue.toFixed(4)}.`,
            codeLineNumber: isImprovement ? 3 : 2,
            layout: "point",
            meta: { samples: i + 1, bestValue, bestConfig: result.history[bestIndex]!.config, bounds, seed },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makePoints(result.history, bestIndex, center),
        edges: [],
        description: `Best of ${count} random configurations is [${result.bestConfig.map((v) => v.toFixed(3)).join(", ")}] with objective ${result.bestValue.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { converged: true, samples: count, bestValue: result.bestValue, bestConfig: result.bestConfig, bounds, seed },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Grid search wastes evaluations repeating the same value of one hyperparameter while changing another. Random search instead draws each configuration independently from a distribution over the hyperparameter box. In high dimensions that simple change covers far more distinct settings per evaluation, and it is trivial to parallelize because trials do not depend on one another.",
        invariants: [
            "Every sampled configuration lies componentwise inside the supplied bounds.",
            "Trials are independent draws, so the same seed reproduces the whole search.",
            "The reported best configuration is the minimizer of the objective over all sampled trials.",
        ],
        correctness:
            "For each trial the generator draws uniform coordinates and evaluates the objective, updating the running best only on a strict improvement, so the final answer is exactly the minimum of the recorded history. The tests recompute that minimum with an independent scan, verify the bounds, and confirm that identical seeds give identical trials. As the number of trials grows, the best sampled value converges to the box optimum because the sampling distribution has full support.",
        complexityRationale:
            "Each of the count trials draws dim numbers and computes a dim-length objective, so time is O(count * dim). Storing the full history for the visualization uses O(count * dim) space; a production implementation needs only the current best.",
        uses: [
            "Tuning learning rates, depths, and regularization strengths",
            "Baseline comparison for more sophisticated tuning methods",
            "Parallel hyperparameter sweeps on compute clusters",
        ],
        references: [
            "Bergstra and Bengio, Random Search for Hyper-Parameter Optimization, JMLR 2012",
            "Li et al., Hyperband, ICLR 2017",
        ],
        workedExample:
            "Searching a two-dimensional box [-2, 2] for the minimum of (x - 1)^2 + (y + 1)^2 with 12 seeded trials might sample (1.4, -0.8) with value 0.2. Even though it never samples the exact optimum (1, -1), the best trial lands close, and every other trial's value is at least as large.",
    },
    id: "random-search-hyperparameter",
    name: "Random Search Hyperparameter Tuning",
    category: "ml-ai",
    complexity: { time: "O(samples * dim)", space: "O(samples * dim)" },
    defaultInput: { center: [1.5, -1.5], bounds: [-2, 2], samples: 12, seed: 42 },
    visualType: "point",
    run,
    pseudocode: [
        "choose a distribution and a budget of trials",
        "for each trial",
        "draw one configuration independently from the distribution",
        "evaluate the objective on that configuration",
        "keep it as the best when its value improves the record",
        "done: report the best configuration found",
    ],
};

export default module;
