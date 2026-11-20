/**
 * huber-loss.ts - Huber Loss
 *
 * Huber loss is quadratic for small residuals and linear for large ones:
 * 0.5*r^2 when |r| <= delta, otherwise delta*(|r| - 0.5*delta). The quadratic
 * region keeps gradients well behaved near zero, while the linear region
 * reduces the influence of outliers compared with squared error.
 *
 * Time O(n) over n residuals, space O(n) for the per-example values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface HuberResult {
    residual: number;
    delta: number;
    loss: number;
    quadratic: boolean;
}

/** Compute the Huber loss for a single residual and threshold delta. */
export function huberFor(residual: number, delta: number): HuberResult {
    const threshold = delta > 0 ? delta : 1;
    const magnitude = Math.abs(residual);
    const quadratic = magnitude <= threshold;
    const loss = quadratic
        ? 0.5 * residual * residual
        : threshold * (magnitude - 0.5 * threshold);
    return { residual, delta: threshold, loss, quadratic };
}

function makeCells(results: HuberResult[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const columns = ["residual", "|r|", "region", "loss"];
    results.forEach((result, row) => {
        const values = [result.residual, Math.abs(result.residual), result.quadratic ? 1 : 0, result.loss];
        columns.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === current ? "comparing" : shown ? "sorted" : "idle";
            const text = column === "region"
                ? (shown ? (result.quadratic ? "quadratic" : "linear") : "?")
                : (shown ? `${column} ${(values[col] ?? 0).toFixed(3)}` : "?");
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
    const task = (input as { predictions?: number[]; targets?: number[]; delta?: number } | null) ?? {};
    const predictions: number[] = Array.isArray(task.predictions) && task.predictions.length > 0
        ? task.predictions
        : [1.1, 0.4, -0.8, 2.6, 0.05, -1.9];
    const targets: number[] = Array.isArray(task.targets) && task.targets.length === predictions.length
        ? task.targets
        : [1, 0, -1, 2, 0, -1];
    const delta = typeof task.delta === "number" && task.delta > 0 ? task.delta : 1;
    const residuals = predictions.map((prediction, i) => prediction - (targets[i] ?? 0));
    const results = residuals.map((r) => huberFor(r, delta));
    const losses = results.map((r) => r.loss);
    const mean = losses.reduce((a, b) => a + b, 0) / (losses.length || 1);
    const metaBase = { rows: results.length, cols: 4, delta, mean };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, -1, -1),
        edges: [],
        description: `Huber loss on ${results.length} residuals with delta=${delta}: quadratic near zero, linear for outliers.`,
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
            description: `Example ${i}: residual ${(r?.residual ?? 0).toFixed(3)} is in the ${r?.quadratic ? "quadratic" : "linear"} region, loss ${(r?.loss ?? 0).toFixed(4)}.`,
            codeLineNumber: r?.quadratic ? 2 : 3,
            layout: "grid",
            meta: { ...metaBase, current: i, losses },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(results, results.length - 1, -1),
        edges: [],
        description: `Done: mean Huber loss over the batch is ${mean.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, losses, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Squared error punishes a large mistake very harshly because it grows with the square of the residual. Huber loss keeps the friendly quadratic behavior for small errors but switches to a linear penalty past a threshold delta. Outliers then pull the fit far less, while ordinary noise still gets a smooth gradient.",
        invariants: [
            "The residual is the prediction minus the target.",
            "For |r| <= delta the loss is 0.5*r^2; for |r| > delta it is delta*(|r| - 0.5*delta).",
            "The loss is nonnegative, even in r, and continuous at |r| = delta.",
        ],
        correctness:
            "The two branches are evaluated directly from the definition, and at |r| = delta both give 0.5*delta^2, so the function is continuous. Its derivative is r inside the threshold and delta times the sign of r outside, with matching value delta at the junction, so the function is continuously differentiable. The branches are nonnegative and even, and as delta grows the quadratic region covers any fixed residual, recovering squared error. The tests verify the formula, continuity, evenness, and the large-delta limit.",
        complexityRationale:
            "Each residual requires an absolute value and a couple of multiplications, so the pass is O(n) time and O(n) space for the stored losses.",
        uses: [
            "Robust regression in the presence of outliers",
            "The regression head of Fast R-CNN",
            "Gradient estimators that need bounded influence",
        ],
        references: [
            "Huber, Robust Estimation of a Location Parameter, Annals of Mathematical Statistics, 1964",
            "Girshick, Fast R-CNN, ICCV 2015",
        ],
        workedExample:
            "With delta=1 and residual 0.5 the loss is 0.5*0.25 = 0.125. With residual 3 the loss is 1*(3 - 0.5) = 2.5, whereas squared error would be 4.5. At residual 1 both branches give 0.5.",
    },
    id: "huber-loss",
    name: "Huber Loss",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        predictions: [1.1, 0.4, -0.8, 2.6, 0.05, -1.9],
        targets: [1, 0, -1, 2, 0, -1],
        delta: 1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each example compute the residual as prediction minus target",
        "take the absolute value of the residual",
        "if it is at most delta use one half of the residual squared",
        "otherwise use delta times the absolute residual minus half of delta",
        "assign the chosen value as the example loss",
        "accumulate the losses over the batch",
        "done: report the mean Huber loss",
    ],
};

export default module;
