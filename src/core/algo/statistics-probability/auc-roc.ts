/**
 * auc-roc.ts - Area Under the ROC Curve
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The ROC curve plots the true-positive rate against the false-positive rate
 * as a classification threshold slides from high to low. AUC is the area under
 * that curve and equals the probability that a randomly chosen positive sample
 * outranks a randomly chosen negative sample. The module sorts scores, sweeps
 * the distinct thresholds to build the curve, and integrates it with trapezoids.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for the sort, then O(n) for the sweep
 *   Space: O(n) for the sorted items and ROC points
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show samples ordered by score; positive cases are highlighted.
 *   - The threshold group currently being added to the curve is compared.
 *   - The final frame is green and reports the AUC value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Item {
    score: number;
    label: number;
    index: number;
}

function makeBars(items: Item[], threshold: number | null, done: boolean): VisualEntity[] {
    return items.map((item) => {
        let state: EntityState = item.label === 1 ? "active" : "idle";
        if (done) {
            state = item.label === 1 ? "sorted" : "unvisited";
        } else if (threshold !== null && Math.abs(item.score - threshold) < 1e-12) {
            state = "comparing";
        }
        return {
            id: `bar-${item.index}`,
            type: "bar" as const,
            label: `${item.score}`,
            value: item.score,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: item.index, score: item.score, label: item.label },
        };
    });
}

/** Sweep classification thresholds and integrate the ROC curve. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { scores?: number[]; labels?: number[] } | null) ?? {};
    const scores: number[] = Array.isArray(task.scores) ? task.scores.map(Number) : [0.9, 0.8, 0.7, 0.65, 0.5, 0.4, 0.3, 0.2];
    const labels: number[] = Array.isArray(task.labels) ? task.labels.map(Number) : [1, 1, 0, 1, 0, 1, 0, 0];
    const n = Math.min(scores.length, labels.length);
    const items: Item[] = Array.from({ length: n }, (_, index) => ({
        score: scores[index] ?? 0,
        label: labels[index] === 1 ? 1 : 0,
        index,
    }));
    const sorted = [...items].sort((a, b) => b.score - a.score || a.index - b.index);
    const nPos = sorted.filter((item) => item.label === 1).length;
    const nNeg = sorted.length - nPos;

    yield {
        stepNumber: 0,
        entities: makeBars(items, null, false),
        edges: [],
        description: `Building an ROC curve from ${n} scored samples (${nPos} positive, ${nNeg} negative).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, nPos, nNeg, auc: 0, thresholds: 0, rocPoints: [0, 0] },
    };
    yield {
        stepNumber: 1,
        entities: makeBars(sorted, null, false),
        edges: [],
        description: `Scores sorted from highest ${sorted[0]?.score} to lowest ${sorted[sorted.length - 1]?.score}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { n, nPos, nNeg, auc: 0, thresholds: 0, rocPoints: [0, 0] },
    };

    let step = 2;
    let tp = 0;
    let fp = 0;
    const roc: Array<[number, number]> = [[0, 0]];
    let i = 0;
    while (i < sorted.length) {
        const threshold = sorted[i].score;
        while (i < sorted.length && Math.abs(sorted[i].score - threshold) < 1e-12) {
            if (sorted[i].label === 1) {
                tp += 1;
            } else {
                fp += 1;
            }
            i += 1;
        }
        const tpr = nPos === 0 ? 0 : tp / nPos;
        const fpr = nNeg === 0 ? 0 : fp / nNeg;
        roc.push([fpr, tpr]);
        yield {
            stepNumber: step,
            entities: makeBars(sorted, threshold, false),
            edges: [],
            description: `Threshold ${threshold}: true-positive rate ${tpr.toFixed(3)}, false-positive rate ${fpr.toFixed(3)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, nPos, nNeg, auc: 0, thresholds: roc.length - 1, rocPoints: roc.flat() },
        };
        step += 1;
    }
    roc.push([1, 1]);

    let auc = 0;
    for (let k = 1; k < roc.length; k += 1) {
        const prev = roc[k - 1];
        const curr = roc[k];
        auc += ((curr[0] - prev[0]) * (curr[1] + prev[1])) / 2;
    }
    auc = Math.max(0, Math.min(1, auc));

    yield {
        stepNumber: step,
        entities: makeBars(sorted, null, true),
        edges: [],
        description: `ROC area (AUC) = ${auc.toFixed(6)} over ${roc.length - 2} distinct threshold(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, nPos, nNeg, auc, thresholds: roc.length - 2, rocPoints: roc.flat() },
    };
}

/** The AUC-ROC module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A classifier that ranks a random positive above a random negative has scored one; one that ranks them randomly scores about one half. The ROC curve draws this tradeoff by lowering the cutoff and recording how many true and false positives accumulate. AUC collapses that whole curve to a single number by measuring the area beneath it.",
        invariants: [
            "The true-positive and false-positive rates are nondecreasing as the threshold falls.",
            "The ROC curve starts at (0, 0) and ends at (1, 1).",
            "Tied scores produce a single ROC point, treating the tied group as one threshold.",
        ],
        correctness:
            "Sorting by score and sweeping groups of equal scores enumerates every reachable confusion matrix, so the plotted points are the full ROC curve. Trapezoidal integration sums (change in false-positive rate) times the average true-positive rate over consecutive points, giving the exact area under the piecewise-linear curve. That area equals the fraction of positive-negative pairs ordered correctly, counting ties as one half.",
        complexityRationale:
            "Sorting n scores costs O(n log n); the sweep visits each item once and integrates over at most n points, so the remaining work is O(n). The sorted list and ROC points occupy O(n) space.",
        uses: [
            "Comparing classifiers independent of a chosen threshold",
            "Reporting model quality on imbalanced medical or fraud data",
            "Selecting an operating point from a precision-recall tradeoff",
        ],
        references: [
            "Hanley and McNeil, The Meaning and Use of the Area under a ROC Curve, 1982",
            "Fawcett, An Introduction to ROC Analysis, 2006",
        ],
        workedExample:
            "With scores 0.9, 0.8, 0.7, 0.65 for positives and 0.5, 0.4, 0.3, 0.2 for negatives, every positive outranks every negative. The ROC curve jumps to (0, 1) before moving right, so the enclosed area and the AUC are exactly one.",
    },
    id: "auc-roc",
    name: "AUC-ROC",
    category: "statistics-probability",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        scores: [0.9, 0.8, 0.7, 0.65, 0.5, 0.4, 0.3, 0.2],
        labels: [1, 1, 0, 1, 0, 1, 0, 0],
    },
    visualType: "array",
    run,
    pseudocode: [
        "pair each score with its binary class label",
        "sort the samples by decreasing score",
        "count positives and negatives",
        "sweep thresholds from high to low by distinct score",
        "record true-positive and false-positive rates at each threshold",
        "append the endpoints (0, 0) and (1, 1)",
        "integrate the curve with trapezoids to get the area",
        "done: report the AUC value",
    ],
};

export default module;
