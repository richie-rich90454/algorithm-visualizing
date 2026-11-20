/**
 * f1-score.ts - F1 Score for Binary Classification
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The F1 score is the harmonic mean of precision and recall for a binary
 * classifier. It balances the cost of false positives against false negatives
 * and reaches one only when both are zero. Counting true positives, false
 * positives, and false negatives from a list of predictions and true labels is
 * enough to compute it.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n classified items
 *   Space: O(n) for the displayed correctness bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per item shows the predicted probability.
 *   - A correct decision is green; a mistake is red.
 *   - The final frame reports precision, recall, and the F1 score.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface F1Input {
    predictions?: number[];
    actual?: number[];
}

function makeBars(
    predictions: number[],
    actual: number[],
    current: number,
    done: boolean,
): VisualEntity[] {
    return predictions.map((prediction, index) => {
        const decided = prediction >= 0.5 ? 1 : 0;
        const truth = actual[index] ?? 0;
        const correct = decided === truth;
        let state: EntityState = "idle";
        if (done || (correct && index < current)) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        } else if (!correct && index < current) {
            state = "error";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `p=${prediction.toFixed(2)} -> ${decided} (true ${truth})`,
            value: prediction,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, prediction, decision: decided, actual: truth, correct },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as F1Input | null) ?? {};
    const predictions: number[] = Array.isArray(task.predictions) ? task.predictions : [0.9, 0.7, 0.4, 0.2];
    const actualRaw: number[] = Array.isArray(task.actual) ? task.actual : [1, 1, 1, 0];
    const n = Math.min(predictions.length, actualRaw.length);
    const actual = actualRaw.map((v) => ((Number(v) || 0) >= 0.5 ? 1 : 0));
    let step = 0;

    const frame = (
        current: number,
        done: boolean,
        counts: { tp: number; fp: number; fn: number; tn: number },
        score: { precision: number; recall: number; f1: number; accuracy: number },
        description: string,
        codeLineNumber: number,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(predictions.slice(0, n), actual, current, done),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: {
            n,
            tp: counts.tp,
            fp: counts.fp,
            fn: counts.fn,
            tn: counts.tn,
            precision: score.precision,
            recall: score.recall,
            f1: score.f1,
            accuracy: score.accuracy,
        },
    });

    const zeroCounts = { tp: 0, fp: 0, fn: 0, tn: 0 };
    const zeroScore = { precision: 0, recall: 0, f1: 0, accuracy: 0 };
    yield frame(-1, false, zeroCounts, zeroScore, `Scoring ${n} binary predictions with the F1 measure.`, 0);
    step += 1;

    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;
    for (let i = 0; i < n; i += 1) {
        const prediction = predictions[i] ?? 0;
        const decided = prediction >= 0.5 ? 1 : 0;
        const truth = actual[i] ?? 0;
        if (decided === 1 && truth === 1) tp += 1;
        else if (decided === 1 && truth === 0) fp += 1;
        else if (decided === 0 && truth === 1) fn += 1;
        else tn += 1;
        const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
        const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
        const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
        yield frame(
            i,
            false,
            { tp, fp, fn, tn },
            { precision, recall, f1, accuracy: n === 0 ? 0 : (tp + tn) / n },
            `Item ${i}: predicted ${decided}, true ${truth}; running TP ${tp}, FP ${fp}, FN ${fn}.`,
            3,
        );
        step += 1;
    }

    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    yield frame(
        n - 1,
        true,
        { tp, fp, fn, tn },
        { precision, recall, f1, accuracy: n === 0 ? 0 : (tp + tn) / n },
        `Final: precision ${precision.toFixed(4)}, recall ${recall.toFixed(4)}, F1 ${f1.toFixed(4)}.`,
        5,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Accuracy can look flattering when positives are rare, so the F1 score focuses on the positive class. Precision asks how many of the predicted positives were right, and recall asks how many of the real positives were found. The harmonic mean punishes a lopsided pair far more than an ordinary average, so a classifier must do reasonably well on both to score well.",
        invariants: [
            "Every item falls in exactly one of the four confusion counts.",
            "Precision and recall each lie between zero and one.",
            "F1 is zero only when precision or recall is zero and equals one only when both are one.",
        ],
        correctness:
            "Thresholding each predicted probability at one half assigns a binary decision, and comparing it with the true label places the item in exactly one of true positive, false positive, false negative, or true negative. Precision is TP over TP plus FP and recall is TP over TP plus FN by definition. The F1 score 2PR over P plus R is the harmonic mean of those two quantities, equal to 2TP over 2TP plus FP plus FN, which is bounded by one and attains one exactly when there are no errors on the positive class.",
        complexityRationale:
            "A single pass classifies each item and updates four counters with constant work, so time is O(n). Only one bar per item is kept for display, giving O(n) space.",
        uses: [
            "Scoring imbalanced classifiers in fraud and anomaly detection",
            "Reporting a single number for information extraction systems",
            "Selecting a model when false positives and false negatives matter equally",
        ],
        references: [
            "van Rijsbergen, Information Retrieval, Chapter 7, 1979",
            "Powers, Evaluation: From Precision, Recall and F-Measure to ROC and AUC, 2011",
        ],
        workedExample:
            "For predictions 0.9, 0.7, 0.4, 0.2 with true labels 1, 1, 1, 0, the decisions are 1, 1, 0, 0, giving TP 2, FN 1, TN 1, FP 0. Precision is 1, recall is 2/3, and F1 is 2 times 1 times 2/3 divided by 1 plus 2/3, about 0.8.",
    },
    id: "f1-score",
    name: "F1 Score",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { predictions: [0.9, 0.7, 0.4, 0.2], actual: [1, 1, 1, 0] },
    visualType: "array",
    run,
    pseudocode: [
        "read the predicted probabilities and the true binary labels",
        "set true positive, false positive, false negative, true negative counts to zero",
        "for each item decide positive when probability is at least one half",
        "increment the matching confusion count by comparing decision with truth",
        "set precision to TP over TP plus FP and recall to TP over TP plus FN",
        "set F1 to twice precision times recall over precision plus recall",
        "done: report precision, recall, F1, and accuracy",
    ],
};

export default module;
