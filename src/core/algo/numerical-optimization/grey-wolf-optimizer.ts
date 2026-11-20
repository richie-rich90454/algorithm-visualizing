/**
 * grey-wolf-optimizer.ts - Grey Wolf Optimizer
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A pack of candidate solutions is ranked by objective value. The three best
 * wolves are called alpha, beta, and delta, and every other wolf updates its
 * position by moving toward a weighted average of those three leaders. The
 * coefficient a falls linearly from 2 to 0, so early steps roam widely and
 * later steps close in on the leader. A seeded generator makes every run exact.
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
 *   - Bars show the coordinates of the alpha wolf.
 *   - The coordinate that changed most in the last generation is highlighted.
 *   - meta carries the generation, best objective, and the whole pack.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GreyWolfInput {
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

/** The grey wolf optimizer generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GreyWolfInput | null) ?? {};
    const dimension = typeof task.dimension === "number" && task.dimension >= 1 ? Math.min(4, Math.floor(task.dimension)) : 2;
    const populationSize = typeof task.population === "number" && task.population >= 4 ? Math.min(40, Math.floor(task.population)) : 12;
    const generations = typeof task.generations === "number" && task.generations >= 1 ? Math.min(400, Math.floor(task.generations)) : 80;
    const lower = typeof task.lower === "number" ? task.lower : -5;
    const upper = typeof task.upper === "number" && task.upper > lower ? task.upper : 5;
    const random = makeRandom(typeof task.seed === "number" ? task.seed : 41);

    let positions: number[][] = Array.from({ length: populationSize }, () =>
        Array.from({ length: dimension }, () => lower + random() * (upper - lower)),
    );
    let values = positions.map(objective);
    const ranking = () => values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
    let leaders = ranking();
    let best = [...positions[leaders[0]!.index]!];
    let bestValue = leaders[0]!.value;
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
        description: `Optimizing a ${dimension}-dimensional sphere with a pack of ${populationSize} grey wolves.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, -1, false),
    };

    for (let generation = 0; generation < generations; generation += 1) {
        const previousBest = [...best];
        leaders = ranking();
        const alpha = positions[leaders[0]!.index]!;
        const beta = positions[leaders[1]!.index]!;
        const delta = positions[leaders[2]!.index]!;
        const coefficient = 2 - (2 * generation) / Math.max(1, generations - 1);
        for (let i = 0; i < populationSize; i += 1) {
            const candidate: number[] = new Array<number>(dimension).fill(0);
            for (let k = 0; k < dimension; k += 1) {
                let coordinate = 0;
                for (const leader of [alpha, beta, delta]) {
                    const a1 = 2 * coefficient * random() - coefficient;
                    const c1 = 2 * random();
                    const distance = Math.abs(c1 * (leader[k] ?? 0) - (positions[i]![k] ?? 0));
                    coordinate += (leader[k] ?? 0) - a1 * distance;
                }
                candidate[k] = Math.max(lower, Math.min(upper, coordinate / 3));
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
            description: `Generation ${generation + 1}: alpha wolf objective ${bestValue.toFixed(6)}.`,
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

/** The grey wolf optimizer module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A grey wolf pack has a strict hierarchy: alpha leads, then beta, then delta, and the rest follow. The algorithm ranks candidate solutions into that hierarchy and moves every wolf toward a point derived from the three leaders. Two random coefficients let a wolf sometimes move away from a leader, which keeps the search from collapsing too early. As the coefficients shrink, the whole pack converges.",
        invariants: [
            "The three leaders are the three lowest-objective wolves at the start of each generation.",
            "The coefficient a decreases linearly from 2 to 0.",
            "The best objective is nonincreasing across generations.",
            "Every coordinate remains inside the given bounds.",
        ],
        correctness:
            "Leaders are recomputed from current objective values, and the global best is updated only on a strictly lower evaluated objective, so the recorded answer is always attainable and monotone. The position update is the average of the three leader-guided candidates with coefficients drawn as in the grey wolf optimizer, making the mechanism faithful to the method. On the sphere the leaders pull the pack toward the origin, the unique global minimizer.",
        complexityRationale:
            "Each generation ranks the pack once and updates every coordinate with three leader terms, so the cost is O(generations times population times dimension) plus a sort. Pack positions and values occupy O(population times dimension) space.",
        uses: [
            "Continuous global optimization without gradients",
            "Engineering design and control tuning",
            "Feature selection and parameter optimization",
        ],
        references: [
            "Mirjalili, Mirjalili, and Hatamlou, Grey Wolf Optimizer, 2014",
            "Mirjalili and Lewis, The Whale Optimization Algorithm, 2016",
        ],
        workedExample:
            "With twelve wolves in two dimensions, the best three wolves might sit near (0.4, -0.2), (-0.3, 0.5), and (0.1, 0.6). A follower draws random coefficients and computes three candidate points, one near each leader, then moves to their average. With a starting near 2 the moves are wide; by generation eighty a is near zero and the pack has gathered close to the origin.",
    },
    id: "grey-wolf-optimizer",
    name: "Grey Wolf Optimizer",
    category: "numerical-optimization",
    complexity: { time: "O(g * NP * d)", space: "O(NP * d)" },
    defaultInput: {
        dimension: 2,
        population: 12,
        generations: 80,
        lower: -5,
        upper: 5,
        seed: 41,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize a pack of random bounded candidate positions",
        "evaluate objectives and rank the wolves",
        "name the three best wolves alpha, beta, and delta",
        "decrease the coefficient a from two toward zero",
        "for each wolf draw random coefficient vectors",
        "compute steps toward alpha, beta, and delta",
        "move to the average, clamp, and reevaluate",
        "done: report the alpha wolf and its objective",
    ],
};

export default module;
