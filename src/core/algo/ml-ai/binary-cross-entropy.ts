/**
 * binary-cross-entropy.ts - Binary Cross-Entropy Loss
 *
 * For a predicted probability p of the positive class and a label y in {0, 1},
 * binary cross-entropy is -[y*log(p) + (1-y)*log(1-p)]. Probabilities are
 * clamped away from zero and one to keep the logarithm finite. It is the
 * standard loss for sigmoid output units.
 *
 * Time O(n) over n examples, space O(n) for the per-example values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface BinaryCrossEntropyResult {
    probability: number;
    label: number;
    loss: number;
}

/** Compute the binary cross-entropy for one predicted probability and label. */
export function binaryCrossEntropyFor(probability: number, label: number, eps = 1e-12): BinaryCrossEntropyResult {
    const p = Math.max(eps, Math.min(1 - eps, probability));
    const loss = -(label * Math.log(p) + (1 - label) * Math.log(1 - p));
    return { probability: p, label, loss };
}

function makeCells(results: BinaryCrossEntropyResult[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const columns = ["p", "label", "correct p", "loss"];
    results.forEach((result, row) => {
        const values = [result.probability, result.label, result.label > 0 ? result.probability : 1 - result.probability, result.loss];
        columns.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === current ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? `${column} ${(values[col] ?? 0).toFixed(4)}` : "?",
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
    const task = (input as { probabilities?: number[]; labels?: number[] } | null) ?? {};
    const probabilities: number[] = Array.isArray(task.probabilities) && task.probabilities.length > 0
        ? task.probabilities
        : [0.95, 0.8, 0.2, 0.05, 0.5, 0.6];
    const labels: number[] = Array.isArray(task.labels) && task.labels.length === probabilities.length
        ? task.labels
        : [1, 1, 0, 0, 1, 0];
    const results = probabilities.map((p, i) => binaryCrossEntropyFor(p, labels[i] ?? 0));
    const losses = results.map((r) => r.loss);
    const mean = losses.reduce((a, b) => a + b, 0) / (losses.length || 1);
    const metaBase = { rows: results.length, cols: 4, mean };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, -1, -1),
        edges: [],
        description: `Binary cross-entropy on ${results.length} examples: penalize low probability on the true class.`,
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
            description: `Example ${i}: p=${(r?.probability ?? 0).toFixed(4)}, label ${r?.label ?? 0}, loss ${(r?.loss ?? 0).toFixed(4)}.`,
            codeLineNumber: r && r.label > 0 ? 2 : 3,
            layout: "grid",
            meta: { ...metaBase, current: i, losses },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(results, results.length - 1, -1),
        edges: [],
        description: `Done: mean binary cross-entropy over the batch is ${mean.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, losses, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A classifier that outputs a probability should be rewarded for putting mass on the correct class and punished for confidence in the wrong one. Cross-entropy measures exactly that: for label 1 it is minus log of the predicted probability, for label 0 minus log of one minus it. Correct and confident costs almost nothing; confident and wrong costs a great deal.",
        invariants: [
            "The probability is clamped into a small interval away from zero and one.",
            "For label 1 the loss is -log(p); for label 0 it is -log(1-p).",
            "The loss is nonnegative and decreases as the probability on the true class rises.",
        ],
        correctness:
            "The value -[y*log(p) + (1-y)*log(1-p)] is the negative log likelihood of a Bernoulli observation, so minimizing it is maximum-likelihood estimation for a sigmoid classifier. For y = 1 it reduces to -log(p) and for y = 0 to -log(1-p), both nonnegative because the arguments lie in (0, 1]. Clamping guarantees the logarithms stay finite even at extreme inputs. The symmetry that replacing p by 1-p and flipping the label leaves the loss unchanged is verified in the tests alongside a brute-force formula check.",
        complexityRationale:
            "Each example needs two logarithms and a few arithmetic operations, all constant time, so the batch is O(n) time and O(n) space.",
        uses: [
            "Binary classification with sigmoid outputs",
            "Logistic regression training",
            "The per-pixel term in segmentation losses",
        ],
        references: [
            "Goodfellow et al., Deep Learning, Chapter 6, 2016",
            "Bishop, Pattern Recognition and Machine Learning, Section 4.3, 2006",
        ],
        workedExample:
            "For label 1 and p = 0.9 the loss is -log(0.9) = 0.105. For the same label at p = 0.1 it is -log(0.1) = 2.303, showing how confident mistakes are heavily penalized. For label 0 at p = 0.1 the loss is only -log(0.9) = 0.105.",
    },
    id: "binary-cross-entropy",
    name: "Binary Cross-Entropy",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        probabilities: [0.95, 0.8, 0.2, 0.05, 0.5, 0.6],
        labels: [1, 1, 0, 0, 1, 0],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each example take the predicted positive probability p and label y",
        "clamp p away from zero and one for numerical safety",
        "if the label is one take the negative log of p",
        "if the label is zero take the negative log of one minus p",
        "combine both cases as minus y log p plus one minus y log one minus p",
        "accumulate the losses over the batch",
        "done: report the mean binary cross-entropy",
    ],
};

export default module;
