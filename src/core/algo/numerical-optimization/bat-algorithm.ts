/**
 * bat-algorithm.ts - Bat Algorithm for continuous optimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Each bat flies with a velocity and a pulse frequency. The frequency scales
 * how strongly the bat is pulled toward the current best solution. A local
 * search around the best point happens only when a random draw exceeds the
 * bat's pulse rate, and a new position is accepted only when a second draw is
 * below its loudness and the objective improves. Loudness decays while pulse
 * rate grows, so the search shifts from exploration to exploitation.
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
 *   - Bars show the coordinates of the best bat.
 *   - The coordinate that changed most in the last generation is highlighted.
 *   - meta carries the generation, best objective, and bat population.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BatInput {
    dimension?: number;
    population?: number;
    generations?: number;
    frequencyMin?: number;
    frequencyMax?: number;
    loudness?: number;
    pulse?: number;
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

/** The bat algorithm generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BatInput | null) ?? {};
    const dimension = typeof task.dimension === "number" && task.dimension >= 1 ? Math.min(4, Math.floor(task.dimension)) : 2;
    const populationSize = typeof task.population === "number" && task.population >= 2 ? Math.min(40, Math.floor(task.population)) : 12;
    const generations = typeof task.generations === "number" && task.generations >= 1 ? Math.min(400, Math.floor(task.generations)) : 80;
    const frequencyMin = typeof task.frequencyMin === "number" ? task.frequencyMin : 0;
    const frequencyMax = typeof task.frequencyMax === "number" && task.frequencyMax > frequencyMin ? task.frequencyMax : 1;
    const loudness0 = typeof task.loudness === "number" && task.loudness > 0 ? Math.min(1, task.loudness) : 0.9;
    const pulse0 = typeof task.pulse === "number" && task.pulse > 0 ? Math.min(1, task.pulse) : 0.15;
    const lower = typeof task.lower === "number" ? task.lower : -5;
    const upper = typeof task.upper === "number" && task.upper > lower ? task.upper : 5;
    const random = makeRandom(typeof task.seed === "number" ? task.seed : 23);

    let positions: number[][] = Array.from({ length: populationSize }, () =>
        Array.from({ length: dimension }, () => lower + random() * (upper - lower)),
    );
    const velocities: number[][] = Array.from({ length: populationSize }, () => new Array<number>(dimension).fill(0));
    const loudness = new Array<number>(populationSize).fill(loudness0);
    const pulse = new Array<number>(populationSize).fill(pulse0);
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
        description: `Optimizing a ${dimension}-dimensional sphere with ${populationSize} bats.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, -1, false),
    };

    for (let generation = 0; generation < generations; generation += 1) {
        const previousBest = [...best];
        const meanLoudness = loudness.reduce((sum, value) => sum + value, 0) / populationSize;
        for (let i = 0; i < populationSize; i += 1) {
            const frequency = frequencyMin + (frequencyMax - frequencyMin) * random();
            const candidate: number[] = new Array<number>(dimension).fill(0);
            for (let k = 0; k < dimension; k += 1) {
                const velocity = (velocities[i]![k] ?? 0) + ((positions[i]![k] ?? 0) - (best[k] ?? 0)) * frequency;
                velocities[i]![k] = velocity;
                candidate[k] = (positions[i]![k] ?? 0) + velocity;
            }
            if (random() > (pulse[i] ?? 0)) {
                for (let k = 0; k < dimension; k += 1) {
                    candidate[k] = (best[k] ?? 0) + (random() * 2 - 1) * meanLoudness;
                }
            }
            for (let k = 0; k < dimension; k += 1) {
                candidate[k] = Math.max(lower, Math.min(upper, candidate[k] ?? 0));
            }
            const value = objective(candidate);
            if (random() < (loudness[i] ?? 0) && value < (values[i] ?? Infinity)) {
                positions[i] = candidate;
                values[i] = value;
                loudness[i] = (loudness[i] ?? 0) * 0.95;
                pulse[i] = Math.min(1, (pulse[i] ?? 0) * 1.05);
                if (value < bestValue) {
                    bestValue = value;
                    best = [...candidate];
                }
            }
        }
        const changed = best.findIndex((value, k) => Math.abs(value - (previousBest[k] ?? 0)) > 1e-12);
        yield {
            stepNumber: step++,
            entities: makeBars(best, changed),
            edges: [],
            description: `Generation ${generation + 1}: best bat objective ${bestValue.toFixed(6)}.`,
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

/** The bat algorithm module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Bats hunt with sonar: they emit a pulse and listen for the echo. In the algorithm a bat's frequency controls how fast it flies toward the best bat, loudness controls whether it accepts a new position, and pulse rate controls how often it searches locally. Over time the bats get quieter and pulse faster, which turns broad searching into fine tuning.",
        invariants: [
            "Each new position is accepted only when it improves that bat and passes a loudness draw.",
            "Loudness never increases and pulse rate never decreases.",
            "The global best point changes only when a strictly better objective is accepted.",
            "Every coordinate stays inside the given bounds.",
        ],
        correctness:
            "Acceptance requires a strictly lower objective, so the best value is monotone nonincreasing and always corresponds to an evaluated point. Frequencies are drawn inside the given interval and the velocity update follows the standard bat velocity rule, so a recorded move is a genuine bat move. As loudness falls and pulse rate rises, local search around the best dominates, which is the intended convergence mechanism of the method.",
        complexityRationale:
            "Each bat performs a constant number of coordinate updates, acceptance draws, and one objective evaluation per generation, giving O(generations times population times dimension). Storing positions, velocities, loudness, and pulse values uses O(population times dimension) space.",
        uses: [
            "Continuous engineering design optimization",
            "Parameter tuning when derivatives are unavailable",
            "Multimodal function optimization",
        ],
        references: [
            "Yang, A New Metaheuristic Bat-Inspired Algorithm, 2010",
            "Yang and Gandomi, Bat Algorithm: A Novel Approach for Global Engineering Optimization, 2012",
        ],
        workedExample:
            "With twelve bats in two dimensions, a bat at objective 12 draws frequency 0.3 and adds a velocity pointing toward the best bat at objective 2. If its loudness draw passes and the new objective is lower, the point is accepted, loudness drops by five percent, and pulse rate rises five percent. After eighty generations the loudness is small and every bat searches close to the best point near the origin.",
    },
    id: "bat-algorithm",
    name: "Bat Algorithm",
    category: "numerical-optimization",
    complexity: { time: "O(g * NP * d)", space: "O(NP * d)" },
    defaultInput: {
        dimension: 2,
        population: 12,
        generations: 80,
        frequencyMin: 0,
        frequencyMax: 1,
        loudness: 0.9,
        pulse: 0.15,
        lower: -5,
        upper: 5,
        seed: 23,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize bat positions, velocities, loudness, and pulse rates",
        "evaluate the objective of every bat",
        "for each bat draw a frequency in the given range",
        "update velocity toward the best bat and propose a new point",
        "with probability below the pulse rate perturb around the best",
        "accept the point when loudness permits and the objective improves",
        "decrease loudness and increase pulse rate after acceptance",
        "done: report the best point and objective",
    ],
};

export default module;
