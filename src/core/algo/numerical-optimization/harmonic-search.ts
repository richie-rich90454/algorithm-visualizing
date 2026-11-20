/**
 * harmonic-search.ts - Harmony Search optimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Harmony search keeps a memory of candidate solutions called harmonies. A new
 * harmony is improvised one coordinate at a time: with high probability a
 * value is reused from memory and optionally pitch adjusted by a small amount,
 * otherwise a fresh random value is drawn. If the new harmony beats the worst
 * one in memory, it replaces it. This mirrors a musician improvising from
 * remembered notes and occasionally trying something new.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(generations * (population log population + dimension))
 *   Space: O(population * dimension)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the coordinates of the best harmony.
 *   - The coordinate that changed most in the last generation is highlighted.
 *   - meta carries the generation, best objective, and the harmony memory.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HarmonySearchInput {
    dimension?: number;
    population?: number;
    generations?: number;
    consideration?: number;
    adjustment?: number;
    bandwidth?: number;
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

/** The harmony search generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HarmonySearchInput | null) ?? {};
    const dimension = typeof task.dimension === "number" && task.dimension >= 1 ? Math.min(4, Math.floor(task.dimension)) : 2;
    const populationSize = typeof task.population === "number" && task.population >= 2 ? Math.min(40, Math.floor(task.population)) : 12;
    const generations = typeof task.generations === "number" && task.generations >= 1 ? Math.min(400, Math.floor(task.generations)) : 200;
    const consideration = typeof task.consideration === "number" && task.consideration > 0 && task.consideration < 1 ? task.consideration : 0.95;
    const adjustment = typeof task.adjustment === "number" && task.adjustment >= 0 && task.adjustment <= 1 ? task.adjustment : 0.5;
    const bandwidth = typeof task.bandwidth === "number" && task.bandwidth > 0 ? task.bandwidth : 0.3;
    const lower = typeof task.lower === "number" ? task.lower : -5;
    const upper = typeof task.upper === "number" && task.upper > lower ? task.upper : 5;
    const random = makeRandom(typeof task.seed === "number" ? task.seed : 67);

    let memory: number[][] = Array.from({ length: populationSize }, () =>
        Array.from({ length: dimension }, () => lower + random() * (upper - lower)),
    );
    let values = memory.map(objective);
    let order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
    let best = [...memory[order[0]!.index]!];
    let bestValue = order[0]!.value;
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
        populationFlat: memory.flat(),
        done,
    });

    yield {
        stepNumber: step++,
        entities: makeBars(best, -1),
        edges: [],
        description: `Optimizing a ${dimension}-dimensional sphere with ${populationSize} harmonies.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, -1, false),
    };

    for (let generation = 0; generation < generations; generation += 1) {
        const previousBest = [...best];
        const candidate: number[] = new Array<number>(dimension).fill(0);
        for (let k = 0; k < dimension; k += 1) {
            if (random() < consideration) {
                const source = Math.floor(random() * populationSize);
                let value = memory[source]![k] ?? 0;
                if (random() < adjustment) {
                    value += bandwidth * (random() * 2 - 1);
                }
                candidate[k] = value;
            } else {
                candidate[k] = lower + random() * (upper - lower);
            }
            candidate[k] = Math.max(lower, Math.min(upper, candidate[k] ?? 0));
        }
        const value = objective(candidate);
        order = values.map((v, index) => ({ value: v, index })).sort((a, b) => a.value - b.value);
        const worstIndex = order[order.length - 1]!.index;
        if (value < (values[worstIndex] ?? Infinity)) {
            memory[worstIndex] = candidate;
            values[worstIndex] = value;
            if (value < bestValue) {
                bestValue = value;
                best = [...candidate];
            }
        }
        const changed = best.findIndex((v, k) => Math.abs(v - (previousBest[k] ?? 0)) > 1e-12);
        yield {
            stepNumber: step++,
            entities: makeBars(best, changed),
            edges: [],
            description: `Generation ${generation + 1}: best harmony objective ${bestValue.toFixed(6)}.`,
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

/** The harmony search module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A jazz musician improvises mostly from notes that sound good together, with occasional small bends and rare surprises. Harmony search does the same with candidate solutions: most coordinates come from the memory of good solutions, sometimes shifted slightly, and occasionally a brand new random value appears. If the improvised solution is better than the worst remembered one, it takes that place.",
        invariants: [
            "With the given memory consideration rate most coordinates are copied from memory.",
            "Pitch adjustment changes a copied coordinate by at most the bandwidth.",
            "New harmonies replace only the current worst member, so the best objective is nonincreasing.",
            "Every coordinate stays inside the given bounds.",
        ],
        correctness:
            "Worst-only replacement is elitist: the best memory entry can never be removed by a worse harmony, and the global best changes only when a strictly better objective is evaluated, so it is always attainable and monotone. The improvisation rule matches harmony search, with memory consideration, pitch adjustment, and random initialization as the three distinct branches. On the sphere objective, reusing and refining good coordinates drives the memory toward the origin.",
        complexityRationale:
            "Improvisation costs O(dimension) per generation, and ranking the memory to find the worst costs O(population log population). The memory matrix uses O(population times dimension) space.",
        uses: [
            "Continuous and discrete optimization without derivatives",
            "Engineering design and scheduling",
            "Tuning model parameters when evaluations are expensive",
        ],
        references: [
            "Geem, Kim, and Loganathan, A New Heuristic Optimization Algorithm: Harmony Search, 2001",
            "Geem, Music-Inspired Harmony Search Algorithm, 2009",
        ],
        workedExample:
            "With twelve two-dimensional harmonies and a memory consideration rate of 0.95, a new harmony might copy both coordinates from good memories, then pitch adjust one by up to 0.3. If the resulting point has objective 0.8 while the worst memory entry has objective 5.2, the new point replaces it. Repeating this two hundred times leaves the memory clustered near the origin.",
    },
    id: "harmonic-search",
    name: "Harmony Search",
    category: "numerical-optimization",
    complexity: { time: "O(g * (NP log NP + d))", space: "O(NP * d)" },
    defaultInput: {
        dimension: 2,
        population: 12,
        generations: 200,
        consideration: 0.95,
        adjustment: 0.5,
        bandwidth: 0.3,
        lower: -5,
        upper: 5,
        seed: 67,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the harmony memory with random bounded solutions",
        "evaluate the objective of each harmony",
        "for each new harmony and each coordinate",
        "with high probability copy a value from memory",
        "pitch adjust that value by a small random amount",
        "otherwise draw a fresh value inside the bounds",
        "replace the worst harmony when the new one is better",
        "done: report the best harmony and its objective",
    ],
};

export default module;
