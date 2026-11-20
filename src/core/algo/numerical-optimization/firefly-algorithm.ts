/**
 * firefly-algorithm.ts - Firefly Algorithm for continuous optimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Each candidate solution is a firefly whose brightness reflects its objective
 * value. A dimmer firefly moves toward every brighter one with an attraction
 * that decays exponentially with squared distance, plus a shrinking random
 * walk. The random walk preserves exploration while attraction drives the
 * population toward the best regions. A seeded generator makes each run exact
 * and reproducible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(generations * population^2 * dimension)
 *   Space: O(population * dimension)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the coordinates of the brightest firefly.
 *   - The coordinate that changed most in the last generation is highlighted.
 *   - meta carries the generation, best objective, and population snapshot.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FireflyInput {
    dimension?: number;
    population?: number;
    generations?: number;
    alpha?: number;
    beta?: number;
    gamma?: number;
    lower?: number;
    upper?: number;
    seed?: number;
}

/** Deterministic 32-bit linear congruential generator. */
function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

/** The sphere function, with a unique minimum of zero at the origin. */
function objective(x: number[]): number {
    return x.reduce((sum, value) => sum + value * value, 0);
}

function makeBars(best: number[], changed: number): VisualEntity[] {
    return best.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `x${index}: ${value.toFixed(3)}`,
        value,
        state: (index === changed ? "comparing" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** The firefly algorithm generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FireflyInput | null) ?? {};
    const dimension = typeof task.dimension === "number" && task.dimension >= 1 ? Math.min(4, Math.floor(task.dimension)) : 2;
    const populationSize = typeof task.population === "number" && task.population >= 2 ? Math.min(40, Math.floor(task.population)) : 12;
    const generations = typeof task.generations === "number" && task.generations >= 1 ? Math.min(400, Math.floor(task.generations)) : 80;
    const alpha = typeof task.alpha === "number" && task.alpha >= 0 ? task.alpha : 0.4;
    const beta = typeof task.beta === "number" && task.beta >= 0 ? task.beta : 1;
    const gamma = typeof task.gamma === "number" && task.gamma >= 0 ? task.gamma : 0.05;
    const lower = typeof task.lower === "number" ? task.lower : -5;
    const upper = typeof task.upper === "number" && task.upper > lower ? task.upper : 5;
    const random = makeRandom(typeof task.seed === "number" ? task.seed : 11);

    let positions: number[][] = Array.from({ length: populationSize }, () =>
        Array.from({ length: dimension }, () => lower + random() * (upper - lower)),
    );
    let values = positions.map(objective);
    let bestIndex = values.indexOf(Math.min(...values));
    let best = [...positions[bestIndex]!];
    let bestValue = values[bestIndex]!;
    let step = 0;

    const meta = (generation: number, changed: number, done: boolean) => ({
        generation,
        best: [...best],
        bestValue,
        changed,
        populationSize,
        dimension,
        lower,
        upper,
        populationFlat: positions.flat(),
        done,
    });

    yield {
        stepNumber: step++,
        entities: makeBars(best, -1),
        edges: [],
        description: `Optimizing a ${dimension}-dimensional sphere with ${populationSize} fireflies.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, -1, false),
    };

    for (let generation = 0; generation < generations; generation += 1) {
        const previousBest = [...best];
        const walk = alpha * Math.pow(0.94, generation);
        for (let i = 0; i < populationSize; i += 1) {
            for (let j = 0; j < populationSize; j += 1) {
                if ((values[j] ?? Infinity) >= (values[i] ?? Infinity)) continue;
                let squaredDistance = 0;
                for (let k = 0; k < dimension; k += 1) {
                    const delta = (positions[i]![k] ?? 0) - (positions[j]![k] ?? 0);
                    squaredDistance += delta * delta;
                }
                const attraction = beta * Math.exp(-gamma * squaredDistance);
                for (let k = 0; k < dimension; k += 1) {
                    const current = positions[i]![k] ?? 0;
                    const target = positions[j]![k] ?? 0;
                    positions[i]![k] = Math.max(lower, Math.min(upper,
                        current + attraction * (target - current) + walk * (random() - 0.5)));
                }
            }
            values[i] = objective(positions[i]!);
            if ((values[i] ?? Infinity) < bestValue) {
                bestValue = values[i]!;
                best = [...positions[i]!];
            }
        }
        const changed = best.findIndex((value, k) => Math.abs(value - (previousBest[k] ?? 0)) > 1e-12);
        yield {
            stepNumber: step++,
            entities: makeBars(best, changed),
            edges: [],
            description: `Generation ${generation + 1}: brightest firefly has objective ${bestValue.toFixed(6)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: meta(generation + 1, changed, false),
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(best, -1),
        edges: [],
        description: `After ${generations} generations the best point is [${best.map((v) => v.toFixed(5)).join(", ")}] with objective ${bestValue.toFixed(8)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: meta(generations, -1, true),
    };
}

/** The firefly algorithm module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine fireflies of different brightness. A dim firefly is drawn to brighter ones, but the pull weakens quickly with distance, so nearby bright fireflies matter most. A small random wander keeps the search from getting stuck. Repeating this movement makes the swarm gather around the best solutions found.",
        invariants: [
            "Brightness is derived from the objective, so a lower objective means a brighter firefly.",
            "A firefly moves only toward strictly brighter fireflies.",
            "Attraction decays exponentially with squared distance.",
            "The random step shrinks every generation while the best objective never increases.",
        ],
        correctness:
            "Every move either follows a brighter firefly or wanders randomly, and the global best is updated only when a strictly better objective is evaluated, so the recorded best is always the minimum seen so far. Because the attraction term is weighted by the objective ordering, the mechanism implements the firefly algorithm rather than a generic random walk. On the sphere the attraction toward lower objectives drives the population toward the origin, the unique global minimizer.",
        complexityRationale:
            "For each of the population fireflies we compare against every other firefly and update each coordinate, costing O(population squared times dimension) per generation. Storing positions and objective values uses O(population times dimension) space.",
        uses: [
            "Continuous black-box optimization without derivatives",
            "Structural design and parameter tuning",
            "Multimodal engineering optimization",
        ],
        references: [
            "Yang, Firefly Algorithms for Multimodal Optimization, 2009",
            "Yang, Firefly Algorithm, Stochastic Test Functions and Design Optimisation, 2010",
        ],
        workedExample:
            "With twelve two-dimensional fireflies in [-5, 5], a point at objective 18 sees a brighter point at objective 3. At distance two the attraction is exp(-0.2), so the dim point moves most of the way toward the bright one plus a small jitter. Repeating over eighty generations collapses the swarm near the origin, where the sphere objective is close to zero.",
    },
    id: "firefly-algorithm",
    name: "Firefly Algorithm",
    category: "numerical-optimization",
    complexity: { time: "O(g * NP^2 * d)", space: "O(NP * d)" },
    defaultInput: {
        dimension: 2,
        population: 12,
        generations: 80,
        alpha: 0.4,
        beta: 1,
        gamma: 0.05,
        lower: -5,
        upper: 5,
        seed: 11,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize firefly positions at random inside the bounds",
        "evaluate the objective of every firefly",
        "for each firefly and each brighter firefly",
        "compute attraction from the squared distance",
        "move toward the brighter firefly plus a shrinking random step",
        "clamp to bounds and reevaluate the objective",
        "update the best point when a better objective appears",
        "done: report the best point and objective",
    ],
};

export default module;
