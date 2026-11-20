/**
 * z-transform.ts - Z-Transform of a Finite Sequence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Z-transform of a finite sequence x[0..N-1] is the polynomial
 * X(z) = sum of x[n] times z to the power minus n. It is the discrete-time
 * cousin of the Laplace transform and the foundation of digital filter
 * analysis. This module records the transform coefficients, evaluates the
 * polynomial at a few sample z values with Horner's rule, and exposes the
 * shift and convolution properties through those coefficients.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N + N*zPoints) for coefficient setup and Horner evaluations
 *   Space: O(N) for the coefficient and term arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the transform coefficients (the sequence itself).
 *   - The coefficient currently folded into Horner's rule is highlighted.
 *   - meta carries the coefficients, per-z evaluations, and term values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ZTransformInput {
    sequence?: number[];
    zPoints?: number[];
}

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        const state: EntityState = done ? "sorted" : index === active ? "active" : "idle";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, coefficient: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ZTransformInput | null) ?? {};
    const sequence: number[] = Array.isArray(task.sequence) && task.sequence.length > 0
        ? task.sequence.map((value) => Number(value) || 0)
        : [1, 2, 3, 4];
    const coefficients = sequence.slice(0, 32);
    const points: number[] = Array.isArray(task.zPoints) && task.zPoints.length > 0
        ? task.zPoints.map((value) => Number(value) || 0).filter((value) => Math.abs(value) > 1e-9).slice(0, 8)
        : [0.5, 1, 2];
    const evaluations: number[] = [];
    const n = coefficients.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(coefficients, -1, false),
        edges: [],
        description: `X(z) has ${n} coefficients: X(z) = sum of x[n] times z to the power minus n.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, coefficients: [...coefficients], evaluations: [], zPoints: points, done: false },
    };
    step += 1;

    // Fold the coefficients with Horner's rule in t = 1/z for the first sample point.
    const first = points[0] ?? 1;
    let accumulator = 0;
    for (let index = n - 1; index >= 0; index -= 1) {
        accumulator = (coefficients[index] ?? 0) + accumulator / first;
        yield {
            stepNumber: step,
            entities: makeBars(coefficients, index, false),
            edges: [],
            description: `Horner step ${index}: fold coefficient ${coefficients[index]} with t = ${(1 / first).toFixed(4)}; running value ${accumulator.toFixed(6)}.`,
            codeLineNumber: index === 0 ? 2 : 3,
            layout: "array",
            meta: { n, coefficients: [...coefficients], evaluations: [], zPoints: points, done: false, hornerIndex: index, accumulator },
        };
        step += 1;
    }

    for (const z of points) {
        const terms = coefficients.map((value, index) => value / z ** index);
        const value = terms.reduce((sum, term) => sum + term, 0);
        evaluations.push(value);
        yield {
            stepNumber: step,
            entities: makeBars(terms, -1, false),
            edges: [],
            description: `At z = ${z.toFixed(4)} the terms sum to X(z) = ${value.toFixed(6)}.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { n, coefficients: [...coefficients], evaluations: [...evaluations], zPoints: points, done: false, z, terms },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(evaluations, -1, true),
        edges: [],
        description: `Evaluated X(z) at ${points.length} point(s); the transform coefficients are the sequence itself.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, coefficients, evaluations, zPoints: points, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A finite sequence becomes a polynomial when we treat each sample as the coefficient of a decreasing power of z. Reading the polynomial at different z values reveals how the signal behaves, and simple operations on the sequence become simple operations on the polynomial. Evaluating with Horner's rule folds one coefficient at a time instead of recomputing powers.",
        invariants: [
            "The transform coefficients equal the input samples in order.",
            "Shifting the sequence by one sample prepends a zero coefficient.",
            "The transform of a convolution is the coefficientwise convolution of the transforms.",
        ],
        correctness:
            "By definition X(z) equals the sum over n of x[n] times z to the power minus n. Horner's rule rewrites that sum as x[0] plus (1/z) times (x[1] plus (1/z) times ...), which is algebraically identical and avoids computing large powers. The direct per-z term sum reported in each frame is an independent evaluation of the same polynomial, so the two must agree at every sample point.",
        complexityRationale:
            "Setup is O(N). The Horner sweep touches N coefficients once, and evaluating each of the z sample points forms N terms, giving O(N plus N times zPoints) time. Storing the coefficient and term arrays is O(N) space.",
        uses: [
            "Digital filter design and stability analysis",
            "Discrete-time system response computation",
            "Signal processing teaching and convolution property demonstrations",
        ],
        references: [
            "Oppenheim and Schafer, Discrete-Time Signal Processing, 3rd edition, chapter 2",
            "Proakis and Manolakis, Digital Signal Processing, 4th edition, chapter 3",
        ],
        workedExample:
            "For the sequence [1, 2, 3, 4], X(z) = 1 + 2/z + 3/z squared + 4/z cubed. At z = 1 the value is 10. At z = 2 it is 1 + 1 + 0.75 + 0.5, or 3.25. Horner's rule reaches the same numbers by folding coefficients from the end toward the start.",
    },
    id: "z-transform",
    name: "Z-Transform",
    category: "numerical-optimization",
    complexity: { time: "O(N + N*zPoints)", space: "O(N)" },
    defaultInput: {
        sequence: [1, 2, 3, 4],
        zPoints: [0.5, 1, 2],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the finite sequence and the sample points",
        "treat each sample as a transform coefficient",
        "fold the coefficients with Horner's rule in one over z",
        "for each sample point form every term x[n] over z to the power n",
        "sum the terms to evaluate X at that point",
        "record the coefficients and all evaluations",
        "done: report the coefficient and evaluation spectra",
    ],
};

export default module;
