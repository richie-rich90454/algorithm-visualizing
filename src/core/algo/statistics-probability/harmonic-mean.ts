/**
 * harmonic-mean.ts - Harmonic Mean
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The harmonic mean of n positive values is n divided by the sum of their
 * reciprocals. It is the appropriate average when values are rates: for two
 * equal-distance trips at speeds v1 and v2, the average speed is the harmonic
 * mean of v1 and v2, not the arithmetic mean.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n values
 *   Space: O(n) for the displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per input value.
 *   - The current reciprocal is HIGHLIGHT; processed bars are SORTED.
 *   - The final frame reports n / sum(1/v) in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** Accumulate reciprocals, then divide the count by their sum. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = Array.isArray(task.values)
        ? task.values.map(Number)
        : [1, 2, 4, 8];

    let step = 0;
    if (values.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "No values were supplied, so the harmonic mean is undefined.",
            codeLineNumber: 1,
            layout: "array",
            meta: { count: 0, result: 0, valid: false },
        };
        return;
    }

    yield {
        stepNumber: step,
        entities: makeBars(values),
        edges: [],
        description: `Compute the harmonic mean of ${values.length} positive values from their reciprocals.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { count: values.length, reciprocalSum: 0, valid: true },
    };
    step += 1;

    let reciprocalSum = 0;
    let valid = true;
    for (let i = 0; i < values.length; i += 1) {
        const value = values[i] ?? 0;
        if (value > 0) {
            reciprocalSum += 1 / value;
        } else {
            valid = false;
        }
        const states = new Map<number, EntityState>();
        for (let j = 0; j < i; j += 1) {
            states.set(j, "sorted");
        }
        states.set(i, value > 0 ? "comparing" : "error");
        yield {
            stepNumber: step,
            entities: makeBars(values, states),
            edges: [],
            description: `Value ${value}: add the reciprocal ${value > 0 ? (1 / value).toFixed(4) : "undefined"} to the running sum.`,
            codeLineNumber: value > 0 ? 4 : 3,
            layout: "array",
            meta: { count: values.length, index: i, reciprocalSum, valid },
        };
        step += 1;
    }

    const result = valid ? values.length / reciprocalSum : 0;
    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < values.length; i += 1) {
        finalStates.set(i, valid ? "sorted" : "idle");
    }
    yield {
        stepNumber: step,
        entities: makeBars(values, finalStates),
        edges: [],
        description: valid
            ? `Harmonic mean = ${values.length} / ${reciprocalSum.toFixed(4)} = ${result.toFixed(4)}.`
            : "A nonpositive value was found, so the harmonic mean is undefined.",
        codeLineNumber: 6,
        layout: "array",
        meta: { count: values.length, reciprocalSum, result, valid },
    };
}

/** The harmonic mean module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The harmonic mean gives extra weight to small values because it averages reciprocals rather than raw numbers. It answers the question: if every observation were replaced by one common rate, what rate would produce the same total reciprocal cost? This makes it the right average for speeds, resistances, and other ratios.",
        invariants: [
            "The running reciprocal sum equals the sum of 1/v over values processed so far.",
            "Every positive value contributes exactly one reciprocal.",
            "The harmonic mean always lies between the minimum and maximum of the input values.",
        ],
        correctness:
            "For n equal-distance trips with speeds vi, total time is the sum of d/vi and total distance is n*d. The average speed is n*d divided by d times the sum of 1/vi, which cancels d and leaves n divided by the sum of reciprocals. That is precisely the computed value.",
        complexityRationale:
            "Each value is visited once with a constant number of arithmetic operations, giving O(n) time. The bars require O(n) space for the visualization.",
        uses: [
            "Average speed over equal-distance travel segments",
            "Equivalent resistance of parallel conductors of equal length",
            "Averaging precision and recall into the F1 score",
        ],
        references: [
            "Casella and Berger, Statistical Inference, section on means of transformed variables",
            "NIST/SEMATECH e-Handbook of Statistical Methods, descriptive statistics",
        ],
        workedExample:
            "For speeds 1, 2, and 4 the reciprocal sum is 1 + 0.5 + 0.25 = 1.75. Dividing the count 3 by 1.75 gives 1.714, which is below the arithmetic mean 2.333, as expected for a rate average.",
    },
    id: "harmonic-mean",
    name: "Harmonic Mean",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [1, 2, 4, 8] },
    visualType: "array",
    run,
    pseudocode: [
        "start with a zero reciprocal sum and a positive-input flag",
        "if the list is empty, report no harmonic mean",
        "for each value v from left to right",
        "if v is not positive, mark the result invalid",
        "otherwise add 1/v to the running reciprocal sum",
        "divide the count by the reciprocal sum",
        "done: report n divided by the reciprocal sum as the harmonic mean",
    ],
};

export default module;
