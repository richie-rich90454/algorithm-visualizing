/**
 * box-cox-transformation.ts - Box-Cox Power Transformation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Box-Cox family stabilizes variance and makes skewed data more symmetric
 * by raising each positive value to a power. For lambda = 1 the result is x - 1,
 * and in the limiting case lambda = 0 it is the natural logarithm. The module
 * applies one chosen lambda to every value and displays both the input and the
 * transformed values as bars.
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
 *   - Each input value becomes a bar whose height is its transformed value.
 *   - The current value is YELLOW; final bars are GREEN.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function transform(x: number, lambda: number): number {
    return Math.abs(lambda) < 1e-12 ? Math.log(x) : (x ** lambda - 1) / lambda;
}

function makeBars(values: number[], lambda: number, states: Map<number, EntityState>, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: done ? transform(value, lambda).toFixed(3) : value.toFixed(2),
        value: done ? transform(value, lambda) : value,
        state: states.get(index) ?? (done ? "sorted" : "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, input: value, output: transform(value, lambda) },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; lambda?: number } | null) ?? {};
    const values: number[] = Array.isArray(task.values)
        ? task.values.map((v) => Math.max(1e-6, Number(v) || 1e-6))
        : [1, 2, 4, 8, 16, 32];
    const lambda = typeof task.lambda === "number" ? task.lambda : 0.5;
    const n = values.length;
    let step = 0;

    const frame = (
        states: Map<number, EntityState>,
        done: boolean,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean | number[]> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(values, lambda, states, done),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { n, lambda, transformed: values.map((v) => transform(v, lambda)), ...extra },
    });

    yield frame(new Map(), false, `Applying the Box-Cox transform with lambda ${lambda} to ${n} positive value(s).`, 0);
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const value = values[i] ?? 0;
        const output = transform(value, lambda);
        yield frame(new Map([[i, "comparing"]]), false, `Value ${value.toFixed(3)} maps to ${output.toFixed(4)} under the power transform.`, 2, { current: i });
        step += 1;
    }

    yield frame(new Map(), true, `Transformed all ${n} value(s) with lambda ${lambda}; the log case is used when lambda is zero.`, 4);
}

/** The Box-Cox transformation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Many statistical methods assume data that is roughly symmetric and has constant spread. A power transform bends a skewed scale into a friendlier one: it pulls large values in when lambda is below one and pushes them out when lambda is above one. Lambda of zero is the special case that takes logarithms.",
        invariants: [
            "Every input value is positive, so powers and logarithms are defined.",
            "The transform is applied with the same lambda to every value.",
            "At lambda one each value maps to itself minus one.",
        ],
        correctness:
            "For nonzero lambda the module evaluates (x to the lambda minus one) over lambda directly, which is the Box-Cox definition. As lambda approaches zero that quotient tends to the natural logarithm of x by continuity, and the module selects the logarithm when lambda is within a small tolerance of zero. Values are clamped to a small positive floor so the domain restriction is respected.",
        complexityRationale:
            "Each value takes one power or logarithm evaluation, so transforming n values is O(n); the bars for the display use O(n) space.",
        uses: [
            "Stabilizing variance before linear regression",
            "Normalizing skewed biological assay measurements",
            "Preparing economic time series for modeling",
        ],
        references: [
            "Box and Cox, An Analysis of Transformations, 1964",
            "Draper and Smith, Applied Regression Analysis, Chapter 7",
        ],
        workedExample:
            "With lambda 0.5 the transform is twice the square root minus two. The value 4 becomes twice two minus two, which is 2; the value 16 becomes twice four minus two, which is 6. With lambda zero the value 4 becomes the natural logarithm of 4, about 1.386.",
    },
    id: "box-cox-transformation",
    name: "Box-Cox Transformation",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [1, 2, 4, 8, 16, 32], lambda: 0.5 },
    visualType: "array",
    run,
    pseudocode: [
        "read the positive values and the power parameter lambda",
        "if lambda is zero use the natural logarithm branch",
        "otherwise compute x to the lambda minus one over lambda",
        "apply the chosen formula to every value",
        "done: report the transformed values",
    ],
};

export default module;
