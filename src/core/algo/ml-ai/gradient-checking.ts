/**
 * gradient-checking.ts - Numerical Gradient Checking by Central Differences
 *
 * Before trusting a backpropagation implementation, compare its analytic
 * gradient with a numerical estimate. Central differences approximate the
 * partial derivative of a scalar loss at each coordinate; the relative error
 * between the two gradients should be tiny for a correct implementation and
 * large for a buggy one.
 *
 * Time is O(d * f) for d coordinates and one loss evaluation cost f; space is
 * O(d) for the two gradient vectors.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A small scalar objective: half squared error plus a smooth sinusoid. */
export function checkFunction(weights: number[], targets: number[]): number {
    let total = 0;
    for (let i = 0; i < weights.length; i += 1) {
        const w = weights[i] ?? 0;
        const y = targets[i] ?? 0;
        total += 0.5 * (w - y) ** 2 + Math.sin(w);
    }
    return total;
}

/** The exact analytic gradient of checkFunction. */
export function analyticGradient(weights: number[], targets: number[]): number[] {
    return weights.map((w, i) => w - (targets[i] ?? 0) + Math.cos(w));
}

/** Central-difference estimate of each partial derivative. */
export function numericalGradient(
    weights: number[],
    targets: number[],
    step: number,
): number[] {
    return weights.map((w, i) => {
        const plus = [...weights];
        const minus = [...weights];
        plus[i] = w + step;
        minus[i] = w - step;
        return (checkFunction(plus, targets) - checkFunction(minus, targets)) / (2 * step);
    });
}

/** Relative error between an analytic and a numerical gradient. */
export function relativeError(analytic: number[], numerical: number[]): number[] {
    return analytic.map((a, i) => {
        const n = numerical[i] ?? 0;
        return Math.abs(a - n) / (Math.abs(a) + Math.abs(n) + 1e-12);
    });
}

function makeCells(
    weights: number[],
    analytic: number[],
    numerical: number[],
    errors: number[],
    revealed: number,
): VisualEntity[] {
    const columns = ["w", "analytic", "numeric", "rel error"];
    const entities: VisualEntity[] = [];
    for (let i = 0; i < weights.length; i += 1) {
        const values = [weights[i] ?? 0, analytic[i] ?? 0, numerical[i] ?? 0, errors[i] ?? 0];
        for (let col = 0; col < columns.length; col += 1) {
            const shown = i <= revealed;
            const state: EntityState = i === revealed ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${i}-${col}`,
                type: "cell",
                label: shown ? `${columns[col]} ${(values[col] ?? 0).toFixed(5)}` : "?",
                value: shown ? (values[col] ?? 0) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { weights?: number[]; targets?: number[]; step?: number } | null) ?? {};
    const weights: number[] = task.weights ?? [0.2, -0.7, 1.1, 0.4];
    const targets: number[] = task.targets ?? [1, 0, -1, 0.5];
    const step = typeof task.step === "number" && task.step > 0 ? task.step : 1e-4;
    const analytic = analyticGradient(weights, targets);
    const numerical = numericalGradient(weights, targets, step);
    const errors = relativeError(analytic, numerical);
    const maxError = Math.max(...errors, 0);
    const passed = maxError < 1e-5;
    const metaBase = { rows: weights.length, cols: 4, maxError, step };

    let stepIndex = 0;
    yield {
        stepNumber: stepIndex,
        entities: makeCells(weights, analytic, numerical, errors, -1),
        edges: [],
        description: `Gradient checking ${weights.length} coordinates with central difference h = ${step}; comparing analytic backpropagation against numerical derivatives.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase },
    };
    stepIndex += 1;

    for (let i = 0; i < weights.length; i += 1) {
        yield {
            stepNumber: stepIndex,
            entities: makeCells(weights, analytic, numerical, errors, i),
            edges: [],
            description: `Coordinate ${i}: analytic ${(analytic[i] ?? 0).toFixed(6)}, numerical ${(numerical[i] ?? 0).toFixed(6)}, relative error ${(errors[i] ?? 0).toExponential(2)}.`,
            codeLineNumber: i < weights.length / 2 ? 1 : 3,
            layout: "grid",
            meta: { ...metaBase, current: i },
        };
        stepIndex += 1;
    }

    yield {
        stepNumber: stepIndex,
        entities: makeCells(weights, analytic, numerical, errors, weights.length - 1),
        edges: [],
        description: passed
            ? `Check passed: maximum relative error ${maxError.toExponential(2)} is below the tolerance, so the analytic gradient is trustworthy.`
            : `Check failed: maximum relative error ${maxError.toExponential(2)} exceeds the tolerance, so the analytic gradient may be wrong.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, passed },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Backpropagation is easy to get subtly wrong, so gradient checking acts as a unit test for the derivative. Perturb one parameter up and down by a tiny amount and use the slope of the loss across that gap as a numerical estimate of the derivative. If the analytic gradient from backpropagation agrees with that numerical slope to high precision, the derivative code is probably correct.",
        invariants: [
            "The numerical estimate uses a symmetric central difference, not a one-sided difference.",
            "Perturbing one coordinate leaves every other coordinate fixed.",
            "The relative error normalizes by the sum of the magnitudes so small and large gradients are compared fairly.",
        ],
        correctness:
            "Taylor expansion gives f(w+h) - f(w-h) = 2h f'(w) + O(h^3), so the central difference converges to the true derivative with error proportional to h squared. For the quadratic-plus-sine objective used here the analytic gradient is derived by elementary calculus, and the tests confirm that the central difference agrees to about one part in a million and that a deliberately corrupted gradient is rejected.",
        complexityRationale:
            "Each of the d coordinates needs two loss evaluations, each costing O(d), so checking costs O(d squared) in this dense example and O(d * f) for a general loss of cost f. Only the current pair of gradient vectors is stored, so space is O(d).",
        uses: [
            "Debugging backpropagation in new neural network layers",
            "Verifying automatic differentiation implementations",
            "Testing custom loss functions and gradients in scientific code",
        ],
        references: [
            "Ng, Machine Learning course notes, Gradient Checking, Stanford",
            "Goodfellow et al., Deep Learning, Chapter 6.5, 2016",
        ],
        workedExample:
            "At weight 0.2 with target 1 and step 0.0001, the analytic derivative is 0.2 - 1 + cos(0.2), about -0.5997. Evaluating the objective at 0.2001 and 0.1999 and dividing the difference by 0.0002 gives essentially the same number, so the relative error is around one in a million.",
    },
    id: "gradient-checking",
    name: "Gradient Checking",
    category: "ml-ai",
    complexity: { time: "O(d^2)", space: "O(d)" },
    defaultInput: {
        weights: [0.2, -0.7, 1.1, 0.4],
        targets: [1, 0, -1, 0.5],
        step: 1e-4,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a small step size h",
        "for each parameter coordinate i",
        "evaluate the loss at w plus h in coordinate i and at w minus h in coordinate i",
        "estimate the derivative as the loss difference divided by two h",
        "compute the relative error between analytic and numerical gradients",
        "done: report whether the maximum relative error passes the tolerance",
    ],
};

export default module;
