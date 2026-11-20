/**
 * pinball-loss.ts - Pinball (Quantile / Check) Loss
 *
 * For a residual r = target - prediction and a quantile level tau in (0, 1),
 * the pinball loss is tau*r when r >= 0 and (tau - 1)*r otherwise. Minimizing it
 * estimates the tau-th conditional quantile; tau = 0.5 gives half absolute
 * error, which is median regression.
 *
 * Time O(n) over n residuals, space O(n) for the per-example values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface PinballResult {
    residual: number;
    tau: number;
    loss: number;
    above: boolean;
}

/** Compute the check (pinball) loss for one residual at quantile level tau. */
export function pinballFor(residual: number, tau: number): PinballResult {
    const level = tau > 0 && tau < 1 ? tau : 0.5;
    const above = residual >= 0;
    const loss = above ? level * residual : (level - 1) * residual;
    return { residual, tau: level, loss, above };
}

function makeCells(results: PinballResult[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const columns = ["residual", "tau", "slope", "loss"];
    results.forEach((result, row) => {
        const values = [result.residual, result.tau, result.above ? result.tau : result.tau - 1, result.loss];
        columns.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === current ? "comparing" : shown ? "sorted" : "idle";
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
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { predictions?: number[]; targets?: number[]; tau?: number } | null) ?? {};
    const predictions: number[] = Array.isArray(task.predictions) && task.predictions.length > 0
        ? task.predictions
        : [0.4, 1.2, -0.5, 2.1, 0, -1.3];
    const targets: number[] = Array.isArray(task.targets) && task.targets.length === predictions.length
        ? task.targets
        : [1, 1, 0, 2, 0, -1];
    const tau = typeof task.tau === "number" && task.tau > 0 && task.tau < 1 ? task.tau : 0.5;
    const residuals = predictions.map((prediction, i) => (targets[i] ?? 0) - prediction);
    const results = residuals.map((r) => pinballFor(r, tau));
    const losses = results.map((r) => r.loss);
    const mean = losses.reduce((a, b) => a + b, 0) / (losses.length || 1);
    const metaBase = { rows: results.length, cols: 4, tau, mean };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, -1, -1),
        edges: [],
        description: `Pinball loss on ${results.length} residuals at quantile tau=${tau}: asymmetric slopes above and below the target.`,
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
            description: `Example ${i}: target minus prediction ${(r?.residual ?? 0).toFixed(3)}, prediction is ${r?.above ? "too low" : "too high"}, loss ${(r?.loss ?? 0).toFixed(4)}.`,
            codeLineNumber: r?.above ? 2 : 3,
            layout: "grid",
            meta: { ...metaBase, current: i, losses },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(results, results.length - 1, -1),
        edges: [],
        description: `Done: mean pinball loss over the batch is ${mean.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, losses, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A median ignores how far values are above or below it equally; other quantiles should lean one way. Pinball loss gives the two sides different slopes, tau and one minus tau. Pushing down its total finds the tau-th quantile, which is why it powers quantile regression and prediction intervals.",
        invariants: [
            "The residual used here is target minus prediction.",
            "For residual r >= 0 the loss is tau*r; for r < 0 it is (tau - 1)*r.",
            "The loss is nonnegative and zero when the prediction equals the target.",
        ],
        correctness:
            "Each value is a direct evaluation of the check function, so it is exact by definition. At tau = 0.5 the two slopes have equal magnitude and the loss reduces to 0.5*|r|, the median objective. In general the slope is tau on the positive side and tau - 1 on the negative side, so positive and negative residuals are penalized in the ratio tau to 1 - tau; this asymmetry is exactly what makes the minimizer the tau quantile. The tests confirm the formula, the median reduction, nonnegativity, and the slope ratio.",
        complexityRationale:
            "Each example uses a subtraction and one multiplication, giving O(n) time and O(n) space for the stored losses.",
        uses: [
            "Quantile regression and median regression",
            "Prediction intervals in gradient boosting",
            "Deep learning models that output distribution quantiles",
        ],
        references: [
            "Koenker and Bassett, Regression Quantiles, Econometrica, 1978",
            "Koenker, Quantile Regression, Cambridge University Press, 2005",
        ],
        workedExample:
            "At tau = 0.3 and a residual of 2 (target above prediction), the loss is 0.3*2 = 0.6. For a residual of -2, it is (0.3 - 1)*(-2) = 1.4. The larger penalty for underprediction pushes the fitted line upward toward the 30th percentile.",
    },
    id: "pinball-loss",
    name: "Pinball Loss",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        predictions: [0.4, 1.2, -0.5, 2.1, 0, -1.3],
        targets: [1, 1, 0, 2, 0, -1],
        tau: 0.5,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each example compute the residual as target minus prediction",
        "choose the quantile level tau between zero and one",
        "if the residual is nonnegative multiply it by tau",
        "otherwise multiply it by tau minus one",
        "the result is the pinball loss for that example",
        "accumulate the losses over the batch",
        "done: report the mean pinball loss",
    ],
};

export default module;
