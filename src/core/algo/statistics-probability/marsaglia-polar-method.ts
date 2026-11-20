/**
 * marsaglia-polar-method.ts - Marsaglia Polar Method for Normal Variates
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The polar method draws standard normal variates in pairs from two uniforms.
 * It maps uniforms onto a disk, rejects points outside the unit circle, and
 * scales accepted points so that the squared radius is an exponential variate.
 * The two coordinates of an accepted point are independent standard normals,
 * giving a rejection-based alternative to the direct Box-Muller formula.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(samples) expected, with about 21 percent rejection
 *   Space: O(samples) for the emitted points
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each proposed point is drawn at its disk coordinates (v0, v1).
 *   - Rejected points are red; accepted points are green.
 *   - The final frame reports the sample mean and variance.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Deterministic 32-bit uniform generator. */
function makeRng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

interface Pair {
    v0: number;
    v1: number;
    s: number;
    z0: number;
    z1: number;
    accepted: boolean;
}

function makeEntities(pairs: Pair[], current: number): VisualEntity[] {
    return pairs.map((pair, index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: pair.accepted ? "N" : "x",
        value: [pair.v0, pair.v1],
        state: pair.accepted ? "sorted" : "error",
        x: pair.v0,
        y: pair.v1,
        width: 0,
        height: 0,
        metadata: { index, accepted: pair.accepted, s: pair.s },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; samples?: number } | null) ?? {};
    const seed = typeof task.seed === "number" ? task.seed : 12345;
    const samples = typeof task.samples === "number"
        ? Math.max(2, Math.min(20000, Math.floor(task.samples))) : 400;
    const rng = makeRng(seed);
    const pairs: Pair[] = [];
    const normals: number[] = [];

    yield {
        stepNumber: 0,
        entities: [],
        edges: [],
        description: `Drawing ${samples} normal variates with the polar method using seed ${seed}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { seed, samples, pairs: [], mean: 0, variance: 0, count: 0, complete: false },
    };
    let step = 1;
    let attempts = 0;
    while (normals.length < samples && attempts < samples * 100) {
        const u0 = rng();
        const u1 = rng();
        const v0 = 2 * u0 - 1;
        const v1 = 2 * u1 - 1;
        const s = v0 * v0 + v1 * v1;
        const accepted = s > 0 && s < 1;
        let z0 = 0;
        let z1 = 0;
        if (accepted) {
            const factor = Math.sqrt((-2 * Math.log(s)) / s);
            z0 = v0 * factor;
            z1 = v1 * factor;
            normals.push(z0, z1);
        }
        pairs.push({ v0, v1, s, z0, z1, accepted });
        attempts += 1;
        if (pairs.length % 8 === 0 || normals.length >= samples) {
            yield {
                stepNumber: step,
                entities: makeEntities(pairs, pairs.length - 1),
                edges: [],
                description: accepted
                    ? `Accepted pair ${pairs.length}: radius squared ${s.toFixed(4)} gives normals (${z0.toFixed(3)}, ${z1.toFixed(3)}).`
                    : `Rejected proposal ${pairs.length}: radius squared ${s.toFixed(4)} is outside the unit disk.`,
                codeLineNumber: accepted ? 4 : 2,
                layout: "point",
                meta: {
                    seed, samples, pairs: pairs.map((p) => [p.v0, p.v1, p.s, p.z0, p.z1, p.accepted ? 1 : 0]),
                    mean: 0, variance: 0, count: normals.length, complete: false,
                },
            };
            step += 1;
        }
    }

    const count = normals.length;
    const mean = count > 0 ? normals.reduce((a, b) => a + b, 0) / count : 0;
    const variance = count > 0 ? normals.reduce((a, b) => a + (b - mean) ** 2, 0) / count : 0;
    yield {
        stepNumber: step,
        entities: makeEntities(pairs, pairs.length),
        edges: [],
        description: `Generated ${count} variates in ${attempts} proposals: mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: {
            seed, samples, attempts, count, mean, variance,
            pairs: pairs.map((p) => [p.v0, p.v1, p.s, p.z0, p.z1, p.accepted ? 1 : 0]),
            complete: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Throw darts uniformly at a square and keep only those landing inside the unit circle. For each accepted dart, stretching it so its squared radius becomes an exponential variate turns its two coordinates into independent standard normals. The circle rejection is what makes the radius distribution come out right.",
        invariants: [
            "A proposal is accepted only when its squared radius lies strictly between zero and one.",
            "For every accepted pair the identity z0 squared plus z1 squared equals minus two log s holds exactly.",
            "Accepted coordinates are independent standard normals in the limit.",
        ],
        correctness:
            "Uniform points in the unit disk have squared radius s distributed as Uniform(0,1) and an independent uniform angle. Scaling by sqrt(-2 log s / s) makes the radius squared equal -2 log s, which is chi-square with two degrees of freedom, while the angle stays uniform. A two-dimensional normal has exactly that radius and angle decomposition, so the two Cartesian coordinates are independent standard normals.",
        complexityRationale:
            "Each proposal needs a few arithmetic operations and one logarithm and square root only when accepted. The disk accepts about pi over four of proposals, so the expected work is O(samples) with a small constant, and space is O(samples) for the emitted points.",
        uses: [
            "Generating Gaussian noise in Monte Carlo simulations",
            "Initializing weights and latent variables in stochastic models",
            "A teaching example of rejection sampling and change of variables",
        ],
        references: [
            "Marsaglia and Bray, A Convenient Method for Generating Normal Variables, 1964",
            "Knuth, The Art of Computer Programming, Volume 2, Section 3.4.1",
        ],
        workedExample:
            "With uniforms giving v0 = 0.5 and v1 = 0.5, the squared radius is 0.5, which is inside the disk. The scale factor is sqrt(-2 log 0.5 / 0.5), about 1.665, so the emitted pair is roughly (0.833, 0.833). Their squared sum is about 1.386, which equals minus two log 0.5.",
    },
    id: "marsaglia-polar-method",
    name: "Marsaglia Polar Method",
    category: "statistics-probability",
    complexity: { time: "O(samples) expected", space: "O(samples)" },
    defaultInput: { seed: 12345, samples: 400 },
    visualType: "point",
    run,
    pseudocode: [
        "repeat until enough normals are collected",
        "draw uniforms u0 and u1 and set v0 = 2u0 - 1, v1 = 2u1 - 1",
        "set s to v0 squared plus v1 squared",
        "if s is zero or at least one, reject and start over",
        "set factor to sqrt(-2 log s / s)",
        "emit z0 = v0 factor and z1 = v1 factor",
        "done: report the count, mean, and variance",
    ],
};

export default module;
