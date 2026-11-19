/**
 * log-cosh-loss.ts - Log-Cosh Loss
 *
 * Log-cosh loss is log(cosh(r)) for a residual r. It behaves like 0.5*r^2 for
 * small residuals and like |r| - log(2) for large ones, giving a smooth version
 * of absolute error. Unlike Huber loss it is twice differentiable everywhere.
 *
 * The implementation uses the stable form |r| + log(1 + exp(-2|r|)) - log(2),
 * which avoids overflow for large residuals.
 *
 * Time O(n) over n residuals, space O(n) for the per-example values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface LogCoshResult {
    residual: number;
    loss: number;
}

/** Compute log(cosh(r)) in a numerically stable way. */
export function logCoshFor(residual: number): LogCoshResult {
    const magnitude = Math.abs(residual);
    const loss = magnitude + Math.log1p(Math.exp(-2 * magnitude)) - Math.LN2;
    return { residual, loss };
}

function makeCells(results: LogCoshResult[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const columns = ["residual", "|r|", "loss", "smooth"];
    results.forEach((result, row) => {
        const values = [result.residual, Math.abs(result.residual), result.loss, 1];
        columns.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === current ? "comparing" : shown ? "sorted" : "idle";
            const text = column === "smooth"
                ? (shown ? "yes" : "?")
                : (shown ? `${column} ${(values[col] ?? 0).toFixed(4)}` : "?");
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: text,
                value: shown ? (values[col] ?? 0) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { predictions?: number[]; targets?: number[] } | null) ?? {};
    const predictions: number[] = Array.isArray(task.predictions) && task.predictions.length > 0
        ? task.predictions
        : [1.05, 0.6, -0.9, 2.8, 0.1, -2.1];
    const targets: number[] = Array.isArray(task.targets) && task.targets.length === predictions.length
        ? task.targets
        : [1, 0, -1, 2, 0, -1];
    const residuals = predictions.map((prediction, i) => prediction - (targets[i] ?? 0));
    const results = residuals.map((r) => logCoshFor(r));
    const losses = results.map((r) => r.loss);
    const mean = losses.reduce((a, b) => a + b, 0) / (losses.length || 1);
    const metaBase = { rows: results.length, cols: 4, mean };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, -1, -1),
        edges: [],
        description: `Log-cosh loss on ${results.length} residuals: a smooth, twice-differentiable absolute error.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, losses },
    };
    step += 1;

    for (let i = 0; i < results.length; i += 1) {
        const r = results[i];
        yield {
            stepNumber: step,
            entities: makeCells(results, i, i),
            edges: [],
            description: `Example ${i}: residual ${(r?.residual ?? 0).toFixed(3)}, loss ${(r?.loss ?? 0).toFixed(4)}.`,
            codeLineNumber: Math.abs(r?.residual ?? 0) < 2 ? 2 : 3,
            layout: "grid",
            meta: { ...metaBase, current: i, losses },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(results, results.length - 1, -1),
        edges: [],
        description: `Done: mean log-cosh loss over the batch is ${mean.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, losses, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Absolute error has a sharp corner at zero, and squared error overreacts to outliers. Log-cosh blends them: near zero it looks quadratic, far away it looks linear, and in between it is perfectly smooth. That smoothness means second-order optimizers can use its curvature everywhere.",
        invariants: [
            "The residual is prediction minus target and the loss is log(cosh(residual)).",
            "The loss is even in the residual and nonnegative, with value zero at zero.",
            "For small residuals it is about 0.5*r^2 and for large ones about |r| - log(2).",
        ],
        correctness:
            "The stable expression |r| + log(1 + exp(-2|r|)) - log(2) is algebraically equal to log(cosh(r)): cosh(r) = 0.5*exp(|r|)*(1 + exp(-2|r|)). It is even because it depends only on |r|, and zero at r = 0 because log(1+1) = log(2). Its derivative tanh(r) is bounded by one, and its second derivative sech^2(r) is positive and smooth, so the loss is convex and twice differentiable. The tests compare against a direct log(cosh) computation on moderate inputs and check evenness and the small- and large-residual limits.",
        complexityRationale:
            "Each residual needs one exponent, one logarithm, and a few additions, all constant time, so the batch costs O(n) time and O(n) space.",
        uses: [
            "Robust regression with a smooth objective",
            "Losses for second-order and Newton-style training",
            "Keras and deep learning regression heads",
        ],
        references: [
            "Dubey et al., Two-Stage ArchiNet for Face Recognition, 2018",
            "Goodfellow et al., Deep Learning, Chapter 6, 2016",
        ],
        workedExample:
            "For residual 0.1, log(cosh(0.1)) is about 0.005, close to 0.5*0.1^2 = 0.005. For residual 5, the loss is about 4.31, close to 5 - log(2) = 4.31, so a large outlier contributes roughly its magnitude.",
    },
    id: "log-cosh-loss",
    name: "Log-Cosh Loss",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        predictions: [1.05, 0.6, -0.9, 2.8, 0.1, -2.1],
        targets: [1, 0, -1, 2, 0, -1],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each example compute the residual as prediction minus target",
        "take the absolute value of the residual",
        "compute log of one plus exp of minus twice that magnitude",
        "add the magnitude and subtract log of two",
        "the result is log cosh of the residual",
        "accumulate the losses over the batch",
        "done: report the mean log cosh loss",
    ],
};

export default module;
