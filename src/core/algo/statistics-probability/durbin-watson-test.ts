/**
 * durbin-watson-test.ts - Durbin-Watson Autocorrelation Statistic
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Durbin-Watson statistic detects first-order autocorrelation in regression
 * residuals. It divides the sum of squared consecutive differences by the sum
 * of squared residuals, giving a value near two for no autocorrelation, near
 * zero for strong positive autocorrelation, and near four for negative.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n residuals
 *   Space: O(n) for the displayed residual bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per residual, with the bar under consideration highlighted.
 *   - Consecutive pairs are highlighted while their squared difference accrues.
 *   - The final frame reports the Durbin-Watson statistic.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(residuals: number[], active: number, pairMode: boolean): VisualEntity[] {
    return residuals.map((value, index) => {
        let state: EntityState = "idle";
        if (active >= 0) {
            const inPair = pairMode ? index === active || index === active + 1 : index === active;
            state = inPair ? "active" : "sorted";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(2),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, residual: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { residuals?: number[] } | null) ?? {};
    const residuals: number[] = Array.isArray(task.residuals)
        ? task.residuals.slice()
        : [1.2, 0.8, -0.4, 0.1, -1.0, 0.6, 0.3, -0.2];
    const n = residuals.length;

    yield {
        stepNumber: 0,
        entities: makeBars(residuals, -1, false),
        edges: [],
        description: `Durbin-Watson test on a residual series of length ${n}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, numerator: 0, denominator: 0, statistic: 0 },
    };
    let step = 1;

    let denominator = 0;
    for (let i = 0; i < n; i += 1) {
        const value = residuals[i] ?? 0;
        denominator += value * value;
        yield {
            stepNumber: step,
            entities: makeBars(residuals, i, false),
            edges: [],
            description: `Residual ${i + 1} is ${value.toFixed(3)}; squared sum is now ${denominator.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, numerator: 0, denominator, statistic: 0 },
        };
        step += 1;
    }

    let numerator = 0;
    for (let i = 1; i < n; i += 1) {
        const difference = (residuals[i] ?? 0) - (residuals[i - 1] ?? 0);
        numerator += difference * difference;
        yield {
            stepNumber: step,
            entities: makeBars(residuals, i - 1, true),
            edges: [],
            description: `Difference between residuals ${i} and ${i + 1} is ${difference.toFixed(3)}; squared sum is ${numerator.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, numerator, denominator, statistic: 0 },
        };
        step += 1;
    }

    const statistic = denominator > 0 ? numerator / denominator : 0;
    yield {
        stepNumber: step,
        entities: makeBars(residuals, -1, false),
        edges: [],
        description: `Durbin-Watson statistic = ${numerator.toFixed(4)} over ${denominator.toFixed(4)} = ${statistic.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, numerator, denominator, statistic },
    };
}

/** The Durbin-Watson module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Positive autocorrelation makes neighboring residuals look alike, so their differences are small and the statistic falls toward zero. Negative autocorrelation makes them alternate, inflating the differences and pushing the statistic toward four. Random residuals land near two.",
        invariants: [
            "The denominator is the sum of squared residuals.",
            "The numerator is the sum of squared consecutive differences.",
            "A perfectly flat residual series gives a numerator of zero.",
        ],
        correctness:
            "The statistic is a ratio of two sums that can both be computed exactly from the series. Writing the numerator in terms of the lag-one sample autocorrelation shows it equals about two times one minus that correlation, so values of two, zero and four correspond to no, positive and negative first-order autocorrelation respectively.",
        complexityRationale:
            "Both sums need a single pass over the n residuals and the n minus one consecutive pairs, and the displayed bars are the only stored structure.",
        uses: [
            "Checking regression residuals for serial correlation",
            "Diagnosing model misspecification in econometrics",
            "Quality control on time-ordered process data",
        ],
        references: [
            "Durbin and Watson, Testing for Serial Correlation, 1950",
            "Wooldridge, Introductory Econometrics, Chapter 12",
        ],
        workedExample:
            "For residuals 1, 2, 3, 4 the denominator is 30 and the consecutive differences are all one, so the numerator is 3. The statistic is 3 over 30, or 0.1, indicating strong positive autocorrelation.",
    },
    id: "durbin-watson-test",
    name: "Durbin-Watson Test",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { residuals: [1.2, 0.8, -0.4, 0.1, -1.0, 0.6, 0.3, -0.2] },
    visualType: "array",
    run,
    pseudocode: [
        "read the residual series",
        "initialize the numerator and denominator to zero",
        "for each residual add its square to the denominator",
        "for each consecutive pair add the squared difference to the numerator",
        "divide the numerator by the denominator",
        "done: report the Durbin-Watson statistic",
    ],
};

export default module;
