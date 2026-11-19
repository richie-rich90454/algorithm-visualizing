/**
 * tukey-loss.ts - Tukey Biweight Loss
 *
 * Tukey's biweight loss is a redescending robust loss. For a residual r and
 * tuning constant c it equals (c^2/6)*(1 - (1 - (r/c)^2)^3) when |r| <= c, and
 * the constant c^2/6 beyond that. Because the weight given to a sample falls to
 * zero at the cutoff, extreme outliers are discarded rather than downweighted.
 *
 * Time O(n) over n residuals, space O(n) for the per-example values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface TukeyResult {
    residual: number;
    cutoff: number;
    weight: number;
    loss: number;
    rejected: boolean;
}

/** Compute Tukey's biweight loss and its effective weight for one residual. */
export function tukeyFor(residual: number, cutoff: number): TukeyResult {
    const c = cutoff > 0 ? cutoff : 4.685;
    const ratio = residual / c;
    const inside = Math.abs(ratio) <= 1;
    const oneMinus = 1 - ratio * ratio;
    const weight = inside ? oneMinus * oneMinus : 0;
    const cap = (c * c) / 6;
    const loss = inside ? cap * (1 - oneMinus * oneMinus * oneMinus) : cap;
    return { residual, cutoff: c, weight, loss, rejected: !inside };
}

function makeCells(results: TukeyResult[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const columns = ["residual", "weight", "loss", "status"];
    results.forEach((result, row) => {
        const values = [result.residual, result.weight, result.loss];
        columns.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === current ? "comparing" : shown ? "sorted" : "idle";
            const text = column === "status"
                ? (shown ? (result.rejected ? "rejected" : "kept") : "?")
                : col < 3
                    ? (shown ? `${column} ${(values[col] ?? 0).toFixed(4)}` : "?")
                    : "?";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: text,
                value: shown && col < 3 ? (values[col] ?? 0) : 0,
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
    const task = (input as { predictions?: number[]; targets?: number[]; cutoff?: number } | null) ?? {};
    const predictions: number[] = Array.isArray(task.predictions) && task.predictions.length > 0
        ? task.predictions
        : [0.2, 1.4, -0.3, 3.2, 0.1, -5];
    const targets: number[] = Array.isArray(task.targets) && task.targets.length === predictions.length
        ? task.targets
        : [0, 1, 0, 1, 0, 0];
    const cutoff = typeof task.cutoff === "number" && task.cutoff > 0 ? task.cutoff : 2;
    const residuals = predictions.map((prediction, i) => prediction - (targets[i] ?? 0));
    const results = residuals.map((r) => tukeyFor(r, cutoff));
    const losses = results.map((r) => r.loss);
    const mean = losses.reduce((a, b) => a + b, 0) / (losses.length || 1);
    const rejected = results.filter((r) => r.rejected).length;
    const metaBase = { rows: results.length, cols: 4, cutoff, mean, rejected };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, -1, -1),
        edges: [],
        description: `Tukey biweight loss on ${results.length} residuals with cutoff ${cutoff}: outliers past the cutoff are discarded.`,
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
            description: `Example ${i}: residual ${(r?.residual ?? 0).toFixed(3)} has weight ${(r?.weight ?? 0).toFixed(3)} and loss ${(r?.loss ?? 0).toFixed(4)}${r?.rejected ? " - rejected as an outlier" : ""}.`,
            codeLineNumber: r?.rejected ? 2 : 3,
            layout: "grid",
            meta: { ...metaBase, current: i, losses },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(results, results.length - 1, -1),
        edges: [],
        description: `Done: mean biweight loss ${mean.toFixed(4)} with ${rejected} outlier(s) rejected.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, losses, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Most robust losses still give a small but nonzero pull to huge outliers. Tukey's biweight goes further: past a chosen cutoff its weight becomes exactly zero, so an extreme point is thrown out of the fit. Near zero it rises like a quadratic, which keeps ordinary examples well behaved.",
        invariants: [
            "The residual is prediction minus target and the cutoff c is positive.",
            "For |r| <= c the loss is (c^2/6)*(1 - (1 - (r/c)^2)^3).",
            "For |r| > c the loss is the constant c^2/6 and the weight is zero.",
        ],
        correctness:
            "Both branches are direct evaluations of the definition. At |r| = c the factor (1 - (r/c)^2) is zero, so the inside value equals c^2/6, matching the outside value and making the function continuous; its derivative also vanishes there, so it is smooth. The function is even because it uses (r/c)^2, is zero at r = 0, and is bounded above by c^2/6, beyond which every residual gets the same penalty. The tests confirm the formula, the cap, evenness, and zero weight past the cutoff.",
        complexityRationale:
            "Each residual takes a fixed number of multiplications, so the evaluation is O(n) time and O(n) space to retain the values.",
        uses: [
            "Robust regression that fully rejects gross outliers",
            "Iteratively reweighted least squares with redescending weights",
            "Computer vision alignment such as Tukey window matching",
        ],
        references: [
            "Tukey, Exploratory Data Analysis, Addison-Wesley, 1977",
            "Huber and Ronchetti, Robust Statistics, Second Edition, 2009",
        ],
        workedExample:
            "With cutoff 2 the cap is 4/6 = 0.6667. A residual of 1 gives (1 - (1 - 0.25)^3)*0.6667 = 0.3542. A residual of 3 exceeds the cutoff, so its loss is the full cap 0.6667 and its weight is zero, meaning it is ignored by the gradient.",
    },
    id: "tukey-loss",
    name: "Tukey Biweight Loss",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        predictions: [0.2, 1.4, -0.3, 3.2, 0.1, -5],
        targets: [0, 1, 0, 1, 0, 0],
        cutoff: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each example compute the residual as prediction minus target",
        "let u be the residual divided by the cutoff c",
        "if the absolute value of u exceeds one the loss is c squared over six",
        "otherwise set the weight to one minus u squared, squared",
        "set the loss to c squared over six times one minus the weight cubed",
        "accumulate the losses and count rejected outliers",
        "done: report the mean loss and number of rejected examples",
    ],
};

export default module;
