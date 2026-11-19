/**
 * yeo-johnson-transformation.ts - Yeo-Johnson Power Transformation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Yeo-Johnson family maps real-valued data toward a normal shape by a
 * power transform. Unlike Box-Cox it accepts zero and negative inputs, using
 * a mirrored branch below zero so the whole function stays continuous and
 * strictly increasing. The special cases lambda = 1 and lambda = 2 give the
 * identity and a logarithmic branch respectively.
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
 *   - Each sample value is drawn as a bar.
 *   - The bar currently being transformed is highlighted.
 *   - The final frame is green and reports every transformed value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const EPS = 1e-12;

function forward(x: number, lambda: number): number {
    if (x >= 0) {
        return Math.abs(lambda) < EPS ? Math.log1p(x) : (Math.pow(x + 1, lambda) - 1) / lambda;
    }
    return Math.abs(lambda - 2) < EPS
        ? -Math.log1p(-x)
        : -(Math.pow(1 - x, 2 - lambda) - 1) / (2 - lambda);
}

function inverse(y: number, lambda: number): number {
    if (y >= 0) {
        return Math.abs(lambda) < EPS ? Math.expm1(y) : Math.pow(lambda * y + 1, 1 / lambda) - 1;
    }
    return Math.abs(lambda - 2) < EPS
        ? 1 - Math.exp(-y)
        : 1 - Math.pow((2 - lambda) * -y + 1, 1 / (2 - lambda));
}

function makeBars(values: number[], active: number, done: boolean, lambda: number): VisualEntity[] {
    return values.map((value, index) => {
        const output = forward(value, lambda);
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: done ? output.toFixed(3) : value.toFixed(3),
            value: done ? output : value,
            state: done ? "sorted" : (index === active ? "comparing" : "idle"),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, input: value, output },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; lambda?: number } | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map((v) => Number(v) || 0)
        : [-3, -1, 0, 1, 4];
    const lambda = typeof task.lambda === "number" ? task.lambda : 0.5;
    const n = values.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values, -1, false, lambda),
        edges: [],
        description: `Applying the Yeo-Johnson transform with lambda ${lambda.toFixed(3)} to ${n} real value(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, lambda, transformed: values.map((v) => forward(v, lambda)) },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const value = values[i] ?? 0;
        const output = forward(value, lambda);
        yield {
            stepNumber: step,
            entities: makeBars(values, i, false, lambda),
            edges: [],
            description: `${value.toFixed(3)} on the ${value < 0 ? "negative" : "nonnegative"} branch maps to ${output.toFixed(4)}.`,
            codeLineNumber: value < 0 ? 3 : 2,
            layout: "array",
            meta: { n, lambda, current: i, input: value, output, branch: value < 0 ? "negative" : "nonnegative" },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(values, -1, true, lambda),
        edges: [],
        description: `Finished: all ${n} values transformed and the mapping is strictly increasing.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, lambda, transformed: values.map((v) => forward(v, lambda)) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Power transforms pull skewed data toward a bell shape by stretching one tail and compressing the other. Yeo-Johnson extends the idea to negative numbers by reflecting them through zero and using a second power with exponent two minus lambda. At the join the two branches meet smoothly, so the transform never jumps.",
        invariants: [
            "The transform is strictly increasing, so it never changes the relative order of two values.",
            "Zero always maps to zero, and lambda = 1 leaves the data unchanged.",
            "On the nonnegative branch the formula is the shifted Box-Cox transform, while the negative branch mirrors it.",
        ],
        correctness:
            "For nonnegative inputs the formula is (x+1)^lambda minus one over lambda, which is strictly increasing because its derivative is (x+1)^(lambda-1) greater than zero. For negative inputs the mirrored formula has derivative (1-x)^(1-lambda) greater than zero. Both branches evaluate to zero at x = 0, so the pieces join continuously; applying the stated inverse to each output recovers the input exactly.",
        complexityRationale:
            "Each value needs a fixed number of arithmetic operations, so the transform is O(n) and the inverse is O(n). The bars hold one output per input, giving O(n) space.",
        uses: [
            "Preprocessing skewed predictors for linear and logistic regression",
            "Stabilizing variance before fitting a Gaussian model",
            "Handling signed measurements such as profit-and-loss values",
        ],
        references: [
            "Yeo and Johnson, A New Family of Power Transformations to Improve Normality, 2000",
            "Box and Cox, An Analysis of Transformations, 1964",
        ],
        workedExample:
            "With lambda = 2 the negative branch uses a logarithm: the input -1 maps to -log(2) about -0.693, while 0 stays at 0. With lambda = 1 every input maps to itself, so the list -3, -1, 0, 1, 4 is returned unchanged.",
    },
    id: "yeo-johnson-transformation",
    name: "Yeo-Johnson Transformation",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [-3, -1, 0, 1, 4], lambda: 0.5 },
    visualType: "array",
    run,
    pseudocode: [
        "read the values and the power parameter lambda",
        "for each value choose the branch by its sign",
        "if the value is nonnegative compute ((x+1)^lambda - 1) / lambda",
        "otherwise compute -(((1-x)^(2-lambda) - 1) / (2-lambda))",
        "use the log limit when lambda is zero or two",
        "report all transformed values",
    ],
};

export default module;
