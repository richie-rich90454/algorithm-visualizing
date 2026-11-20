/**
 * mean-squared-error-loss.ts - Mean Squared Error Loss
 *
 * MSE averages the squared difference between a prediction and its target.
 * Its derivative with respect to a prediction is linear in the residual, which
 * makes it the canonical regression objective. An optional per-sample weight
 * turns the plain average into a weighted average.
 *
 * Time O(n) for n samples, space O(n) for the per-sample table.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MseInput {
    predictions?: number[];
    targets?: number[];
    weights?: number[];
}

export interface MseStats {
    residuals: number[];
    squared: number[];
    gradients: number[];
    loss: number;
    n: number;
}

/** Compute residuals, squared errors, prediction gradients, and the mean. */
export function computeMse(predictions: number[], targets: number[], weights?: number[]): MseStats {
    const n = Math.min(predictions.length, targets.length);
    const residuals: number[] = [];
    const squared: number[] = [];
    const gradients: number[] = [];
    const w = (i: number) => (weights && i < weights.length ? Math.max(0, weights[i] ?? 0) : 1);
    let weightSum = 0;
    let lossSum = 0;
    for (let i = 0; i < n; i += 1) {
        const residual = (predictions[i] ?? 0) - (targets[i] ?? 0);
        const weight = w(i);
        residuals.push(residual);
        squared.push(weight * residual * residual);
        weightSum += weight;
        lossSum += weight * residual * residual;
    }
    const denominator = weightSum > 0 ? weightSum : 1;
    for (let i = 0; i < n; i += 1) {
        gradients.push((2 * w(i) * (residuals[i] ?? 0)) / denominator);
    }
    return { residuals, squared, gradients, loss: lossSum / denominator, n };
}

const COLUMNS = ["prediction", "target", "residual", "squared", "gradient"];

function makeCells(stats: MseStats, predictions: number[], targets: number[], revealed: number, active: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < stats.n; row += 1) {
        const values = [
            predictions[row] ?? 0,
            targets[row] ?? 0,
            stats.residuals[row] ?? 0,
            stats.squared[row] ?? 0,
            stats.gradients[row] ?? 0,
        ];
        COLUMNS.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === active ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? `${column} ${(values[col] ?? 0).toFixed(3)}` : "?",
                value: shown ? (values[col] ?? 0) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MseInput | null) ?? {};
    const predictions: number[] = Array.isArray(task.predictions) && task.predictions.length > 0
        ? task.predictions
        : [1.2, 2.1, -0.4, 3.3, 5.1];
    const targets: number[] = Array.isArray(task.targets) && task.targets.length === predictions.length
        ? task.targets
        : [1, 2, 0, 3, 5];
    const weights = Array.isArray(task.weights) && task.weights.length === predictions.length ? task.weights : undefined;
    const stats = computeMse(predictions, targets, weights);
    const base = { rows: stats.n, cols: COLUMNS.length, loss: stats.loss, weighted: Boolean(weights) };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(stats, predictions, targets, -1, -1),
        edges: [],
        description: `Mean squared error over ${stats.n} sample(s): average the squared residuals and track each gradient.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, gradients: stats.gradients },
    };
    step += 1;

    for (let i = 0; i < stats.n; i += 1) {
        const gradient = stats.gradients[i] ?? 0;
        yield {
            stepNumber: step,
            entities: makeCells(stats, predictions, targets, i, i),
            edges: [],
            description: `Sample ${i}: residual ${(stats.residuals[i] ?? 0).toFixed(3)}, squared ${(stats.squared[i] ?? 0).toFixed(3)}, gradient ${gradient.toFixed(3)}.`,
            codeLineNumber: gradient >= 0 ? 3 : 4,
            layout: "grid",
            meta: { ...base, active: i, gradients: stats.gradients },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(stats, predictions, targets, stats.n - 1, -1),
        edges: [],
        description: `Done: mean squared error is ${stats.loss.toFixed(4)} across ${stats.n} sample(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, loss: stats.loss, gradients: stats.gradients, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "For every prediction, measure how far it is from the target, square that distance so positive and negative mistakes both count, and average the results. The squaring makes large errors costly and gives the loss a smooth quadratic bowl. Differentiating the bowl gives a gradient that points back toward the target with a strength proportional to the residual.",
        invariants: [
            "The residual is the prediction minus the target.",
            "Every squared error is nonnegative, so the mean loss is nonnegative and is zero only for perfect predictions.",
            "The gradient with respect to a prediction is twice its residual divided by the sample count.",
        ],
        correctness:
            "Each row's residual is computed directly and squared, so the running sum is the total squared error. Dividing by the total weight (the sample count when unweighted) gives the mean, which is zero exactly when every residual vanishes. Differentiating the weighted objective term by term yields two times the weight times the residual over the same denominator; the tests verify this both against an independent recomputation and against a finite-difference estimate.",
        complexityRationale:
            "One pass over the n samples computes every residual and accumulates the totals, and a second pass fills the gradient array, so the work is O(n) with O(n) space for the displayed table.",
        uses: [
            "Regression model training and evaluation",
            "Autoencoder reconstruction error",
            "Curve fitting and least-squares objectives",
        ],
        references: [
            "Bishop, Pattern Recognition and Machine Learning, Section 1.5",
            "Goodfellow, Bengio, and Courville, Deep Learning, Chapter 6",
        ],
        workedExample:
            "For predictions 1.2 and 3.3 against targets 1 and 3, the residuals are 0.2 and 0.3, the squared errors are 0.04 and 0.09, and the mean is 0.065. The gradients are 0.2 and 0.3, each pushing its prediction back toward the target.",
    },
    id: "mean-squared-error-loss",
    name: "Mean Squared Error Loss",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        predictions: [1.2, 2.1, -0.4, 3.3, 5.1],
        targets: [1, 2, 0, 3, 5],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "set the running squared-error sum and weight sum to zero",
        "for each sample compute residual equals prediction minus target",
        "add the weight times the residual squared to the sum",
        "for a positive residual the gradient is positive and pushes the prediction down",
        "for a negative residual the gradient is negative and pushes the prediction up",
        "divide the squared-error sum by the total weight to get the mean",
        "done: report the mean squared error and every sample gradient",
    ],
};

export default module;
