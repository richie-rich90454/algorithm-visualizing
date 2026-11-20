/**
 * whale-optimization.ts - Whale Optimization Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Each candidate is a whale whose position is updated by one of three moves.
 * With a shrinking coefficient whose magnitude is below one, the whale
 * encircles the current best with a spiral bubble-net attack. With a larger
 * magnitude it searches for prey by following a randomly chosen whale. A coin
 * flip chooses between the spiral and the encircling or search move. The best
 * point is preserved across all moves.
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
 *   - Bars show the coordinates of the leading whale.
 *   - The coordinate that changed most in the last generation is highlighted.
 *   - meta carries the generation, best objective, and the whole population.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface WhaleInput {
    dimension?: number;
    population?: number;
    generations?: number;
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

/** The whale optimization algorithm generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as WhaleInput | null) ?? {};
    const dimension = typeof task.dimension === "number" && task.dimension >= 1 ? Math.min(4, Math.floor(task.dimension)) : 2;
    const populationSize = typeof task.population === "number" && task.population >= 2 ? Math.min(40, Math.floor(task.population)) : 12;
    const generations = typeof task.generations === "number" && task.generations >= 1 ? Math.min(400, Math.floor(task.generations)) : 80;
    const lower = typeof task.lower === "number" ? task.lower : -5;
    const upper = typeof task.upper === "number" && task.upper > lower ? task.upper : 5;
    const random = makeRandom(typeof task.seed === "number" ? task.seed : 53);

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
        description: `Optimizing a ${dimension}-dimensional sphere with ${populationSize} whales.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, -1, false),
    };

    for (let generation = 0; generation < generations; generation += 1) {
        const previousBest = [...best];
        const coefficient = 2 - (2 * generation) / Math.max(1, generations - 1);
        for (let i = 0; i < populationSize; i += 1) {
            const spiral = random() < 0.5;
            const lValue = random() * 2 - 1;
            const aValue = 2 * coefficient * random() - coefficient;
            const cValue = 2 * random();
            const preyIndex = Math.floor(random() * populationSize);
            const candidate: number[] = new Array<number>(dimension).fill(0);
            for (let k = 0; k < dimension; k += 1) {
                if (spiral) {
                    const distance = Math.abs((best[k] ?? 0) - (positions[i]![k] ?? 0));
                    candidate[k] = distance * Math.exp(Math.cos(2 * Math.PI * lValue)) + (best[k] ?? 0);
                } else if (Math.abs(aValue) < 1) {
                    const distance = Math.abs(cValue * (best[k] ?? 0) - (positions[i]![k] ?? 0));
                    candidate[k] = (best[k] ?? 0) - aValue * distance;
                } else {
                    const distance = Math.abs(cValue * (positions[preyIndex]![k] ?? 0) - (positions[i]![k] ?? 0));
                    candidate[k] = (positions[preyIndex]![k] ?? 0) - aValue * distance;
                }
                candidate[k] = Math.max(lower, Math.min(upper, candidate[k] ?? 0));
            }
            positions[i] = candidate;
            values[i] = objective(candidate);
            if ((values[i] ?? Infinity) < bestValue) {
                bestValue = values[i]!;
                best = [...candidate];
            }
        }
        const changed = best.findIndex((value, k) => Math.abs(value - (previousBest[k] ?? 0)) > 1e-12);
        yield {
            stepNumber: step++,
            entities: makeBars(best, changed),
            edges: [],
            description: `Generation ${generation + 1}: leading whale objective ${bestValue.toFixed(6)}.`,
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

/** The whale optimization algorithm module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Humpback whales surround prey and swim upward in a shrinking spiral while blowing a net of bubbles. The algorithm mimics this with a spiral update around the best whale, plus an encircling update when the search radius is small and a wider search for prey when it is large. The radius shrinks over time, so the population moves from exploration to a tight attack on the best region.",
        invariants: [
            "The coefficient a decreases linearly from 2 to 0.",
            "A whale uses the spiral move, the encircling move, or the prey-search move according to its random draws.",
            "The global best objective is nonincreasing across generations.",
            "Every coordinate is clamped to the given bounds.",
        ],
        correctness:
            "The best point changes only when a better objective is evaluated, so the answer is always attainable and monotone. The three position-update rules match the bubble-net, encircling, and search phases of the whale optimization algorithm, and the probability threshold selects between them. With the sphere objective the shrinking radius and spiral updates concentrate the whales at the origin, the unique global minimizer.",
        complexityRationale:
            "Each whale draws a constant number of random values and updates every coordinate once per generation, costing O(generations times population times dimension). Storing the population and its objective values uses O(population times dimension) space.",
        uses: [
            "Continuous global optimization without derivatives",
            "Engineering design and structural optimization",
            "Parameter tuning for nonconvex objectives",
        ],
        references: [
            "Mirjalili and Lewis, The Whale Optimization Algorithm, 2016",
            "Mirjalili, Mirjalili, and Hatamlou, Grey Wolf Optimizer, 2014",
        ],
        workedExample:
            "With twelve whales in two dimensions and a near 1.8, a whale with the search branch follows a randomly chosen whale with a wide step. Later a is near 0.1, so the encircling branch pulls it toward the leading whale near (0, 0). Half the moves use the spiral term instead, giving distance times an exponential cosine factor added to the leader. Over eighty generations the best objective approaches zero.",
    },
    id: "whale-optimization",
    name: "Whale Optimization Algorithm",
    category: "numerical-optimization",
    complexity: { time: "O(g * NP * d)", space: "O(NP * d)" },
    defaultInput: {
        dimension: 2,
        population: 12,
        generations: 80,
        lower: -5,
        upper: 5,
        seed: 53,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize whale positions at random inside the bounds",
        "evaluate objectives and record the leading whale",
        "decrease the coefficient a from two toward zero",
        "for each whale draw a spiral flag and random coefficients",
        "if spiraling, update around the leader with a logarithmic spiral",
        "otherwise encircle the leader or search near a random whale",
        "clamp, evaluate, and update the global best",
        "done: report the leading whale and its objective",
    ],
};

export default module;
