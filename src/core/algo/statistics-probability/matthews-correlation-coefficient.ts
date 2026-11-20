/**
 * matthews-correlation-coefficient.ts - Matthews Correlation Coefficient
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Matthews correlation coefficient summarizes a binary confusion matrix in
 * a single number between minus one and one. It uses all four cells, so it is
 * informative even when the classes are very unbalanced. The module fills a two
 * by two table from paired true and predicted labels, then computes
 * (TP * TN - FP * FN) over the square root of the product of the four marginal
 * totals.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) for N labeled cases
 *   Space: O(1) beyond the four-cell grid
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The 2 by 2 grid shows true class rows and predicted class columns.
 *   - The cell receiving the current case is YELLOW.
 *   - The final frame colors the correct diagonal GREEN and reports MCC.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pair = [number, number];

function makeCells(table: number[][], current: Pair | null, done: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < 2; r += 1) {
        for (let c = 0; c < 2; c += 1) {
            let state: EntityState = "idle";
            if (done) {
                state = r === c ? "sorted" : "unvisited";
            } else if (current && current[0] === r && current[1] === c) {
                state = "comparing";
            }
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(table[r]?.[c] ?? 0),
                value: table[r]?.[c] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, count: table[r]?.[c] ?? 0 },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { trueLabels?: number[]; predictedLabels?: number[]; positives?: number } | null) ?? {};
    const truth: number[] = Array.isArray(task.trueLabels) ? task.trueLabels : [1, 1, 1, 1, 0, 0, 0, 0, 0, 0];
    const predicted: number[] = Array.isArray(task.predictedLabels)
        ? task.predictedLabels
        : [1, 1, 0, 1, 0, 0, 1, 0, 0, 0];
    const positive = typeof task.positives === "number" ? task.positives : 1;
    const n = Math.min(truth.length, predicted.length);
    const table: number[][] = [
        [0, 0],
        [0, 0],
    ];
    let step = 0;

    const frame = (
        current: Pair | null,
        done: boolean,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(table, current, done),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: { N: n, tp: 0, fp: 0, tn: 0, fn: 0, mcc: 0, ...extra },
    });

    yield frame(null, false, `Building a binary confusion matrix from ${n} labeled case(s).`, 0);
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const t = (Number(truth[i]) || 0) === positive ? 1 : 0;
        const p = (Number(predicted[i]) || 0) === positive ? 1 : 0;
        const row = t;
        const cell = table[row];
        if (cell) cell[p] = (cell[p] ?? 0) + 1;
        yield frame([row, p], false, `Case ${i}: true class ${t}, predicted class ${p}; cell (${row}, ${p}) is now ${cell?.[p] ?? 0}.`, 2);
        step += 1;
    }

    const tn = table[0]?.[0] ?? 0;
    const fp = table[0]?.[1] ?? 0;
    const fn = table[1]?.[0] ?? 0;
    const tp = table[1]?.[1] ?? 0;
    const denominator = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
    const mcc = denominator === 0 ? 0 : (tp * tn - fp * fn) / denominator;
    yield frame(null, true, `TP ${tp}, FP ${fp}, TN ${tn}, FN ${fn}; Matthews correlation coefficient ${mcc.toFixed(4)}.`, 5, { tp, fp, tn, fn, mcc });
}

/** The Matthews correlation coefficient module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Accuracy can be misleading when one class is rare. The Matthews correlation coefficient instead looks at all four confusion matrix cells and measures how correlated the predictions are with the truth. It only reaches one when the classifier is perfect on both classes, and it drops below zero when predictions are worse than chance.",
        invariants: [
            "The four confusion cells always sum to the number of labeled cases.",
            "The coefficient always lies between minus one and one.",
            "Swapping the names of the two classes leaves the coefficient unchanged.",
        ],
        correctness:
            "Each case increments exactly one confusion cell according to its true and predicted class, so the cells count TP, FP, TN, and FN. The numerator tp times tn minus fp times fn is large and positive only when both classes are predicted well. The denominator is the geometric mean of the four marginal products; the Cauchy-Schwarz inequality guarantees the absolute value of the ratio is at most one, and a zero denominator means one class is absent, reported as zero.",
        complexityRationale:
            "Filling the table takes one pass over the N cases, and the final arithmetic is constant time, so the algorithm is O(N) time and O(1) space beyond the four displayed cells.",
        uses: [
            "Evaluating classifiers on imbalanced medical data",
            "Scoring binary predictions in computational biology",
            "Comparing models in cheminformatics benchmarks",
        ],
        references: [
            "Matthews, Comparison of the Predicted and Observed Secondary Structure of T4 Phage Lysozyme, 1975",
            "Baldi et al., Assessing the Accuracy of Prediction Algorithms, 2000",
        ],
        workedExample:
            "If a classifier yields TP = 8, TN = 2, FP = 0, and FN = 0, then MCC is 16 over the square root of 8 times 8 times 2 times 2, which is 16 over 16, or 1. A single false positive would lower the value below one.",
    },
    id: "matthews-correlation-coefficient",
    name: "Matthews Correlation Coefficient",
    category: "statistics-probability",
    complexity: { time: "O(N)", space: "O(1)" },
    defaultInput: {
        trueLabels: [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
        predictedLabels: [1, 1, 0, 1, 0, 0, 1, 0, 0, 0],
        positives: 1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the paired true and predicted binary labels",
        "initialize a two by two confusion table of zeros",
        "for each case increment the cell for its true and predicted class",
        "set tp, fp, tn, and fn from the four cells",
        "set the numerator to tp times tn minus fp times fn",
        "set the denominator to the square root of the product of the four marginal totals",
        "set MCC to the numerator over the denominator, or zero if it is zero",
        "done: report the Matthews correlation coefficient",
    ],
};

export default module;
