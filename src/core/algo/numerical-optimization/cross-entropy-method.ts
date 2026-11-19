/**
 * cross-entropy-method.ts - Cross-Entropy Method for Continuous Optimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The cross-entropy method optimizes a black-box function by maintaining a
 * probability distribution over candidate solutions. Each iteration samples a
 * batch of candidates, keeps the best elite fraction, and refits the sampling
 * distribution to those elites. Repeating this concentrates samples near the
 * optimum without needing gradients. This implementation uses a diagonal
 * Gaussian with a reproducible pseudo-random generator.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(iterations * samples * dimension) evaluations and updates
 *   Space: O(iterations * elites * dimension) for the recorded elite sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Points show the elite samples of each iteration; green means elite.
 *   - The mean of the current distribution is drawn as a pivot.
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** A small deterministic pseudo-random generator for reproducible runs. */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return (): number => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export interface CEMIteration {
    iteration: number;
    mean: number[];
    sigma: number[];
    bestValue: number;
    elites: number[][];
}

export interface CEMResult {
    best: number[];
    bestValue: number;
    mean: number[];
    sigma: number[];
    history: CEMIteration[];
}

export interface CEMOptions {
    mean?: number[];
    sigma?: number[];
    samples?: number;
    elite?: number;
    iterations?: number;
    seed?: number;
}

/** Optimize an objective by iteratively refitting a Gaussian to elite samples. */
export function crossEntropy(
    objective: (point: number[]) => number,
    dimension: number,
    options: CEMOptions = {},
): CEMResult {
    const dim = Math.max(1, Math.floor(dimension));
    const mean = Array.from({ length: dim }, (_, i) => options.mean?.[i] ?? 0);
    const sigma = Array.from({ length: dim }, (_, i) => options.sigma?.[i] ?? 1);
    const samples = Math.max(2, Math.floor(options.samples ?? 40));
    const eliteFraction = Math.min(0.9, Math.max(0.05, options.elite ?? 0.2));
    const iterations = Math.max(1, Math.floor(options.iterations ?? 20));
    const rng = mulberry32(options.seed ?? 42);
    const floor = 1e-3;
    let best = [...mean];
    let bestValue = objective(best);
    const history: CEMIteration[] = [];

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const candidates: Array<{ point: number[]; value: number }> = [];
        for (let s = 0; s < samples; s += 1) {
            const point: number[] = [];
            for (let d = 0; d < dim; d += 1) {
                const u = Math.max(rng(), 1e-12);
                const v = rng();
                const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
                point.push((mean[d] ?? 0) + (sigma[d] ?? 1) * z);
            }
            const value = objective(point);
            if (value < bestValue) {
                bestValue = value;
                best = [...point];
            }
            candidates.push({ point, value });
        }

        candidates.sort((a, b) => a.value - b.value);
        const eliteCount = Math.max(2, Math.floor(samples * eliteFraction));
        const elites = candidates.slice(0, eliteCount).map((c) => c.point);
        for (let d = 0; d < dim; d += 1) {
            let sum = 0;
            for (const point of elites) { sum += point[d] ?? 0; }
            const newMean = sum / elites.length;
            let variance = 0;
            for (const point of elites) { variance += ((point[d] ?? 0) - newMean) ** 2; }
            mean[d] = newMean;
            sigma[d] = Math.max(floor, Math.sqrt(variance / elites.length));
        }

        history.push({
            iteration,
            mean: [...mean],
            sigma: [...sigma],
            bestValue,
            elites: elites.map((point) => [...point]),
        });
    }
    return { best, bestValue, mean, sigma, history };
}

function makePoints(elites: number[][], mean: number[]): VisualEntity[] {
    const entities: VisualEntity[] = elites.map((point, index) => ({
        id: `elite-${index}`,
        type: "node" as const,
        label: `(${point[0]?.toFixed(2) ?? "0"}, ${point[1]?.toFixed(2) ?? "0"})`,
        value: point,
        state: "sorted" as const,
        x: point[0] ?? 0,
        y: point[1] ?? 0,
        width: 0,
        height: 0,
        metadata: { index, x: point[0] ?? 0, y: point[1] ?? 0 },
    }));
    entities.push({
        id: "mean",
        type: "node",
        label: `mean (${mean[0]?.toFixed(2) ?? "0"}, ${mean[1]?.toFixed(2) ?? "0"})`,
        value: [...mean],
        state: "pivot",
        x: mean[0] ?? 0,
        y: mean[1] ?? 0,
        width: 0,
        height: 0,
        metadata: { role: "mean" },
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { samples?: number; elite?: number; iterations?: number; seed?: number; centerX?: number; centerY?: number } | null) ?? {};
    const centerX = typeof task.centerX === "number" ? task.centerX : 2;
    const centerY = typeof task.centerY === "number" ? task.centerY : -1;
    const samples = Math.min(80, Math.max(4, Math.floor(Number(task.samples ?? 30)) || 30));
    const elite = Math.min(0.8, Math.max(0.1, typeof task.elite === "number" ? task.elite : 0.2));
    const iterations = Math.min(40, Math.max(1, Math.floor(Number(task.iterations ?? 12)) || 12));
    const seed = typeof task.seed === "number" ? task.seed : 42;
    const objective = (point: number[]): number =>
        ((point[0] ?? 0) - centerX) ** 2 + ((point[1] ?? 0) - centerY) ** 2;
    const result = crossEntropy(objective, 2, { samples, elite, iterations, seed, mean: [0, 0], sigma: [3, 3] });
    let step = 0;

    yield {
        stepNumber: step,
        entities: makePoints([], [0, 0]),
        edges: [],
        description: `Cross-entropy search for the minimum of a sphere centered at (${centerX}, ${centerY}) with ${samples} samples per iteration.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { iterations, samples, elite, bestValue: result.bestValue, iteration: 0 },
    };
    step += 1;

    for (const entry of result.history) {
        yield {
            stepNumber: step,
            entities: makePoints(entry.elites, entry.mean),
            edges: [],
            description: `Iteration ${entry.iteration}: elite mean (${entry.mean[0]?.toFixed(3)}, ${entry.mean[1]?.toFixed(3)}), best value ${entry.bestValue.toFixed(6)}.`,
            codeLineNumber: 4,
            layout: "point",
            meta: { iterations, samples, elite, iteration: entry.iteration, bestValue: entry.bestValue, meanX: entry.mean[0] ?? 0, meanY: entry.mean[1] ?? 0 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makePoints(result.history[result.history.length - 1]?.elites ?? [], result.best),
        edges: [],
        description: `Best point (${result.best[0]?.toFixed(5)}, ${result.best[1]?.toFixed(5)}) with objective ${result.bestValue.toFixed(8)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { iterations, samples, elite, iteration: result.history.length, best: result.best, bestValue: result.bestValue },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The cross-entropy method treats optimization as a learning problem. It keeps a distribution over candidate answers, samples a batch from it, keeps the best few, and then adjusts the distribution to look like those winners. At first samples scatter widely; over iterations the distribution tightens and drifts toward the optimum. Because it only needs objective values, it works on black-box problems with no derivatives.",
        invariants: [
            "Each iteration keeps only the elite fraction of samples with the lowest objective values.",
            "The new mean and standard deviation are computed from those elites in every coordinate.",
            "The best objective value seen never increases across iterations.",
        ],
        correctness:
            "Refitting the Gaussian to the elite samples is equivalent to minimizing the cross-entropy between the current sampling distribution and an ideal distribution concentrated on near-optimal points, so each update moves probability mass toward better solutions. With a fixed elite fraction and a variance floor the sequence of best values is non-increasing. Tests confirm convergence to the known center of a quadratic sphere, monotonic best values, reproducibility under a fixed seed, and an objective value at least as good as a brute-force grid search.",
        complexityRationale:
            "Each iteration draws samples in every dimension, evaluates the objective once per sample, and updates mean and variance from the elites, so time is O(iterations times samples times dimension). Storing elite sets for the visualization uses O(iterations times elites times dimension) space.",
        uses: [
            "Derivative-free optimization of black-box simulation objectives",
            "Rare-event probability estimation and importance sampling",
            "Parameter tuning where evaluations are expensive but parallelizable",
        ],
        references: [
            "Rubinstein and Kroese, The Cross-Entropy Method, 2004",
            "Botev, Kroese and Rubinstein, Cross-Entropy Method for Optimization, 2013",
        ],
        workedExample:
            "To minimize (x-2)^2+(y+1)^2, start sampling from a Gaussian centered at the origin with standard deviation three. Keep the best twenty percent of thirty samples, set the new center to their mean, and shrink the spread to their standard deviation. After a dozen iterations the center is close to (2, -1) and the best value is near zero.",
    },
    id: "cross-entropy-method",
    name: "Cross-Entropy Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * samples * dim)", space: "O(iterations * elites * dim)" },
    defaultInput: { centerX: 2, centerY: -1, samples: 30, elite: 0.2, iterations: 12, seed: 42 },
    visualType: "point",
    run,
    pseudocode: [
        "choose an initial mean and spread for the sampling distribution",
        "for each iteration sample a batch of candidate points",
        "evaluate the objective at every candidate",
        "keep the elite fraction with the smallest objective values",
        "set the new mean to the elite mean in each coordinate",
        "set the new spread to the elite standard deviation with a floor",
        "track the best point seen across all iterations",
        "done: report the best point and its objective value",
    ],
};

export default module;
