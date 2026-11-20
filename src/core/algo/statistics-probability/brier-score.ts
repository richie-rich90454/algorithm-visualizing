/**
 * brier-score.ts - Brier Score for Probabilistic Forecasts
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Brier score measures the accuracy of probabilistic predictions for a
 * binary event. For each case it squares the difference between the predicted
 * probability and the observed outcome (0 or 1), then averages those squared
 * errors. A perfect forecast scores zero and a constant forecast of one half
 * scores one quarter.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) for N forecast cases
 *   Space: O(N) for the displayed error bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each bar shows one case's squared error, labeled with its probability.
 *   - The current case is YELLOW; final bars are GREEN.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Case = { probability: number; outcome: number };

function makeBars(cases: Case[], states: Map<number, EntityState>, done: boolean): VisualEntity[] {
    return cases.map((item, index) => {
        const error = (item.probability - item.outcome) ** 2;
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: item.probability.toFixed(2),
            value: error,
            state: states.get(index) ?? (done ? "sorted" : "idle"),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, error, probability: item.probability, outcome: item.outcome },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { predictions?: number[]; outcomes?: number[] } | null) ?? {};
    const predictions: number[] = Array.isArray(task.predictions)
        ? task.predictions
        : [0.9, 0.7, 0.2, 0.6];
    const outcomes: number[] = Array.isArray(task.outcomes) ? task.outcomes : [1, 1, 0, 0];
    const n = Math.min(predictions.length, outcomes.length);
    const cases: Case[] = Array.from({ length: n }, (_, i) => ({
        probability: Math.min(1, Math.max(0, Number(predictions[i]) || 0)),
        outcome: (Number(outcomes[i]) || 0) >= 0.5 ? 1 : 0,
    }));
    let step = 0;

    const frame = (
        states: Map<number, EntityState>,
        done: boolean,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(cases, states, done),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { N: n, sum: 0, score: 0, ...extra },
    });

    yield frame(new Map(), false, `Scoring ${n} probabilistic forecast(s) with the Brier score.`, 0);
    step += 1;

    let sum = 0;
    for (let i = 0; i < n; i += 1) {
        const item = cases[i];
        if (!item) continue;
        const error = (item.probability - item.outcome) ** 2;
        sum += error;
        yield frame(
            new Map([[i, "comparing"]]),
            false,
            `Case ${i}: probability ${item.probability.toFixed(2)}, outcome ${item.outcome}; squared error ${error.toFixed(4)}.`,
            2,
            { sum },
        );
        step += 1;
    }

    const score = n === 0 ? 0 : sum / n;
    yield frame(new Map(), true, `Mean squared error across ${n} case(s) is Brier score ${score.toFixed(4)}.`, 4, { sum, score });
}

/** The Brier score module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A forecast should be rewarded for putting probability mass near what actually happens. The Brier score treats a forecast as a number between zero and one and measures how far it landed from the binary outcome, squaring the gap so large misses cost more. It is the mean squared error of probability forecasts.",
        invariants: [
            "Every squared error is nonnegative and at most one.",
            "The running sum equals the total squared error of all cases seen so far.",
            "A perfect forecast of zero or one on every case produces a score of zero.",
        ],
        correctness:
            "For each case the observed outcome is zero or one, so squaring the probability minus the outcome is exactly the squared error. The Brier score is defined as the average of those squared errors; accumulating them and dividing by the case count therefore computes the definition, with the empty case returning zero by convention.",
        complexityRationale:
            "A single pass over the N cases computes all squared errors and their sum, giving O(N) time and O(N) space only because one error bar is displayed per case.",
        uses: [
            "Scoring weather forecasts of rain probability",
            "Calibrating machine-learning classifiers that output confidence",
            "Comparing competing probability forecasts in sports analytics",
        ],
        references: [
            "Brier, Verification of Forecasts Expressed in Terms of Probability, 1950",
            "Wilks, Statistical Methods in the Atmospheric Sciences, Chapter 8",
        ],
        workedExample:
            "For forecasts 0.9, 0.7, 0.2, 0.6 with outcomes 1, 1, 0, 0, the squared errors are 0.01, 0.09, 0.04, and 0.36. Their sum is 0.5 and the average over four cases is 0.125.",
    },
    id: "brier-score",
    name: "Brier Score",
    category: "statistics-probability",
    complexity: { time: "O(N)", space: "O(N)" },
    defaultInput: { predictions: [0.9, 0.7, 0.2, 0.6], outcomes: [1, 1, 0, 0] },
    visualType: "array",
    run,
    pseudocode: [
        "read the predicted probabilities and the binary outcomes",
        "set the running sum of squared errors to zero",
        "for each case square probability minus outcome and add it",
        "set the Brier score to the sum divided by the case count",
        "done: report the Brier score",
    ],
};

export default module;
