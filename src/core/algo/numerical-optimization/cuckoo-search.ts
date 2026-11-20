/**
 * cuckoo-search.ts - Cuckoo Search with Levy flights
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Each nest holds a candidate solution. A cuckoo replaces a randomly chosen
 * nest with a new solution obtained by taking a heavy-tailed Levy flight from
 * one nest, which occasionally makes a very long jump. A fraction of the worst
 * nests is then abandoned and rebuilt at random. The heavy tail gives good
 * global exploration while elitist replacement preserves the best solution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(generations * population * dimension)
 *   Space: O(population * dimension)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the coordinates of the best nest.
 *   - The coordinate that changed most in the last generation is highlighted.
 *   - meta carries the generation, best objective, and all nests.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CuckooSearchInput {
    dimension?: number;
    population?: number;
    generations?: number;
    alpha?: number;
    discovery?: number;
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

/** One symmetric heavy-tailed step with exponent 1.5. */
function levyStep(random: () => number, scale: number): number {
    const numerator = random() * 2 - 1;
    const denominator = Math.max(1e-6, Math.abs(random() * 2 - 1));
    return scale * numerator / Math.pow(denominator, 1 / 1.5);
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

/** The cuckoo search generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CuckooSearchInput | null) ?? {};
    const dimension = typeof task.dimension === "number" && task.dimension >= 1 ? Math.min(4, Math.floor(task.dimension)) : 2;
    const populationSize = typeof task.population === "number" && task.population >= 2 ? Math.min(40, Math.floor(task.population)) : 14;
    const generations = typeof task.generations === "number" && task.generations >= 1 ? Math.min(400, Math.floor(task.generations)) : 90;
    const alpha = typeof task.alpha === "number" && task.alpha > 0 ? task.alpha : 0.35;
    const discovery = typeof task.discovery === "number" && task.discovery > 0 && task.discovery < 1 ? task.discovery : 0.25;
    const lower = typeof task.lower === "number" ? task.lower : -5;
    const upper = typeof task.upper === "number" && task.upper > lower ? task.upper : 5;
    const random = makeRandom(typeof task.seed === "number" ? task.seed : 37);

    let nests: number[][] = Array.from({ length: populationSize }, () =>
        Array.from({ length: dimension }, () => lower + random() * (upper - lower)),
    );
    let values = nests.map(objective);
    let bestIndex = values.indexOf(Math.min(...values));
    let best = [...nests[bestIndex]!];
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
        populationFlat: nests.flat(),
        done,
    });

    yield {
        stepNumber: step++,
        entities: makeBars(best, -1),
        edges: [],
        description: `Optimizing a ${dimension}-dimensional sphere with ${populationSize} cuckoo nests.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, -1, false),
    };

    for (let generation = 0; generation < generations; generation += 1) {
        const previousBest = [...best];
        const scale = alpha * Math.pow(0.97, generation);
        for (let i = 0; i < populationSize; i += 1) {
            const target = Math.floor(random() * populationSize);
            const candidate = nests[i]!.map((value) =>
                Math.max(lower, Math.min(upper, value + levyStep(random, scale))),
            );
            const value = objective(candidate);
            if (value < (values[target] ?? Infinity)) {
                nests[target] = candidate;
                values[target] = value;
                if (value < bestValue) {
                    bestValue = value;
                    best = [...candidate];
                }
            }
        }
        for (let i = 0; i < populationSize; i += 1) {
            if (random() >= discovery) continue;
            nests[i] = Array.from({ length: dimension }, () => lower + random() * (upper - lower));
            values[i] = objective(nests[i]!);
        }
        const changed = best.findIndex((value, k) => Math.abs(value - (previousBest[k] ?? 0)) > 1e-12);
        yield {
            stepNumber: step++,
            entities: makeBars(best, changed),
            edges: [],
            description: `Generation ${generation + 1}: best nest objective ${bestValue.toFixed(6)}.`,
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

/** The cuckoo search module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Cuckoos lay eggs in other birds' nests, and some host birds notice and throw out the intruder. The algorithm keeps a population of nests and replaces a random nest with a new solution reached by a Levy flight, a random walk with occasional very long jumps. Those long jumps search far away, while a discovery probability rebuilds some nests so the population does not stagnate.",
        invariants: [
            "A replacement nest is accepted only when its objective is strictly lower.",
            "Levy steps are symmetric, so there is no preferred search direction.",
            "The recorded best objective is nonincreasing even though nests may be abandoned.",
            "Every nest coordinate stays inside the given bounds.",
        ],
        correctness:
            "Replacement and best updates happen only on strictly improving objectives, so the global best is always an evaluated point and never worsens. The step rule is a symmetric Levy flight with exponent 1.5, which is the defining heavy-tailed move of cuckoo search. Abandoning a nest cannot destroy the recorded best because that value is stored separately, so elitism is preserved.",
        complexityRationale:
            "Per generation each nest needs one Levy step and one objective evaluation, and the abandonment pass draws once per nest, giving O(generations times population times dimension). The nest matrix uses O(population times dimension) space.",
        uses: [
            "Global optimization of nonconvex functions",
            "Engineering design and scheduling",
            "Parameter estimation with few evaluations available",
        ],
        references: [
            "Yang and Deb, Cuckoo Search via Levy Flights, 2009",
            "Yang and Deb, Engineering Optimisation by Cuckoo Search, 2010",
        ],
        workedExample:
            "With fourteen two-dimensional nests, a cuckoo draws a Levy step of length about 0.3 in each coordinate and lands at a point with objective 1.4. If the randomly chosen host nest had objective 3.1, the host is replaced. One quarter of nests are then rebuilt at random. Over ninety generations the decreasing step size concentrates the nests close to the origin.",
    },
    id: "cuckoo-search",
    name: "Cuckoo Search",
    category: "numerical-optimization",
    complexity: { time: "O(g * NP * d)", space: "O(NP * d)" },
    defaultInput: {
        dimension: 2,
        population: 14,
        generations: 90,
        alpha: 0.35,
        discovery: 0.25,
        lower: -5,
        upper: 5,
        seed: 37,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize a population of host nests inside the bounds",
        "evaluate the objective of every nest",
        "for each cuckoo choose a host nest at random",
        "fly by a Levy step and clamp to the bounds",
        "replace the host when the new objective is lower",
        "abandon a fraction of nests and rebuild them at random",
        "record the best objective seen so far",
        "done: report the best nest and its objective",
    ],
};

export default module;
