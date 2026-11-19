/**
 * hammersley-point-set.ts - Hammersley point set in the unit square.
 *
 * The i-th point of a count-point set is (i / count, radicalInverse(i, 2)).
 * One coordinate is a regular grid and the other is a reflected digit string,
 * which gives even coverage with an especially simple first coordinate.
 *
 * Time: O(count log count) to emit all frames. Space: O(count).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

/** Reflect the base-2 digits of index around the decimal point. */
function radicalInverse2(index: number): number {
    let result = 0;
    let fraction = 0.5;
    let i = index;
    while (i > 0) {
        result += (i % 2) * fraction;
        i = Math.floor(i / 2);
        fraction /= 2;
    }
    return result;
}

function hammersleyPoint(i: number, count: number): Pt {
    return [i / count, radicalInverse2(i)];
}

function node(p: Pt, i: number, state: EntityState): VisualEntity {
    return {
        id: `hm-${i}`,
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

/** The Hammersley generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { count?: number } | null) ?? {};
    const count = Math.max(1, Math.min(256, Math.floor(task.count ?? 16)));
    let step = 0;
    const emit = (shown: number, final: boolean): VisualFrame => {
        const points: number[] = [];
        const entities: VisualEntity[] = [];
        for (let i = 0; i < shown; i += 1) {
            const p = hammersleyPoint(i, count);
            points.push(p[0], p[1]);
            entities.push(node(p, i, i === shown - 1 ? "active" : final ? "sorted" : "visited"));
        }
        return {
            stepNumber: step++,
            entities,
            edges: [],
            description: final
                ? `Hammersley: placed ${shown} points with x = i/${count} and a dyadic y coordinate.`
                : `Hammersley: add point ${shown - 1} on column ${shown - 1} of ${count}.`,
            codeLineNumber: final ? 4 : 2,
            layout: "point",
            meta: { points, count: shown, base: 2 },
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
            "A Hammersley set fills the unit square by combining a perfectly regular horizontal coordinate with a low-discrepancy vertical coordinate. The x value simply walks from 0 to almost 1 in equal steps, while y is the base-2 radical inverse of the same index. The result is as even as a Halton set but with a trivially predictable horizontal spacing.",
        invariants: [
            "The x coordinate of point i is exactly i divided by the total count.",
            "The y coordinate is a dyadic fraction strictly below 1.",
            "For a power-of-two count the y values are a permutation of the evenly spaced dyadic grid.",
        ],
        correctness:
            "Because x visits i/count for every i, no vertical strip of width 1/count is skipped. Radical inversion in base 2 maps the first 2^k indices bijectively onto the dyadic fractions j/2^k, so within any strip the y values stratify as well. The two coordinates therefore combine uniform horizontal coverage with uniform vertical coverage, giving low discrepancy over the whole square.",
        complexityRationale:
            "Each radical inverse inspects the O(log i) binary digits of i, so producing count points takes O(count log count) time and O(count) space for the emitted frames.",
        uses: [
            "Quasi-Monte Carlo integration with a known sample budget",
            "Deterministic dithering and sampling patterns in graphics",
            "Low-discrepancy experimental designs with one regular axis",
        ],
        references: [
            "Hammersley, Monte Carlo Methods, 1960",
            "Niederreiter, Random Number Generation and Quasi-Monte Carlo Methods, Chapter 4",
        ],
        workedExample:
            "With count 8, the points begin (0, 0), (0.125, 0.5), (0.25, 0.25), (0.375, 0.75). The y values of the first eight points are 0, 1/2, 1/4, 3/4, 1/8, 5/8, 3/8, 7/8, each dyadic fraction appearing once.",
    },
    id: "hammersley-point-set",
    name: "Hammersley Point Set",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { count: 16 },
    visualType: "point",
    run,
    pseudocode: [
        "fix the total number of points n",
        "for each index i compute x as i divided by n",
        "compute y by reflecting the binary digits of i",
        "place the point at (x, y) in the unit square",
        "done: columns are regular and rows are stratified",
    ],
};

export default module;
