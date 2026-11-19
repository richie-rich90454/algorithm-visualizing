/**
 * hinge-loss.ts - Hinge Loss for Margin Classifiers
 *
 * For a true label y in {-1, +1} and a raw classifier score s, the hinge loss
 * is max(0, 1 - y*s). It is zero once the score has the right sign and a margin
 * of at least one, and grows linearly otherwise. This is the loss minimized by
 * linear support vector machines.
 *
 * Time O(n) over n examples, space O(n) for the per-example values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface HingeResult {
    label: number;
    score: number;
    margin: number;
    loss: number;
    violated: boolean;
}

/** Compute the signed margin and the hinge penalty for one example. */
export function hingeFor(label: number, score: number): HingeResult {
    const margin = label * score;
    const loss = Math.max(0, 1 - margin);
    return { label, score, margin, loss, violated: margin < 1 };
}

function makeCells(results: HingeResult[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const columns = ["label", "score", "margin", "loss"];
    results.forEach((result, row) => {
        const values = [result.label, result.score, result.margin, result.loss];
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
        : [1.2, 0.3, -0.5, 2, -1.5, 0.1];
    const labels: number[] = Array.isArray(task.labels) && task.labels.length === scores.length
        ? task.labels
        : scores.map((_s, i) => (i % 2 === 0 ? 1 : -1));
    const results = scores.map((score, i) => hingeFor(labels[i] ?? 1, score));
    const losses = results.map((r) => r.loss);
    const mean = losses.reduce((a, b) => a + b, 0) / (losses.length || 1);
    const violations = results.filter((r) => r.violated).length;
    const metaBase = { rows: results.length, cols: 4, mean, violations };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, -1, -1),
        edges: [],
        description: `Hinge loss on ${results.length} examples: penalize scores with margin below one.`,
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
            description: `Example ${i}: y=${r?.label ?? 1}, score=${(r?.score ?? 0).toFixed(3)}, margin=${(r?.margin ?? 0).toFixed(3)}, loss=${(r?.loss ?? 0).toFixed(3)}${r?.violated ? " - margin violated" : " - safe"}.`,
            codeLineNumber: r?.violated ? 3 : 2,
            layout: "grid",
            meta: { ...metaBase, current: i, losses },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(results, results.length - 1, -1),
        edges: [],
        description: `Done: mean hinge loss ${mean.toFixed(4)} with ${violations} margin violation(s).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, losses, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A margin classifier wants each example not merely on the correct side of the boundary but at least one unit away from it. Hinge loss is zero for any score whose signed margin reaches one, and otherwise charges the shortfall linearly. That flat zero region is what makes the resulting model sparse in support vectors.",
        invariants: [
            "The signed margin is y times the raw score s.",
            "The loss is max(0, 1 - y*s) and is always nonnegative.",
            "An example is safe exactly when its margin is at least one.",
        ],
        correctness:
            "The value is a direct evaluation of max(0, 1 - y*s), so it is exact by definition. Flipping both the label and the score leaves the product y*s unchanged and therefore preserves the loss, matching the symmetry required of a margin classifier. The loss is zero precisely on the correct set with sufficient margin, and the subgradient is minus y on the violated side and zero otherwise. The property tests confirm the definition, the symmetry, and the zero region.",
        complexityRationale:
            "Each of the n examples needs a product, a subtraction, and a maximum, all constant time, so the run is O(n); storing one result per example uses O(n) space.",
        uses: [
            "Training linear support vector machines",
            "Margin objectives in structured prediction",
            "A piecewise-linear alternative to logistic loss",
        ],
        references: [
            "Cortes and Vapnik, Support-Vector Networks, Machine Learning, 1995",
            "Bishop, Pattern Recognition and Machine Learning, Section 7.1, 2006",
        ],
        workedExample:
            "For y=+1 and s=1.2 the margin is 1.2, so the loss is zero. For y=+1 and s=0.3 the margin is 0.3 and the loss is 0.7. For y=-1 and s=0.5 the margin is -0.5 and the loss is 1.5, a large penalty for a confidently wrong prediction.",
    },
    id: "hinge-loss",
    name: "Hinge Loss",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        scores: [1.2, 0.3, -0.5, 2, -1.5, 0.1],
        labels: [1, -1, 1, -1, -1, 1],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each example take the true label y and the raw score s",
        "compute the signed margin as y times s",
        "if the margin is at least one the loss is zero",
        "otherwise set the loss to one minus the margin",
        "equivalently take the maximum of zero and one minus y times s",
        "accumulate the losses and count violated margins",
        "done: report the mean loss and number of violations",
    ],
};

export default module;
