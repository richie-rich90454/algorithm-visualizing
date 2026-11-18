/**
 * quasi-monte-carlo.ts - Quasi-Monte Carlo Integration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quasi-Monte Carlo replaces the random samples of ordinary Monte Carlo with a
 * low-discrepancy sequence that spreads points evenly over the domain. The
 * Halton sequence builds each coordinate by reflecting the digits of the sample
 * index in a different prime base, so bases two and three produce a 2D point
 * set with no large gaps. Counting those points inside the unit quarter circle
 * estimates pi with a smaller error than pseudo-random sampling at the same
 * sample count.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(samples * log(samples)) digit reversals, O(1) work per point test
 *   Space: O(samples) for the displayed point set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each node is a Halton point in the unit square.
 *   - Points inside the quarter circle are GREEN; outside points stay GRAY.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Radical inverse: reflect the base-b digits of index around the decimal point. */
function radicalInverse(index: number, base: number): number {
    let value = 0;
    let denominator = 1;
    let n = index;
    while (n > 0) {
        denominator *= base;
        value += ((n % base) / denominator);
        n = Math.floor(n / base);
    }
    return value;
}

/** Build the point-set entities for the first count Halton points. */
function makeNodes(count: number): VisualEntity[] {
    const nodes: VisualEntity[] = [];
    for (let i = 0; i < count; i += 1) {
        const x = radicalInverse(i + 1, 2);
        const y = radicalInverse(i + 1, 3);
        const inside = x * x + y * y <= 1;
        nodes.push({
            id: `point-${i}`,
            type: "node" as const,
            label: inside ? "in" : "out",
            value: [x, y],
            state: (inside ? "sorted" : "unvisited") as EntityState,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index: i, inside },
        });
    }
    return nodes;
}

/** Count how many of the first count Halton points fall in the quarter circle. */
function countInside(count: number): number {
    let inside = 0;
    for (let i = 0; i < count; i += 1) {
        const x = radicalInverse(i + 1, 2);
        const y = radicalInverse(i + 1, 3);
        if (x * x + y * y <= 1) inside += 1;
    }
    return inside;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { samples?: number; showEvery?: number } | null) ?? {};
    const samples = typeof task.samples === "number" ? Math.max(1, Math.floor(task.samples)) : 200;
    const every =
        typeof task.showEvery === "number"
            ? Math.max(1, Math.min(samples, Math.floor(task.showEvery)))
            : Math.max(1, Math.floor(samples / 10));

    yield {
        stepNumber: 0,
        entities: makeNodes(1),
        edges: [],
        description: `Starting with the first Halton point from bases 2 and 3 toward a ${samples}-point estimate of pi.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { samples: 1, inside: countInside(1), estimate: 4 * countInside(1), error: Math.abs(4 * countInside(1) - Math.PI) },
    };

    let step = 1;
    for (let count = every; count < samples; count += every) {
        const inside = countInside(count);
        const estimate = (4 * inside) / count;
        yield {
            stepNumber: step,
            entities: makeNodes(count),
            edges: [],
            description: `After ${count} low-discrepancy points, ${inside} lie inside; pi is about ${estimate.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { samples: count, inside, estimate, error: Math.abs(estimate - Math.PI) },
        };
        step += 1;
    }

    const finalInside = countInside(samples);
    const finalEstimate = (4 * finalInside) / samples;
    yield {
        stepNumber: step,
        entities: makeNodes(samples),
        edges: [],
        description: `Final estimate ${finalEstimate.toFixed(5)} from ${samples} quasi-random points; error ${Math.abs(finalEstimate - Math.PI).toFixed(5)}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: {
            samples,
            inside: finalInside,
            estimate: finalEstimate,
            error: Math.abs(finalEstimate - Math.PI),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Random points clump and leave holes, which makes a Monte Carlo estimate noisy. A low-discrepancy sequence deliberately fills the space uniformly: each new point lands in the largest gap left so far. Halton achieves this by reflecting the digits of the sample number in prime bases, and the resulting even coverage makes integration converge faster than ordinary random sampling.",
        invariants: [
            "The first coordinate reflects the index in base two, the second in base three.",
            "Every Halton coordinate lies in the half-open unit interval.",
            "A point contributes to the estimate exactly when its squared radius is at most one.",
        ],
        correctness:
            "The radical-inverse function maps the integer index to the reversal of its base-b digits, which is uniformly distributed modulo one for every base. Using coprime bases makes the multidimensional Halton sequence uniformly distributed in the unit square by the low-discrepancy criterion. The quarter-circle area is pi over four, so four times the fraction of points landing inside converges to pi; even coverage bounds the discrepancy and hence the integration error below the usual random sampling rate.",
        complexityRationale:
            "Computing one radical inverse examines the digits of the index, O(log index) work, so generating all points is O(samples times log samples). The displayed point set is the only stored structure, using O(samples) space.",
        uses: [
            "Numerical integration in moderate dimensions where variance reduction pays off",
            "Generating well-spread sample scenes in computer graphics",
            "Quasi-random initialization of search and optimization problems",
        ],
        references: [
            "Halton, On the Efficiency of Certain Quasi-Random Sequences of Points, 1964",
            "Niederreiter, Random Number Generation and Quasi-Monte Carlo Methods, 1992",
        ],
        workedExample:
            "The first Halton points in bases 2 and 3 are (0.5, 0.333), (0.25, 0.667), (0.75, 0.111), and (0.125, 0.444). The first three have squared radii below one while the fourth is close to the boundary; counting the first one hundred points gives an estimate of pi near 3.14 with a smaller error than a comparable pseudo-random run.",
    },
    id: "quasi-monte-carlo",
    name: "Quasi-Monte Carlo (Halton Sequence)",
    category: "statistics-probability",
    complexity: { time: "O(samples * log samples)", space: "O(samples)" },
    defaultInput: { samples: 200, showEvery: 20 },
    visualType: "point",
    run,
    pseudocode: [
        "choose two coprime bases for the coordinates",
        "for each sample index",
        "reflect its base-two digits for the x coordinate",
        "reflect its base-three digits for the y coordinate",
        "test whether the point lies in the quarter circle",
        "estimate pi as four times the inside fraction",
        "done: report the estimate and its absolute error",
    ],
};

export default module;
