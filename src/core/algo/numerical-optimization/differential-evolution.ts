/**
 * differential-evolution.ts - Differential Evolution (DE/rand/1/bin)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Differential evolution is a population method for continuous optimization
 * that needs no gradient. For each target vector it builds a donor by adding a
 * weighted difference of two other population members to a third, mixes the
 * donor with the target through binomial crossover, and keeps whichever of the
 * trial and the target has the lower objective. This mutation adapts its scale
 * to the population itself, so the search naturally shrinks as the population
 * converges. A seeded generator makes the whole run reproducible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(generations * population * dimension) objective and vector work
 *   Space: O(population * dimension) for the population
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar shows each coordinate of the current best vector.
 *   - The coordinate that changed most in the last generation is highlighted.
 *   - The meta reports the generation, best objective, and flattened population.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DifferentialEvolutionInput {
    dimension?: number;
    population?: number;
    generations?: number;
    scale?: number;
    crossover?: number;
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

function sphere(x: number[]): number {
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

/** The differential evolution generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DifferentialEvolutionInput | null) ?? {};
    const dimension = typeof task.dimension === "number" && task.dimension >= 1 ? Math.min(6, Math.floor(task.dimension)) : 3;
    const populationSize = typeof task.population === "number" && task.population >= 4 ? Math.floor(task.population) : 20;
    const generations = typeof task.generations === "number" && task.generations >= 1 ? Math.floor(task.generations) : 200;
    const scale = typeof task.scale === "number" && task.scale > 0 ? task.scale : 0.8;
    const crossover = typeof task.crossover === "number" && task.crossover >= 0 && task.crossover <= 1 ? task.crossover : 0.9;
    const lower = typeof task.lower === "number" ? task.lower : -5;
    const upper = typeof task.upper === "number" && task.upper > lower ? task.upper : 5;
    const random = makeRandom(typeof task.seed === "number" ? task.seed : 12345);

    let population: number[][] = Array.from({ length: populationSize }, () =>
        Array.from({ length: dimension }, () => lower + random() * (upper - lower)),
    );
    let values = population.map(sphere);
    let bestIndex = values.indexOf(Math.min(...values));
    let best = [...population[bestIndex]!];
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
        populationFlat: population.flat(),
        done,
    });

    yield {
        stepNumber: step++,
        entities: makeBars(best, -1),
        edges: [],
        description: `Optimizing a ${dimension}-dimensional sphere with ${populationSize} vectors and DE/rand/1/bin.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, -1, false),
    };

    for (let generation = 0; generation < generations; generation += 1) {
        const previousBest = [...best];
        const next = population.map((row) => [...row]);
        const nextValues = [...values];
        for (let i = 0; i < populationSize; i += 1) {
            let r1 = Math.floor(random() * populationSize);
            while (r1 === i) r1 = Math.floor(random() * populationSize);
            let r2 = Math.floor(random() * populationSize);
            while (r2 === i || r2 === r1) r2 = Math.floor(random() * populationSize);
            let r3 = Math.floor(random() * populationSize);
            while (r3 === i || r3 === r1 || r3 === r2) r3 = Math.floor(random() * populationSize);
            const jrand = Math.floor(random() * dimension);
            const trial = Array.from({ length: dimension }, (_, j) => {
                const donor = (population[r1]![j] ?? 0) + scale * ((population[r2]![j] ?? 0) - (population[r3]![j] ?? 0));
                return j === jrand || random() < crossover ? donor : (population[i]![j] ?? 0);
            });
            const clamped = trial.map((value) => Math.max(lower, Math.min(upper, value)));
            const trialValue = sphere(clamped);
            if (trialValue <= (values[i] ?? Infinity)) {
                next[i] = clamped;
                nextValues[i] = trialValue;
            }
        }
        population = next;
        values = nextValues;
        const newBestIndex = values.indexOf(Math.min(...values));
        if ((values[newBestIndex] ?? Infinity) < bestValue) {
            bestValue = values[newBestIndex]!;
            best = [...population[newBestIndex]!];
        }
        const changed = best.findIndex((value, j) => Math.abs(value - (previousBest[j] ?? 0)) > 1e-12);
        yield {
            stepNumber: step++,
            entities: makeBars(best, changed),
            edges: [],
            description: `Generation ${generation + 1}: best objective ${bestValue.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: meta(generation + 1, changed, false),
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(best, -1),
        edges: [],
        description: `After ${generations} generations the best vector is [${best.map((v) => v.toFixed(5)).join(", ")}] with objective ${bestValue.toFixed(8)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: meta(generations, -1, true),
    };
}

/** The differential evolution module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Differential evolution evolves a population of candidate vectors. To make a new candidate it picks three other members, adds a scaled difference of two of them to the third, and then mixes that donor with the current target at random. If the new vector is better it replaces the target; otherwise the target survives. Because the difference shrinks as the population clusters, the search automatically moves from broad exploration to fine refinement.",
        invariants: [
            "The population size stays constant across generations.",
            "A trial replaces its target only when its objective is no worse.",
            "The best objective seen is nonincreasing.",
            "Every coordinate stays inside the given lower and upper bounds.",
        ],
        correctness:
            "Selection is elitist with respect to each target: a trial is accepted only if its objective is at most the target's, so no target ever gets worse and the population best is nonincreasing. The global best is therefore a valid record of the best point evaluated. The mutation uses a difference of two distinct population members added to a third distinct member, so the perturbation direction is derived from the population rather than a fixed distribution, which is the defining property of DE/rand/1/bin. On the sphere function the population contracts toward the unique global minimizer at the origin.",
        complexityRationale:
            "Each generation performs population-size mutation, crossover, and objective evaluations, each O(dimension), so the total is O(generations * population * dimension). Storing the population and its objective values uses O(population * dimension) space.",
        uses: [
            "Continuous black-box optimization without derivatives",
            "Engineering design and parameter tuning",
            "Fitting models when the objective is noisy or nonconvex",
        ],
        references: [
            "Storn and Price, Differential Evolution: A Simple and Efficient Heuristic, 1997",
            "Price, Storn, and Lampinen, Differential Evolution: A Practical Approach, 2005",
        ],
        workedExample:
            "With a population of twenty three-dimensional vectors in [-5, 5], a target might combine donor r1 plus 0.8 times (r2 minus r3). Binomial crossover keeps most coordinates from the donor and at least one from the donor by construction. If the resulting point is closer to the origin than the target, it replaces the target; repeating this over two hundred generations drives the best objective close to zero.",
    },
    id: "differential-evolution",
    name: "Differential Evolution (DE/rand/1/bin)",
    category: "numerical-optimization",
    complexity: { time: "O(g * NP * d)", space: "O(NP * d)" },
    defaultInput: {
        dimension: 3,
        population: 20,
        generations: 200,
        scale: 0.8,
        crossover: 0.9,
        lower: -5,
        upper: 5,
        seed: 12345,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize a population of random bounded vectors",
        "evaluate the objective of every vector",
        "for each target choose three distinct other vectors",
        "build a donor from r1 plus scale times (r2 minus r3)",
        "crossover donor and target with binomial probability",
        "replace the target if the trial is no worse",
        "track the best vector and objective seen",
        "done: report the best vector and objective",
    ],
};

export default module;
