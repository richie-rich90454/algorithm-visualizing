/**
 * cma-es.ts - Covariance Matrix Adaptation Evolution Strategy
 *
 * CMA-ES is a derivative-free optimizer for continuous functions. Each
 * generation it samples a population from a Gaussian distribution centered at
 * the current best estimate, recombines the best samples into a new mean, and
 * adapts both the step size and the shape of the sampling distribution. The
 * cumulative evolution paths remember successful directions over many
 * generations, which lets the method follow curved valleys that a simple
 * random search cannot.
 *
 * This implementation keeps a diagonal covariance matrix, the standard cheap
 * variant for problems whose main difficulty is differing scales along the
 * coordinate axes. A fixed-seed generator makes every replay deterministic.
 *
 * Time O(generations * population * dimension); space O(population).
 *
 * Visualization: sample points are shown with the current mean and the true
 * target. The best sample is green, the mean is marked, and the final frame
 * reports the best objective found.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CmaInput {
    targetX?: number;
    targetY?: number;
    condition?: number;
    startX?: number;
    startY?: number;
    generations?: number;
    seed?: number;
}

interface Sample {
    point: number[];
    value: number;
}

/** Small deterministic pseudo-random generator so replays are identical. */
function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Standard normal sample from two uniform draws. */
function gaussian(random: () => number): number {
    const u = Math.max(1e-12, random());
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function makeEntities(samples: Sample[], mean: number[], target: number[]): VisualEntity[] {
    const entities: VisualEntity[] = samples.map((sample, index) => ({
        id: `sample-${index}`,
        type: "node" as const,
        label: sample.value.toFixed(2),
        value: sample.value,
        state: (index === 0 ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { kind: "sample", x: sample.point[0] ?? 0, y: sample.point[1] ?? 0, rank: index },
    }));
    entities.push({
        id: "mean",
        type: "node" as const,
        label: "mean",
        value: 0,
        state: "pivot",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { kind: "mean", x: mean[0] ?? 0, y: mean[1] ?? 0 },
    });
    entities.push({
        id: "target",
        type: "node" as const,
        label: "target",
        value: 0,
        state: "sorted",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { kind: "target", x: target[0] ?? 0, y: target[1] ?? 0 },
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CmaInput | null) ?? {};
    const target = [Number(task.targetX ?? 1), Number(task.targetY ?? -2)];
    const condition = Math.max(0.1, Number(task.condition ?? 4) || 4);
    const objective = (x: number, y: number): number => {
        const dx = x - (target[0] ?? 0);
        const dy = y - (target[1] ?? 0);
        return dx * dx + condition * dy * dy;
    };
    const generations = Math.max(1, Math.min(300, Math.floor(Number(task.generations ?? 60)) || 60));
    const random = makeRandom(Math.floor(Number(task.seed ?? 2026)) || 2026);
    const lambda = 8;
    const mu = 4;
    const rawWeights = Array.from({ length: mu }, (_, index) => Math.log(mu + 1) - Math.log(index + 1));
    const weightSum = rawWeights.reduce((sum, value) => sum + value, 0);
    const weights = rawWeights.map((value) => value / weightSum);
    const effectiveMass = 1 / weights.reduce((sum, value) => sum + value * value, 0);
    const cSigma = (effectiveMass + 2) / (2 + effectiveMass + 5);
    const dSigma = 1 + 2 * Math.max(0, Math.sqrt((effectiveMass - 1) / 3) - 1) + cSigma;
    const cC = 4 / (2 + 4);
    const c1 = 2 / ((2 + 1.3) * (2 + 1.3) + effectiveMass);
    const cMu = Math.min(1 - c1, (2 * (effectiveMass - 2)) / ((2 + 2) * (2 + 2) + effectiveMass));
    const expectedNorm = 1.2533;

    let mean = [Number(task.startX ?? -2), Number(task.startY ?? 3)];
    let sigma = 1.5;
    let variance = [1, 1];
    let pathSigma = [0, 0];
    let pathC = [0, 0];
    let best = { point: [...mean], value: objective(mean[0] ?? 0, mean[1] ?? 0) };
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities([], mean, target),
        edges: [],
        description: `CMA-ES starts at (${mean.map((v) => v.toFixed(2)).join(", ")}) with step size ${sigma.toFixed(2)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { generation: 0, bestValue: best.value, mean: [...mean], sigma, variances: [...variance] },
    };
    step += 1;

    for (let generation = 1; generation <= generations; generation += 1) {
        const samples: Sample[] = [];
        for (let k = 0; k < lambda; k += 1) {
            const x = (mean[0] ?? 0) + sigma * Math.sqrt(variance[0] ?? 1) * gaussian(random);
            const y = (mean[1] ?? 0) + sigma * Math.sqrt(variance[1] ?? 1) * gaussian(random);
            samples.push({ point: [x, y], value: objective(x, y) });
        }
        samples.sort((a, b) => a.value - b.value);
        if ((samples[0]?.value ?? Infinity) < best.value) {
            best = { point: [...(samples[0]?.point ?? mean)], value: samples[0]?.value ?? best.value };
        }

        const oldMean = [...mean];
        const newMean = [0, 1].map((axis) =>
            weights.reduce((sum, weight, index) => sum + weight * (samples[index]?.point[axis] ?? 0), 0),
        );
        const standardized = newMean.map((value, axis) =>
            ((value - (oldMean[axis] ?? 0)) / sigma) / Math.sqrt(variance[axis] ?? 1),
        );
        pathSigma = pathSigma.map((value, axis) =>
            (1 - cSigma) * value + Math.sqrt(cSigma * (2 - cSigma) * effectiveMass) * standardized[axis]!,
        );
        pathC = pathC.map((value, axis) =>
            (1 - cC) * value + Math.sqrt(cC * (2 - cC) * effectiveMass) * standardized[axis]!,
        );
        const pathNorm = Math.hypot(pathSigma[0] ?? 0, pathSigma[1] ?? 0);
        sigma *= Math.exp((cSigma / dSigma) * (pathNorm / expectedNorm - 1));
        sigma = Math.max(1e-6, Math.min(10, sigma));
        variance = variance.map((value, axis) => {
            const rankMu = weights.reduce((sum, weight, index) => {
                const sample = samples[index]?.point[axis] ?? 0;
                const stepAxis = (sample - (oldMean[axis] ?? 0)) / sigma / Math.sqrt(value);
                return sum + weight * stepAxis * stepAxis;
            }, 0);
            const pathValue = pathC[axis] ?? 0;
            const next = (1 - c1 - cMu) * value + c1 * pathValue * pathValue + cMu * rankMu;
            return Math.max(1e-8, next);
        });
        mean = newMean;

        if (generation % 5 === 0 || generation === 1 || generation === generations) {
            yield {
                stepNumber: step,
                entities: makeEntities(samples, mean, target),
                edges: [],
                description: `Generation ${generation}: best sample ${(samples[0]?.value ?? 0).toFixed(4)}, step size ${sigma.toFixed(3)}.`,
                codeLineNumber: generation === 1 ? 2 : generation === generations ? 8 : 5,
                layout: "point",
                meta: {
                    generation,
                    bestValue: best.value,
                    mean: [...mean],
                    sigma,
                    variances: [...variance],
                    bestPoint: [...best.point],
                    completed: generation === generations,
                },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeEntities([{ point: best.point, value: best.value }], mean, target),
        edges: [],
        description: `CMA-ES finished at (${best.point.map((v) => v.toFixed(3)).join(", ")}) with objective ${best.value.toFixed(6)}.`,
        codeLineNumber: 8,
        layout: "point",
        meta: { generation: generations, bestValue: best.value, mean: [...mean], sigma, variances: [...variance], bestPoint: [...best.point], completed: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of following a gradient, CMA-ES watches which sampled points did well and reshapes its search distribution around them. Two memory paths record where successful steps pointed over many generations. One path stretches or shrinks the global step size; the other widens the distribution along directions that keep paying off, which is how the method learns a tilted, narrow valley.",
        invariants: [
            "Every sample is drawn from a Gaussian centered at the current mean with positive variances.",
            "The recombination weights are positive and sum to one, so the new mean lies in the convex hull of the best samples.",
            "The recorded best value is the minimum objective seen so far and never increases.",
        ],
        correctness:
            "The weighted mean is the maximum-likelihood estimate of the gaussian center given the selected elite samples. The evolution paths are exponentially weighted sums of successful steps, so their squared lengths estimate the variance that would be expected under a random search; scaling the step size to match that expectation keeps the success rate near a fixed fraction. The covariance update is a rank-one plus rank-mu estimate of the directions of selected steps, which is the CMA update restricted to a diagonal matrix.",
        complexityRationale:
            "Each generation draws a fixed population, evaluates the objective once per sample, sorts them, and performs a constant number of vector operations, so the work is O(generations * population * dimension). Only the population and a few vectors are kept, giving O(population) extra space.",
        uses: [
            "Tuning hyperparameters when gradients are unavailable or noisy",
            "Optimizing simulator parameters in computational science",
            "Evolutionary robotics and game-agent parameter search",
        ],
        references: [
            "Hansen and Ostermeier, Completely Derandomized Self-Adaptation in Evolution Strategies, 2001",
            "Hansen, The CMA Evolution Strategy: A Comparing Review, 2006",
        ],
        workedExample:
            "On the bowl (x-1)^2 + 4(y+2)^2 the optimum is at (1,-2). From a start at (-2,3) the population drifts toward the target, the variance along y shrinks faster than along x, and after a few dozen generations the reported best point lands within a few hundredths of the optimum.",
    },
    id: "cma-es",
    name: "CMA-ES",
    category: "numerical-optimization",
    complexity: { time: "O(generations * population * dim)", space: "O(population)" },
    defaultInput: { targetX: 1, targetY: -2, condition: 4, startX: -2, startY: 3, generations: 60, seed: 2026 },
    visualType: "point",
    run,
    pseudocode: [
        "initialize mean, step size, and diagonal covariance",
        "for each generation sample a population from the gaussian",
        "evaluate every sample and sort by objective value",
        "recombine the best samples into a new mean",
        "update the evolution paths for step size and covariance",
        "adapt the step size from the path length",
        "adapt per-axis variances from selected steps",
        "record the best point seen so far",
        "done: report the best point and its objective value",
    ],
};

export default module;
