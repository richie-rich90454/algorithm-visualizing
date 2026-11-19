/**
 * squared-hinge-loss.ts - Squared Hinge Loss
 *
 * Squared hinge loss is max(0, 1 - y*s)^2 for a label y in {-1, +1} and a raw
 * score s. It keeps the zero region of the ordinary hinge but replaces the
 * linear penalty with a quadratic one, giving a continuous derivative at the
 * margin boundary. It is the objective used by least-squares SVMs.
 *
 * Time O(n) over n examples, space O(n) for the per-example values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface SquaredHingeResult {
    label: number;
    score: number;
    margin: number;
    hinge: number;
    loss: number;
}

/** Compute the hinge amount, its square, and the signed margin for one example. */
export function squaredHingeFor(label: number, score: number): SquaredHingeResult {
    const margin = label * score;
    const hinge = Math.max(0, 1 - margin);
    return { label, score, margin, hinge, loss: hinge * hinge };
}

function makeCells(results: SquaredHingeResult[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const columns = ["margin", "hinge", "loss", "y*s"];
    results.forEach((result, row) => {
        const values = [result.margin, result.hinge, result.loss, result.margin];
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
    const task = (input as { scores?: number[]; labels?: number[] } | null) ?? {};
    const scores: number[] = Array.isArray(task.scores) && task.scores.length > 0
        ? task.scores
        : [1.4, 0.2, -0.6, 2.1, -1.2, 0.4];
    const labels: number[] = Array.isArray(task.labels) && task.labels.length === scores.length
        ? task.labels
        : scores.map((_s, i) => (i % 2 === 0 ? 1 : -1));
    const results = scores.map((score, i) => squaredHingeFor(labels[i] ?? 1, score));
    const losses = results.map((r) => r.loss);
    const mean = losses.reduce((a, b) => a + b, 0) / (losses.length || 1);
    const metaBase = { rows: results.length, cols: 4, mean };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, -1, -1),
        edges: [],
        description: `Squared hinge loss on ${results.length} examples: square the margin shortfall.`,
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
            description: `Example ${i}: margin ${(r?.margin ?? 0).toFixed(3)}, hinge ${(r?.hinge ?? 0).toFixed(3)}, squared loss ${(r?.loss ?? 0).toFixed(4)}.`,
            codeLineNumber: r && r.hinge > 0 ? 3 : 2,
            layout: "grid",
            meta: { ...metaBase, current: i, losses },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(results, results.length - 1, -1),
        edges: [],
        description: `Done: mean squared hinge loss over the batch is ${mean.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, losses, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Squared hinge loss starts with the same margin idea as the hinge but squares the shortfall. Close to the margin boundary the penalty is tiny and its slope is zero, which makes the objective smooth and gives least-squares SVMs a solvable system of linear equations.",
        invariants: [
            "The signed margin is the product y times s.",
            "The hinge amount is max(0, 1 - y*s) and the loss is its square.",
            "The loss is zero exactly when the margin is at least one.",
        ],
        correctness:
            "Each value is max(0, 1 - y*s)^2 evaluated exactly. Because squaring a nonnegative number is monotone, the loss preserves the zero region and the ordering of hinge penalties; it is always nonnegative and behaves quadratically for small violations. Its derivative with respect to s is minus two times y times the hinge amount when the margin is violated and zero otherwise, which is continuous at the boundary. The tests check the definition, the zero region, and these properties.",
        complexityRationale:
            "Each example uses a fixed number of arithmetic operations, so the total is O(n) time and O(n) space to keep the per-example losses.",
        uses: [
            "Least-squares support vector machines",
            "Smooth margin objectives with continuous gradients",
            "Regression-style classification formulations",
        ],
        references: [
            "Suykens and Vandewalle, Least Squares Support Vector Machine Classifiers, 1999",
            "Bishop, Pattern Recognition and Machine Learning, Section 7.1, 2006",
        ],
        workedExample:
            "With y=+1 and s=0.7 the margin is 0.7 and the hinge is 0.3, so the squared loss is 0.09. Ordinary hinge would give 0.3. With y=+1 and s=1.5 the margin exceeds one, so both losses are zero.",
    },
    id: "squared-hinge-loss",
    name: "Squared Hinge Loss",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        scores: [1.4, 0.2, -0.6, 2.1, -1.2, 0.4],
        labels: [1, -1, 1, -1, -1, 1],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each example take the true label y and the raw score s",
        "compute the signed margin as y times s",
        "if the margin is at least one set the loss to zero",
        "otherwise compute the hinge as one minus the margin",
        "square the hinge to obtain the squared loss",
        "accumulate the losses over the batch",
        "done: report the mean squared hinge loss",
    ],
};

export default module;
