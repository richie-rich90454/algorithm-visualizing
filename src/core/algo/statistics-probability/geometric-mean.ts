/**
 * geometric-mean.ts - Geometric Mean
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The geometric mean of n positive values is the nth root of their product.
 * To avoid overflowing on large products it is computed as the exponential of
 * the average of the logarithms: exp((ln x1 + ... + ln xn) / n). It is the
 * correct average for multiplicative data such as growth rates.
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
 *   - The value currently added to the log sum is HIGHLIGHT; finished bars
 *     are SORTED. The final frame shows the geometric mean in meta.
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

/** Accumulate logarithms and exponentiate their average. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = Array.isArray(task.values)
        ? task.values.map(Number)
        : [1, 2, 4, 8, 16];

    let step = 0;
    if (values.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "No values were supplied, so the geometric mean is undefined.",
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
        description: `Compute the geometric mean of ${values.length} positive values by averaging logarithms.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { count: values.length, logSum: 0, valid: true },
    };
    step += 1;

    let logSum = 0;
    let valid = true;
    for (let i = 0; i < values.length; i += 1) {
        const value = values[i] ?? 0;
        if (value > 0) {
            logSum += Math.log(value);
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
            description: `Value ${value}: add ln(${value.toFixed(4)}) to the running log sum.`,
            codeLineNumber: value > 0 ? 4 : 3,
            layout: "array",
            meta: { count: values.length, index: i, logSum, valid },
        };
        step += 1;
    }

    const result = valid ? Math.exp(logSum / values.length) : 0;
    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < values.length; i += 1) {
        finalStates.set(i, valid ? "sorted" : "idle");
    }
    yield {
        stepNumber: step,
        entities: makeBars(values, finalStates),
        edges: [],
        description: valid
            ? `Geometric mean = exp(${logSum.toFixed(4)} / ${values.length}) = ${result.toFixed(4)}.`
            : "A nonpositive value was found, so the geometric mean is undefined.",
        codeLineNumber: 6,
        layout: "array",
        meta: { count: values.length, logSum, result, valid },
    };
}

/** The geometric mean module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "An arithmetic average answers what single addend would reproduce a sum; the geometric mean answers what single factor would reproduce a product. Work in logarithms so a product of many numbers becomes a sum that cannot overflow. Exponentiating the average logarithm returns the multiplicative center of the data.",
        invariants: [
            "The running log sum equals the sum of logarithms of the values processed so far.",
            "Every positive value contributes exactly one logarithm.",
            "The exponential and logarithm are inverse functions, so exp(average log) is the nth root of the product.",
        ],
        correctness:
            "Let S be the sum of ln(xi). Since the logarithm is injective and additive on positive reals, exp(S / n) equals the product of the xi raised to the power 1/n, which is exactly the nth root of the product. Computing in log space changes only the arithmetic path, not the value.",
        complexityRationale:
            "The loop visits each of the n values once and does constant work per value, so time is O(n). The bars mirror the input, so O(n) space is used for the visualization.",
        uses: [
            "Average annual investment return over several years",
            "Summarizing growth rates and other multiplicative quantities",
            "Comparing skewed biological or environmental measurements",
        ],
        references: [
            "Casella and Berger, Statistical Inference, section on transformations and averages",
            "NIST/SEMATECH e-Handbook of Statistical Methods, descriptive statistics",
        ],
        workedExample:
            "For the values 1, 2, 4, 8, 16 the log sum is 0 + 0.693 + 1.386 + 2.079 + 2.773 = 6.931. Dividing by 5 gives 1.386 and exponentiating gives 4, the fifth root of the product 1024.",
    },
    id: "geometric-mean",
    name: "Geometric Mean",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [1, 2, 4, 8, 16] },
    visualType: "array",
    run,
    pseudocode: [
        "start with a zero logarithm sum and a positive-input flag",
        "if the list is empty, report no geometric mean",
        "for each value v from left to right",
        "if v is not positive, mark the result invalid",
        "otherwise add ln(v) to the running sum",
        "divide the sum by the count and exponentiate",
        "done: report exp(mean of logarithms) as the geometric mean",
    ],
};

export default module;
