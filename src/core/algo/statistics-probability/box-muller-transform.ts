/**
 * box-muller-transform.ts - Box-Muller Normal Sampling
 *
 * The Box-Muller transform converts two independent uniform random numbers
 * into two independent standard normal values using polar coordinates. This
 * module uses a deterministic linear congruential generator so every replay is
 * identical, plots each generated pair, and reports the sample moments.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BMInput {
    seed?: number;
    pairs?: number;
}

/** Deterministic 32-bit linear congruential generator. */
function nextUniform(state: { s: number }): number {
    state.s = (Math.imul(1664525, state.s) + 1013904223) >>> 0;
    return (state.s + 0.5) / 4294967296;
}

interface NormalPair {
    u1: number;
    u2: number;
    z0: number;
    z1: number;
}

function generate(seed: number, pairs: number): NormalPair[] {
    const state = { s: seed >>> 0 };
    const result: NormalPair[] = [];
    for (let i = 0; i < pairs; i += 1) {
        const u1 = nextUniform(state);
        const u2 = nextUniform(state);
        const radius = Math.sqrt(-2 * Math.log(u1));
        const angle = 2 * Math.PI * u2;
        result.push({ u1, u2, z0: radius * Math.cos(angle), z1: radius * Math.sin(angle) });
    }
    return result;
}

function makePoints(pairs: NormalPair[], active: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    pairs.forEach((pair, index) => {
        entities.push({
            id: `u-${index}`,
            type: "node" as const,
            label: `u${index}`,
            value: pair.u1,
            state: index === active ? "active" : done ? "sorted" : index < active ? "visited" : "idle",
            x: pair.u1,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, role: "uniform", u1: pair.u1, u2: pair.u2 },
        });
        entities.push({
            id: `z-${index}`,
            type: "node" as const,
            label: `z${index}`,
            value: pair.z0,
            state: index === active ? "highlight" : done ? "sorted" : index < active ? "visited" : "unvisited",
            x: pair.u1,
            y: pair.z0,
            width: 0,
            height: 0,
            metadata: { index, role: "normal", z0: pair.z0, z1: pair.z1 },
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BMInput | null) ?? {};
    const seed = Math.max(1, Math.floor(Number(task.seed ?? 12345)) || 12345);
    const pairs = Math.min(4000, Math.max(4, Math.floor(Number(task.pairs ?? 32)) || 32));
    const values = generate(seed, pairs);
    const all = values.flatMap((p) => [p.z0, p.z1]);
    const mean = all.reduce((sum, z) => sum + z, 0) / all.length;
    const variance = all.reduce((sum, z) => sum + (z - mean) ** 2, 0) / all.length;

    yield {
        stepNumber: 0,
        entities: makePoints(values, -1, false),
        edges: [],
        description: `Box-Muller with seed ${seed}: transform ${pairs} uniform pairs into standard normal pairs.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { seed, pairs, mean: 0, variance: 0, pairsData: [] },
    };

    // Batch large runs so the precomputed frame buffer stays small.
    const batch = Math.max(1, Math.ceil(values.length / 32));
    let step = 1;
    for (let i = 0; i < values.length; i += batch) {
        const upto = Math.min(values.length, i + batch);
        const pair = values[i]!;
        yield {
            stepNumber: step,
            entities: makePoints(values, i, false),
            edges: [],
            description: `u1 = ${pair.u1.toFixed(4)}, u2 = ${pair.u2.toFixed(4)}: radius = sqrt(-2 ln u1), angle = 2 pi u2, giving (${pair.z0.toFixed(4)}, ${pair.z1.toFixed(4)}).`,
            codeLineNumber: 2,
            layout: "point",
            meta: {
                seed,
                pairs,
                mean: 0,
                variance: 0,
                activePair: i,
                pairsData: values.slice(0, upto).map((p) => [p.u1, p.u2, p.z0, p.z1]),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makePoints(values, -1, true),
        edges: [],
        description: `Generated ${all.length} normal values: sample mean ${mean.toFixed(4)}, sample variance ${variance.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: {
            seed,
            pairs,
            mean,
            variance,
            pairsData: values.map((p) => [p.u1, p.u2, p.z0, p.z1]),
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Uniform random numbers are easy to produce, but many simulations need normally distributed ones. Box and Muller noticed that treating two uniforms as the radius and angle of a point in the plane, with the radius chosen from an exponential distribution, gives a pair of independent standard normal coordinates when projected onto the axes.",
        invariants: [
            "Both uniforms lie strictly between zero and one, so the logarithms are finite.",
            "The squared radius equals minus two times the log of the first uniform.",
            "The two outputs have zero mean and unit variance in the population limit.",
        ],
        correctness:
            "Writing the joint density of two independent standard normals in polar coordinates gives a factor exp minus r squared over two and a uniform angle. If u1 is uniform then r squared equals minus two log u1 has the required exponential distribution, and u2 gives a uniform angle. The Jacobian of the polar transformation supplies the remaining r factor, so the produced coordinates are independent standard normals. The deterministic generator only chooses the uniforms; the transform itself is exact.",
        complexityRationale:
            "Each pair needs two uniforms, one logarithm, one square root and two trigonometric calls, O(1) work per pair, and the plotted points use O(pairs) space.",
        uses: [
            "Generating Gaussian noise for Monte Carlo simulations",
            "Initializing weights and sampling perturbations in machine learning",
            "Financial modeling of asset returns",
        ],
        references: [
            "Box and Muller, A Note on the Generation of Random Normal Deviates, 1958",
            "Press et al., Numerical Recipes, Section on Normal Deviates",
        ],
        workedExample:
            "With u1 = 0.5 and u2 = 0.25, the radius is sqrt(2 log 2), about 1.177, and the angle is pi over two. The outputs are approximately z0 = 0 and z1 = 1.177, and z0 squared plus z1 squared equals minus two log 0.5.",
    },
    id: "box-muller-transform",
    name: "Box-Muller Transform",
    category: "statistics-probability",
    complexity: { time: "O(pairs)", space: "O(pairs)" },
    defaultInput: { seed: 12345, pairs: 32 },
    visualType: "point",
    run,
    pseudocode: [
        "seed a uniform random number generator",
        "for each requested pair draw uniforms u1 and u2",
        "set radius to sqrt(-2 log u1)",
        "set angle to 2 pi u2",
        "output z0 = radius cos angle and z1 = radius sin angle",
        "accumulate the sample mean and variance",
        "done: report the generated normal pairs",
    ],
};

export default module;
