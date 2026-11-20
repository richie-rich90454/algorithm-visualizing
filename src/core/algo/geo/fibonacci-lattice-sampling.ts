/**
 * fibonacci-lattice-sampling.ts - Golden-angle Fibonacci lattice on a disk.
 *
 * The i-th of n samples uses radius sqrt((i + 0.5) / n) for area-uniform
 * coverage and angle i times the golden angle. Because the golden angle is the
 * most irrational rotation, successive samples keep landing in the widest
 * empty sectors, producing a spiral with almost no clumping.
 *
 * Time: O(n) to emit all frames. Space: O(n).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** The i-th Fibonacci lattice point inside the unit disk. */
function latticePoint(i: number, count: number): Pt {
    const radius = Math.sqrt((i + 0.5) / count);
    const angle = i * GOLDEN_ANGLE;
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

function node(p: Pt, i: number, state: EntityState): VisualEntity {
    return {
        id: `f-${i}`,
        type: "node",
        label: String(i),
        value: p,
        state,
        x: p[0],
        y: -p[1],
        width: 0,
        height: 0,
        metadata: { index: i, x: p[0], y: p[1] },
    };
}

/** The Fibonacci lattice generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { count?: number } | null) ?? {};
    const count = Math.max(1, Math.min(400, Math.floor(task.count ?? 60)));
    let step = 0;
    const emit = (shown: number, final: boolean): VisualFrame => {
        const points: number[] = [];
        const entities: VisualEntity[] = [];
        for (let i = 0; i < shown; i += 1) {
            const p = latticePoint(i, count);
            points.push(p[0], p[1]);
            entities.push(node(p, i, i === shown - 1 ? "active" : final ? "sorted" : "visited"));
        }
        return {
            stepNumber: step++,
            entities,
            edges: [],
            description: final
                ? `Fibonacci lattice: ${shown} area-uniform points on the unit disk.`
                : `Fibonacci lattice: add sample ${shown - 1} at radius ${Math.sqrt((shown - 0.5) / count).toFixed(3)}.`,
            codeLineNumber: final ? 4 : 2,
            layout: "point",
            meta: { points, count: shown, angle: GOLDEN_ANGLE, radius: 1 },
        };
    };

    const stride = Math.max(1, Math.floor(count / 30));
    for (let shown = stride; shown < count; shown += stride) {
        yield emit(shown, false);
    }
    yield emit(count, true);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Fibonacci lattice scatters points over a disk by combining two ideas. The radius grows as the square root of the sample index, which gives equal area per sample, and the angle advances by the golden angle at every step. Since the golden angle is the hardest rotation to approximate by a fraction, consecutive points never line up into radial spokes.",
        invariants: [
            "Every sample lies inside the unit disk because its radius is below one.",
            "Radii increase monotonically with the sample index.",
            "Consecutive samples are separated by exactly the golden angle.",
        ],
        correctness:
            "Using radius sqrt((i + 0.5)/n) makes the number of points inside radius r proportional to r squared, which is the area of that disk, so coverage is uniform by area. The golden angle is the continued-fraction worst approximable rotation, so the angular sequence has minimal resonance and cannot form long spokes. Together these give a deterministic set whose discrepancy is close to optimal.",
        complexityRationale:
            "Each sample needs one square root, one sine, and one cosine, so generating n samples takes O(n) time and O(n) space for the frame data.",
        uses: [
            "Blue-noise-ish sample placement on circular domains",
            "Deterministic point sets for rendering and illumination",
            "Golden-angle spiral patterns in phyllotaxis and visualization",
        ],
        references: [
            "Vogel, A Better Way to Construct the Sunflower Head, 1979",
            "Roberts, Fibonacci Lattices and Spectral Design, 2018",
        ],
        workedExample:
            "With n = 4 the radii are sqrt(1/8), sqrt(3/8), sqrt(5/8), sqrt(7/8), about 0.35, 0.61, 0.79, 0.94. Each new point is rotated by about 137.5 degrees from the previous one, so the four points sit at different angles across the disk instead of on one ray.",
    },
    id: "fibonacci-lattice-sampling",
    name: "Fibonacci Lattice Sampling",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { count: 60 },
    visualType: "point",
    run,
    pseudocode: [
        "set the golden angle to pi times (3 minus sqrt of 5)",
        "for each sample index i from zero to n minus one",
        "set radius to sqrt of (i + 0.5) divided by n",
        "set angle to i times the golden angle",
        "place the sample at (radius cos angle, radius sin angle)",
        "done: samples cover the disk evenly by area",
    ],
};

export default module;
