/**
 * latin-hypercube-sampling.ts - Latin Hypercube Sampling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Latin hypercube sampling is a stratified design for exploring a
 * multidimensional input space with few samples. Each dimension is divided into
 * n equal strata and exactly one sample is drawn from each stratum. Independent
 * random permutations then pair the strata across dimensions, so every marginal
 * is perfectly stratified while the joint design stays random. It converges
 * faster than plain Monte Carlo for many integrals.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * d) for n samples in d dimensions
 *   Space: O(n * d) for the sample matrix and permutation table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - For a two-dimensional design, each sample is a point at its coordinates.
 *   - Points are revealed one at a time; the newest point is yellow.
 *   - The final frame reports the sample matrix and its stratum coverage.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Small deterministic PRNG (mulberry32) so designs are reproducible. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Fisher-Yates permutation of 0..n-1. */
function permutation(n: number, rng: () => number): number[] {
    const p = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = p[i] as number;
        p[i] = p[j] as number;
        p[j] = tmp;
    }
    return p;
}

/** Build the point entities for the revealed samples. */
function makePoints(points: number[][], revealed: number, dimensions: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < revealed; i += 1) {
        const coords = points[i] as number[];
        let state: EntityState = "sorted";
        if (i === revealed - 1) state = "comparing";
        entities.push({
            id: `point-${i}`,
            type: "node" as const,
            label: dimensions > 1 ? `${(coords[0] as number).toFixed(2)}, ${(coords[1] as number).toFixed(2)}` : (coords[0] as number).toFixed(3),
            value: [...coords],
            state,
            x: coords[0] as number,
            y: dimensions > 1 ? (coords[1] as number) : 0.5,
            width: 0,
            height: 0,
            metadata: { index: i },
        });
    }
    return entities;
}

/** The Latin hypercube sampling generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { samples?: number; dimensions?: number; seed?: number } | null) ?? {};
    const n = typeof task.samples === "number" ? Math.min(50, Math.max(1, Math.floor(task.samples))) : 8;
    const dimensions = typeof task.dimensions === "number" ? Math.min(6, Math.max(1, Math.floor(task.dimensions))) : 2;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 1;
    const rng = mulberry32(seed);

    const points: number[][] = Array.from({ length: n }, () => Array.from({ length: dimensions }, () => 0));
    const strata: number[][] = [];
    const permutations: number[][] = [];
    for (let d = 0; d < dimensions; d += 1) {
        const stratumValues: number[] = [];
        for (let j = 0; j < n; j += 1) {
            stratumValues.push((j + rng()) / n);
        }
        const perm = permutation(n, rng);
        strata.push(stratumValues);
        permutations.push(perm);
        for (let i = 0; i < n; i += 1) {
            (points[i] as number[])[d] = stratumValues[perm[i] as number] as number;
        }
    }

    yield {
        stepNumber: 0,
        entities: makePoints(points, 0, dimensions),
        edges: [],
        description: `Latin hypercube design of ${n} samples in ${dimensions} dimension(s) with seed ${seed}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n, dimensions, seed, pointsFlat: points.flat(), strataFlat: strata.flat(), permutationsFlat: permutations.flat(), revealed: 0 },
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makePoints(points, i + 1, dimensions),
            edges: [],
            description: `Placed sample ${i} at ${(points[i] as number[]).map((v) => v.toFixed(3)).join(", ")}; one per stratum in every dimension.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { n, dimensions, seed, pointsFlat: points.flat(), strataFlat: strata.flat(), permutationsFlat: permutations.flat(), revealed: i + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makePoints(points, n, dimensions),
        edges: [],
        description: `Complete LHS design: ${n} samples, ${dimensions} dimension(s), each dimension covering all ${n} strata exactly once.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { n, dimensions, seed, pointsFlat: points.flat(), strataFlat: strata.flat(), permutationsFlat: permutations.flat(), revealed: n, complete: true },
    };
}

/** The Latin hypercube sampling module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Split every input dimension into the same number of equal slices, then draw one value from each slice. Shuffle which sample gets which slice independently in each dimension. The result spreads points evenly along every axis, avoiding the clumps and holes that ordinary random sampling produces, while keeping the joint placement random.",
        invariants: [
            "Every coordinate lies in the half-open interval from zero to one.",
            "In each dimension the n coordinates fall in n distinct strata.",
            "Each dimension uses a permutation of the stratum indices.",
        ],
        correctness:
            "For dimension d the construction draws exactly one value inside each interval j/n to (j+1)/n, so the sorted coordinates have one point per stratum and the empirical marginal distribution is within one over n of uniform, a variance reduction over independent sampling. Applying an independent permutation in each dimension preserves that marginal property for every axis and makes the columns statistically independent across dimensions.",
        complexityRationale:
            "Generating one stratified value per stratum takes O(n) work per dimension, and filling the n by d matrix plus the permutation scans is O(n d). The matrix, strata, and permutation lists together use O(n d) space.",
        uses: [
            "Designing computer experiments and simulation sweeps",
            "Uncertainty quantification with costly black-box models",
            "Initializing candidates in global optimization and hyperparameter searches",
        ],
        references: [
            "McKay, Beckman, and Conover, A Comparison of Three Methods for Selecting Values of Input Variables, 1979",
            "Stein, Large Sample Properties of Simulations Using Latin Hypercube Sampling, 1987",
        ],
        workedExample:
            "For four samples in two dimensions, dimension one might draw values from the quarters 0 to 0.25, 0.25 to 0.5, 0.5 to 0.75, and 0.75 to 1, then shuffle them. Dimension two does the same with a different shuffle, giving four points whose x and y coordinates each cover all four quarters exactly once.",
    },
    id: "latin-hypercube-sampling",
    name: "Latin Hypercube Sampling",
    category: "statistics-probability",
    complexity: { time: "O(n d)", space: "O(n d)" },
    defaultInput: { samples: 8, dimensions: 2, seed: 1 },
    visualType: "point",
    run,
    pseudocode: [
        "read the sample count, dimension count, and seed",
        "create a seeded random number generator",
        "for each dimension divide the unit interval into n strata",
        "draw one uniform value inside each stratum",
        "shuffle the stratum labels with a random permutation",
        "assign one shuffled value to each sample coordinate",
        "done: report the design and its stratum coverage",
    ],
};

export default module;
