/**
 * halton-sequence.ts - Halton low-discrepancy sequence in the unit square.
 *
 * The i-th point is (radicalInverse(i, 2), radicalInverse(i, 3)).
 * Radical inversion reflects the base-b digits of i about the decimal point,
 * so successive points fill the square evenly without a random generator.
 *
 * Time: O(count log count) to emit all frames. Space: O(count).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

/** Reflect the base-b digits of index around the decimal point. */
function radicalInverse(index: number, base: number): number {
    let result = 0;
    let fraction = 1 / base;
    let i = index;
    while (i > 0) {
        result += (i % base) * fraction;
        i = Math.floor(i / base);
        fraction /= base;
    }
    return result;
}

/** The Halton point with zero-based index i. */
function haltonPoint(i: number): Pt {
    return [radicalInverse(i, 2), radicalInverse(i, 3)];
}

function node(p: Pt, i: number, state: EntityState): VisualEntity {
    return {
        id: `h-${i}`,
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

/** The Halton generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { count?: number } | null) ?? {};
    const count = Math.max(1, Math.min(256, Math.floor(task.count ?? 16)));
    let step = 0;
    const emit = (shown: number, final: boolean): VisualFrame => {
        const points: number[] = [];
        for (let i = 0; i < shown; i += 1) {
            const p = haltonPoint(i);
            points.push(p[0], p[1]);
        }
        const entities: VisualEntity[] = [];
        for (let i = 0; i < shown; i += 1) {
            entities.push(node(haltonPoint(i), i, i === shown - 1 ? "active" : final ? "sorted" : "visited"));
        }
        return {
            stepNumber: step++,
            entities,
            edges: [],
            description: final
                ? `Halton: placed ${shown} points with radical inverse in bases 2 and 3.`
                : `Halton: add point ${shown - 1} at (${haltonPoint(shown - 1)[0].toFixed(3)}, ${haltonPoint(shown - 1)[1].toFixed(3)}).`,
            codeLineNumber: final ? 4 : 2,
            layout: "point",
            meta: { points, count: shown, bases: [2, 3] },
        };
    };

    yield emit(1, false);
    for (let i = 2; i <= count; i += 1) {
        yield emit(i, false);
    }
    yield emit(count, true);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The Halton sequence scatters points across the unit square so that any region receives roughly its fair share. To build one coordinate, write the index in a prime base, reverse those digits after the decimal point, and read the result as a fraction. Pairing base 2 and base 3 gives a deterministic, well-spread point set without randomness.",
        invariants: [
            "Every point stays inside the half-open unit square [0, 1) x [0, 1).",
            "The first point of every radical-inverse sequence is exactly zero.",
            "No two indices produce the same point because digit reversal is injective on integers.",
        ],
        correctness:
            "Radical inversion maps distinct integers to distinct fractions with a finite base-b expansion, so coordinates are unique. Using coprime bases 2 and 3 keeps the two coordinates from aligning into diagonal stripes, and the reversed-digit construction makes the first b^k points of a coordinate fall on an even grid with spacing 1/b^k. That stratification is what bounds the discrepancy and spreads the sequence uniformly.",
        complexityRationale:
            "Computing one radical inverse examines the O(log i) base-b digits of i, so generating count points costs O(count log count) time and O(count) space to hold them for playback.",
        uses: [
            "Quasi-Monte Carlo integration where low discrepancy beats random sampling",
            "Deterministic sample placement in computer graphics and rendering",
            "Space-filling experimental designs and numerical quadrature",
        ],
        references: [
            "Halton, On the Efficiency of Certain Quasi-Random Sequences of Points, 1964",
            "Niederreiter, Random Number Generation and Quasi-Monte Carlo Methods, Chapter 4",
        ],
        workedExample:
            "With bases 2 and 3 the first points are (0, 0), (0.5, 0.333), (0.25, 0.667), (0.75, 0.111). The x-coordinates of the first four are 0, 1/2, 1/4, 3/4, which are the four evenly spaced dyadic fractions in order.",
    },
    id: "halton-sequence",
    name: "Halton Sequence",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { count: 16 },
    visualType: "point",
    run,
    pseudocode: [
        "choose two coprime bases, here 2 and 3",
        "for each index i compute the radical inverse in each base",
        "reverse the base-b digits of i after the decimal point",
        "place the point at the pair of reversed fractions",
        "done: the points fill the unit square evenly",
    ],
};

export default module;
