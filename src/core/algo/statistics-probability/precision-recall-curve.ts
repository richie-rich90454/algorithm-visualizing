/**
 * precision-recall-curve.ts - Precision-Recall Curve and Average Precision
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A precision-recall curve summarizes a binary classifier's ranking by sweeping
 * the decision threshold from strict to loose. At each cutoff, precision is the
 * fraction of selected items that are truly positive and recall is the fraction
 * of all positives that have been selected. Average precision weights the
 * precision at each positive rank by how much recall improved there, giving a
 * single number in zero to one that rewards putting positives near the top.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) to sort by score, then O(n) for the sweep
 *   Space: O(n) for the sorted items and the curve arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per item is displayed in descending score order.
 *   - Items already selected are green; the current cutoff is yellow.
 *   - The final frame reports the recall, precision, and average precision.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Item {
    score: number;
    label: number;
    index: number;
}

interface PRInput {
    scores?: number[];
    labels?: number[];
}

function makeBars(items: Item[], current: number, done: boolean): VisualEntity[] {
    return items.map((item, position) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (position <= current) {
            state = "visited";
        } else if (position === current + 1) {
            state = "comparing";
        }
        return {
            id: `bar-${item.index}`,
            type: "bar" as const,
            label: `${item.label === 1 ? "+" : "-"} ${item.score.toFixed(2)}`,
            value: item.score,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: item.index, position, score: item.score, label: item.label },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PRInput | null) ?? {};
    const scores: number[] = Array.isArray(task.scores) ? task.scores : [0.9, 0.8, 0.55, 0.5, 0.4, 0.1];
    const labels: number[] = Array.isArray(task.labels) ? task.labels : [1, 1, 0, 1, 0, 0];
    const n = Math.min(scores.length, labels.length);
    const items: Item[] = Array.from({ length: n }, (_, i) => ({
        score: Number(scores[i]) || 0,
        label: (Number(labels[i]) || 0) >= 0.5 ? 1 : 0,
        index: i,
    }));
    items.sort((a, b) => b.score - a.score || a.index - b.index);
    const positives = items.reduce((total, item) => total + item.label, 0);

    const recalls: number[] = [];
    const precisions: number[] = [];
    const thresholds: number[] = [];
    let step = 0;

    const frame = (current: number, done: boolean, ap: number, description: string, codeLineNumber: number): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(items, current, done),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: {
            n,
            positives,
            negatives: n - positives,
            recalls: [...recalls],
            precisions: [...precisions],
            thresholds: [...thresholds],
            ap,
        },
    });

    yield frame(-1, false, 0, `Sweeping ${n} scored items by descending score to build the precision-recall curve.`, 0);
    step += 1;

    let truePositives = 0;
    let previousRecall = 0;
    let ap = 0;
    for (let k = 0; k < n; k += 1) {
        const item = items[k];
        if (!item) continue;
        truePositives += item.label;
        const selected = k + 1;
        const precision = truePositives / selected;
        const recall = positives === 0 ? 1 : truePositives / positives;
        if (item.label === 1) {
            ap += precision * (recall - previousRecall);
        }
        previousRecall = recall;
        recalls.push(recall);
        precisions.push(precision);
        thresholds.push(item.score);
        yield frame(k, false, ap, `Cutoff ${selected}: true positives ${truePositives}/${positives}, precision ${precision.toFixed(4)}, recall ${recall.toFixed(4)}.`, 3);
        step += 1;
    }

    yield frame(n - 1, true, ap, `Curve complete with ${recalls.length} point(s); average precision ${ap.toFixed(4)}.`, 5);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A classifier that outputs scores lets you choose how many predictions to accept. Move the cutoff down the ranked list and each step trades precision for recall: accepting more items finds more positives but drags in more false alarms. The curve shows that trade-off directly, and average precision summarizes it by rewarding high precision at the ranks where recall grows.",
        invariants: [
            "Items are visited in nonincreasing score order, with original index breaking ties.",
            "Recall never decreases as the cutoff is lowered and ends at one when positives exist.",
            "Precision at rank k equals the number of positives in the top k divided by k.",
        ],
        correctness:
            "At cutoff k the selected set is exactly the top k scored items, so counting labels among them gives true positives and dividing by k gives precision. Dividing the same count by the total number of positives gives recall. Average precision sums precision at each positive rank times the increase in recall since the previous positive rank, which is the standard step-function approximation to the area under the precision-recall curve and lies between zero and one.",
        complexityRationale:
            "Sorting the n items dominates at O(n log n), and the single sweep plus array copies is O(n). The sorted items and three curve arrays use O(n) space.",
        uses: [
            "Evaluating ranking and retrieval systems with imbalanced classes",
            "Comparing object detectors in computer vision benchmarks",
            "Choosing an operating threshold for a fraud or disease classifier",
        ],
        references: [
            "Davis and Goadrich, The Relationship Between Precision-Recall and ROC Curves, 2006",
            "Powers, Evaluation: From Precision, Recall and F-Measure to ROC and AUC, 2011",
        ],
        workedExample:
            "For scores 0.9, 0.8, 0.55, 0.5 with labels positive, positive, negative, positive, the top-two cutoff has precision 1 and recall 0.667. Taking the top three drops precision to 0.667 while recall stays 0.667, and taking all four raises recall to 1 with precision 0.75. Average precision weights the precision 1 and 0.75 values by their recall gains.",
    },
    id: "precision-recall-curve",
    name: "Precision-Recall Curve",
    category: "statistics-probability",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { scores: [0.9, 0.8, 0.55, 0.5, 0.4, 0.1], labels: [1, 1, 0, 1, 0, 0] },
    visualType: "array",
    run,
    pseudocode: [
        "read the scores and binary labels and sort items by descending score",
        "count the total number of positives",
        "set true positives, previous recall, and average precision to zero",
        "for each cutoff add the current item's label to true positives",
        "set precision to true positives over the cutoff rank",
        "set recall to true positives over total positives",
        "on a positive item add precision times the recall increase to average precision",
        "done: report the curve and average precision",
    ],
};

export default module;
