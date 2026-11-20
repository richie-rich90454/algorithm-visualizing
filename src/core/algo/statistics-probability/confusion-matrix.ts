/**
 * confusion-matrix.ts - Binary Confusion Matrix
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A confusion matrix tabulates the decisions of a binary classifier against the
 * true labels. Its four cells count true negatives, false positives, false
 * negatives, and true positives. Every item increments exactly one cell, so the
 * four entries always add up to the number of cases, and the cell totals expose
 * precision, recall, and accuracy directly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n classified items
 *   Space: O(1) for the four counters plus the four display cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A two-by-two grid shows the running counts in the four cells.
 *   - The cell receiving the current item is highlighted.
 *   - The final frame reports all four counts and the derived rates.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ConfusionInput {
    actual?: number[];
    predicted?: number[];
}

interface Counts {
    tn: number;
    fp: number;
    fn: number;
    tp: number;
}

function makeCells(counts: Counts, active: number, done: boolean): VisualEntity[] {
    const grid: Array<{ row: number; col: number; key: keyof Counts; label: string; value: number }> = [
        { row: 0, col: 0, key: "tn", label: "TN", value: counts.tn },
        { row: 0, col: 1, key: "fp", label: "FP", value: counts.fp },
        { row: 1, col: 0, key: "fn", label: "FN", value: counts.fn },
        { row: 1, col: 1, key: "tp", label: "TP", value: counts.tp },
    ];
    return grid.map((cell) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (active === cell.row * 2 + cell.col) {
            state = "comparing";
        }
        return {
            id: `cell-${cell.row}-${cell.col}`,
            type: "cell" as const,
            label: `${cell.label} ${cell.value}`,
            value: cell.value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: cell.row, col: cell.col, role: cell.label },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ConfusionInput | null) ?? {};
    const actualRaw: number[] = Array.isArray(task.actual) ? task.actual : [1, 1, 0, 0, 1];
    const predictedRaw: number[] = Array.isArray(task.predicted) ? task.predicted : [1, 0, 0, 0, 1];
    const n = Math.min(actualRaw.length, predictedRaw.length);
    const actual = actualRaw.map((v) => ((Number(v) || 0) >= 0.5 ? 1 : 0));
    const predicted = predictedRaw.map((v) => ((Number(v) || 0) >= 0.5 ? 1 : 0));
    let step = 0;

    const counts: Counts = { tn: 0, fp: 0, fn: 0, tp: 0 };
    const frame = (active: number, done: boolean, description: string, codeLineNumber: number): VisualFrame => {
        const precision = counts.tp + counts.fp === 0 ? 0 : counts.tp / (counts.tp + counts.fp);
        const recall = counts.tp + counts.fn === 0 ? 0 : counts.tp / (counts.tp + counts.fn);
        const accuracy = n === 0 ? 0 : (counts.tp + counts.tn) / n;
        return {
            stepNumber: step,
            entities: makeCells(counts, active, done),
            edges: [],
            description,
            codeLineNumber,
            layout: "grid",
            meta: {
                rows: 2,
                cols: 2,
                n,
                tn: counts.tn,
                fp: counts.fp,
                fn: counts.fn,
                tp: counts.tp,
                precision,
                recall,
                accuracy,
            },
        };
    };

    yield frame(-1, false, `Building a 2x2 confusion matrix from ${n} classified items.`, 0);
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const truth = actual[i] ?? 0;
        const decision = predicted[i] ?? 0;
        let active: number;
        if (decision === 1 && truth === 1) {
            counts.tp += 1;
            active = 3;
        } else if (decision === 1 && truth === 0) {
            counts.fp += 1;
            active = 1;
        } else if (decision === 0 && truth === 1) {
            counts.fn += 1;
            active = 2;
        } else {
            counts.tn += 1;
            active = 0;
        }
        yield frame(active, false, `Item ${i}: true ${truth}, predicted ${decision}; cell ${active} incremented.`, 3);
        step += 1;
    }

    yield frame(-1, true, `Matrix complete: TN ${counts.tn}, FP ${counts.fp}, FN ${counts.fn}, TP ${counts.tp}.`, 5);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single accuracy number hides what kind of mistakes a classifier makes. A confusion matrix lays the decisions out in a small table: rows are the truth and columns are the prediction. Reading a row tells you what happened to the items of one true class, and reading a column tells you where the predictions of one class came from.",
        invariants: [
            "The four cell counts are nonnegative integers.",
            "Every item increments exactly one cell, so the counts sum to n.",
            "True positives sit on the lower-right diagonal and true negatives on the upper-left.",
        ],
        correctness:
            "Each item is placed by its pair of true and predicted labels. The pair (0, 0) is a true negative, (0, 1) a false positive, (1, 0) a false negative, and (1, 1) a true positive; these four pairs partition all items, so the counts are disjoint and exhaustive and their sum is n. Precision TP over TP plus FP, recall TP over TP plus FN, and accuracy over the two diagonal cells follow immediately from the counts.",
        complexityRationale:
            "One pass over the n items updates four integer counters and emits a frame, so time is O(n). Only four cells are drawn regardless of n, giving constant display space beyond the input arrays.",
        uses: [
            "Diagnosing which error type a medical screening test makes",
            "Summarizing classifier results in a model report card",
            "Deriving precision, recall, and specificity from counts",
        ],
        references: [
            "Kohavi and Provost, Glossary of Terms, Machine Learning, 1998",
            "Fawcett, An Introduction to ROC Analysis, 2006",
        ],
        workedExample:
            "For true labels 1, 1, 0, 0, 1 and predictions 1, 0, 0, 0, 1, the cells fill as TP 2, FN 1, TN 2, FP 0. The counts sum to 5, precision is 2 over 2 equals 1, recall is 2 over 3, and accuracy is 4 over 5.",
    },
    id: "confusion-matrix",
    name: "Confusion Matrix",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { actual: [1, 1, 0, 0, 1], predicted: [1, 0, 0, 0, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the true labels and the predicted labels",
        "set true negative, false positive, false negative, true positive counts to zero",
        "for each item threshold both labels to zero or one",
        "increment the cell matching the pair of true and predicted labels",
        "set precision to TP over TP plus FP and recall to TP over TP plus FN",
        "set accuracy to TP plus TN over the number of items",
        "done: report the four cell counts and derived rates",
    ],
};

export default module;
