/**
 * kronecker-sequence.ts - One-dimensional Kronecker (additive) sequence.
 *
 * The i-th value is frac(i * alpha) for an irrational alpha, here the golden
 * ratio. Adding alpha modulo one never repeats and keeps consecutive values
 * separated by one of only a few gap lengths, so the points fill [0, 1)
 * remarkably evenly. This is the one-dimensional ancestor of the R2 family.
 *
 * Time: O(count) to emit all frames. Space: O(count).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

const ALPHA = (1 + Math.sqrt(5)) / 2;

/** Fractional part of i times the golden ratio. */
function kroneckerValue(i: number): number {
    const v = i * ALPHA;
    return v - Math.floor(v);
}

function node(value: number, i: number, state: EntityState): VisualEntity {
    return {
        id: `k-${i}`,
        type: "node",
        label: String(i),
        value,
        state,
        x: value,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, value },
    };
}

/** The Kronecker generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { count?: number } | null) ?? {};
    const count = Math.max(1, Math.min(256, Math.floor(task.count ?? 16)));
    let step = 0;
    const emit = (shown: number, final: boolean): VisualFrame => {
        const values: number[] = [];
        const entities: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        for (let i = 0; i < shown; i += 1) {
            const v = kroneckerValue(i);
            values.push(v);
            entities.push(node(v, i, i === shown - 1 ? "active" : final ? "sorted" : "visited"));
        }
        for (let i = 1; i < shown; i += 1) {
            edges.push({
                id: `step-${i - 1}-${i}`,
                sourceId: `k-${i - 1}`,
                targetId: `k-${i}`,
                label: "",
                state: "path",
                directed: true,
            });
        }
        const v = kroneckerValue(shown - 1);
        return {
            stepNumber: step++,
            entities,
            edges,
            description: final
                ? `Kronecker: ${shown} golden-ratio multiples modulo one fill the unit interval.`
                : `Kronecker: add frac(${(shown - 1)} x golden ratio) = ${v.toFixed(3)}.`,
            codeLineNumber: final ? 4 : 2,
            layout: "point",
            meta: { values, count: shown, alpha: ALPHA },
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
            "The Kronecker sequence is the simplest possible low-discrepancy recipe: repeatedly add an irrational number and keep only the fractional part. With the golden ratio the jumps land in the largest gaps left by earlier points, so no cluster grows too large. Drawn on a line, the successive jumps visibly hop between the thirds of the interval.",
        invariants: [
            "Every value lies in the half-open interval [0, 1).",
            "The first value is zero because frac(0) = 0.",
            "Distinct indices give distinct values because alpha is irrational.",
        ],
        correctness:
            "If two indices gave the same value, their difference times alpha would be an integer, forcing the irrational alpha to be rational, a contradiction. The three-gap theorem says that the gaps after n golden-ratio multiples take at most three distinct lengths, the largest of which shrinks like 1/n. That is exactly the even coverage a low-discrepancy sequence needs.",
        complexityRationale:
            "Each value is one multiplication and one floor, so the whole sequence costs O(count) time and O(count) space for the frames and the connecting path.",
        uses: [
            "One-dimensional quasi-Monte Carlo quadrature",
            "Low-discrepancy scheduling and incremental search",
            "Building block of multi-dimensional additive recurrence sequences",
        ],
        references: [
            "Kronecker, Uber die Einteilungen der Ebene, 1894",
            "Kuipers and Niederreiter, Uniform Distribution of Sequences, Chapter 1",
        ],
        workedExample:
            "With alpha the golden ratio about 1.618, the first values are 0, 0.618, 0.236, 0.854, 0.472, 0.090. Sorting the first five gives 0, 0.236, 0.472, 0.618, 0.854, whose gaps are all near 0.2, showing how evenly the sequence fills the interval.",
    },
    id: "kronecker-sequence",
    name: "Kronecker Sequence",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { count: 16 },
    visualType: "point",
    run,
    pseudocode: [
        "set alpha to the golden ratio",
        "for each index i from zero upward",
        "multiply i by alpha and keep the fractional part",
        "draw the value on the unit interval and link it to the previous one",
        "done: the values are distinct and evenly spread",
    ],
};

export default module;
