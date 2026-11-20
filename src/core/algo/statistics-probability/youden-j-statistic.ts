/**
 * youden-j-statistic.ts - Youden's J Statistic and Optimal Threshold
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Youden's J summarizes a binary classifier at one threshold as sensitivity
 * plus specificity minus one. Sweeping every distinct score as a candidate
 * threshold produces an ROC-like family of operating points, and the threshold
 * with the largest J is the one that best balances true positives against
 * false positives. J equals one for a perfect classifier and zero for a coin flip.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) for n distinct scores with a full sweep
 *   Space: O(n) for the listed thresholds and their J values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per candidate threshold shows its J value.
 *   - The current threshold is highlighted; the best one is green at the end.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], thresholds: number[], best: number, current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (done) state = index === best ? "sorted" : "visited";
        else if (index === current) state = "comparing";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `t=${thresholds[index]?.toFixed(2)}: J=${value.toFixed(3)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, threshold: thresholds[index] ?? 0 },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { scores?: number[]; labels?: number[] } | null) ?? {};
    const scores: number[] = Array.isArray(task.scores) ? task.scores.map((v) => Number(v) || 0) : [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    const labels: number[] = Array.isArray(task.labels) ? task.labels.map((v) => (Number(v) ? 1 : 0)) : [0, 0, 0, 0, 1, 1, 1, 1];
    const n = Math.min(scores.length, labels.length);
    const thresholds = Array.from(new Set(scores.slice(0, n))).sort((a, b) => a - b);
    const positives = labels.slice(0, n).reduce((s, v) => s + v, 0);
    const negatives = n - positives;
    const js: number[] = [];
    const sensitivities: number[] = [];
    const specificities: number[] = [];
    let best = 0;
    let bestJ = -Infinity;
    let bestThreshold = thresholds[0] ?? 0;

    for (const t of thresholds) {
        let tp = 0, fp = 0;
        for (let i = 0; i < n; i += 1) {
            if ((scores[i] ?? 0) >= t) {
                if (labels[i] === 1) tp += 1;
                else fp += 1;
            }
        }
        const sens = positives > 0 ? tp / positives : 0;
        const spec = negatives > 0 ? (negatives - fp) / negatives : 0;
        const j = sens + spec - 1;
        js.push(j);
        sensitivities.push(sens);
        specificities.push(spec);
        if (j > bestJ) {
            bestJ = j;
            best = js.length - 1;
            bestThreshold = t;
        }
    }

    yield {
        stepNumber: 0,
        entities: makeBars(thresholds.map(() => 0), thresholds, best, -1, false),
        edges: [],
        description: `Sweeping ${thresholds.length} thresholds to maximize Youden's J on ${n} scored cases.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, thresholds, js: [], bestJ, bestThreshold, positives, negatives },
    };
    for (let i = 0; i < thresholds.length; i += 1) {
        yield {
            stepNumber: i + 1,
            entities: makeBars([...js.slice(0, i + 1), ...js.map(() => 0)].slice(0, thresholds.length), thresholds, best, i, false),
            edges: [],
            description: `Threshold ${thresholds[i]?.toFixed(3)}: sensitivity ${sensitivities[i]?.toFixed(3)}, specificity ${specificities[i]?.toFixed(3)}, J ${js[i]?.toFixed(3)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, thresholds, js: js.slice(0, i + 1), bestJ, bestThreshold, positives, negatives, current: i },
        };
    }
    yield {
        stepNumber: thresholds.length + 1,
        entities: makeBars(js, thresholds, best, -1, true),
        edges: [],
        description: `Best J = ${bestJ.toFixed(4)} at threshold ${bestThreshold.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, thresholds, js, bestJ, bestThreshold, bestIndex: best, positives, negatives },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A classifier threshold trades false alarms for missed cases. Youden's J adds the true positive rate and the true negative rate and subtracts one, which measures how much better the test is than guessing. Sweeping all possible cutoffs and taking the largest J picks the operating point that maximizes overall correct classification without favoring one error type.",
        invariants: [
            "Sensitivity divides true positives by the total number of positives.",
            "Specificity divides true negatives by the total number of negatives.",
            "J equals sensitivity plus specificity minus one and lies between minus one and one.",
        ],
        correctness:
            "At a fixed threshold the confusion counts partition all n cases, so sensitivity and specificity are well defined whenever both classes are present. A perfect score ordering gives sensitivity and specificity both equal to one at some threshold, hence J equals one. An uninformative threshold gives sensitivity equal to one minus specificity, hence J equals zero. Because the sweep evaluates every distinct score as a cutoff, the largest J is the maximum over the entire ROC operating set.",
        complexityRationale:
            "Each of the d distinct thresholds scans n cases to count true and false positives, costing O(d n) time with d at most n. The threshold, J, and rate arrays occupy O(n) space.",
        uses: [
            "Choosing a diagnostic cutoff for a medical test",
            "Tuning the decision threshold of a binary classifier",
            "Comparing diagnostic tests through their best achievable J",
        ],
        references: [
            "Youden, Index for rating diagnostic tests, 1950",
            "Metz, Basic principles of ROC analysis, 1978",
        ],
        workedExample:
            "With scores 0.1, 0.2, 0.3, 0.4 for negatives and 0.5, 0.6, 0.7, 0.8 for positives, the threshold 0.5 gives sensitivity 1 and specificity 1, so J is 1. A threshold of 0.35 gives sensitivity 1 and specificity 0.75, so J is 0.75.",
    },
    id: "youden-j-statistic",
    name: "Youden's J Statistic",
    category: "statistics-probability",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { scores: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], labels: [0, 0, 0, 0, 1, 1, 1, 1] },
    visualType: "array",
    run,
    pseudocode: [
        "read classifier scores and true binary labels",
        "list every distinct score as a candidate threshold",
        "at each threshold count true and false positives",
        "compute sensitivity and specificity from the counts",
        "set J to sensitivity plus specificity minus one",
        "track the largest J and its threshold",
        "done: report the best J and threshold",
    ],
};

export default module;
