/**
 * likelihood-ratio-test.ts - Likelihood Ratio Test Statistic
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The likelihood ratio test compares a null-constrained fit with the best fit
 * available in a candidate set. It scans a log-likelihood profile, records the
 * maximum, and forms twice the gap between that maximum and the null value.
 * Under regularity conditions the statistic follows a chi-square distribution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k candidate fits
 *   Space: O(k) for the displayed profile bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each bar shows the log likelihood at a candidate parameter value.
 *   - The candidate being scanned is highlighted, and the best is marked.
 *   - The final frame reports the likelihood ratio statistic.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], nullIndex: number, bestIndex: number, active: number): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (index === active) {
            state = "active";
        } else if (index === bestIndex && bestIndex >= 0) {
            state = "sorted";
        } else if (index === nullIndex) {
            state = "pivot";
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
            metadata: { index, logLikelihood: value, isNull: index === nullIndex },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { logLikelihoods?: number[]; nullIndex?: number; df?: number } | null) ?? {};
    const logLikelihoods: number[] = Array.isArray(task.logLikelihoods)
        ? task.logLikelihoods.slice()
        : [-10.2, -8.4, -5.1, -6.7, -9.3];
    const k = logLikelihoods.length;
    const nullIndex = Math.min(k - 1, Math.max(0, Math.floor(task.nullIndex ?? 0)));
    const df = Math.max(1, Math.floor(task.df ?? 1));

    yield {
        stepNumber: 0,
        entities: makeBars(logLikelihoods, nullIndex, -1, -1),
        edges: [],
        description: `Likelihood ratio test over ${k} candidate fit(s) with ${df} degree(s) of freedom.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { k, nullIndex, df, bestIndex: 0, statistic: 0 },
    };
    let step = 1;

    let bestIndex = 0;
    for (let i = 0; i < k; i += 1) {
        if ((logLikelihoods[i] ?? -Infinity) > (logLikelihoods[bestIndex] ?? -Infinity)) {
            bestIndex = i;
        }
        yield {
            stepNumber: step,
            entities: makeBars(logLikelihoods, nullIndex, bestIndex, i),
            edges: [],
            description: `Candidate ${i} has log likelihood ${(logLikelihoods[i] ?? 0).toFixed(3)}; the running best is candidate ${bestIndex}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { k, nullIndex, df, bestIndex, statistic: 0 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(logLikelihoods, nullIndex, bestIndex, -1),
        edges: [],
        description: `Best log likelihood is ${(logLikelihoods[bestIndex] ?? 0).toFixed(3)} at candidate ${bestIndex}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { k, nullIndex, df, bestIndex, statistic: 0 },
    };
    step += 1;

    const nullValue = k > 0 ? (logLikelihoods[nullIndex] ?? 0) : 0;
    const bestValue = k > 0 ? (logLikelihoods[bestIndex] ?? 0) : 0;
    const statistic = k > 0 ? Math.max(0, 2 * (bestValue - nullValue)) : 0;
    yield {
        stepNumber: step,
        entities: makeBars(logLikelihoods, nullIndex, bestIndex, -1),
        edges: [],
        description: `Likelihood ratio statistic = 2 times (${bestValue.toFixed(3)} minus ${nullValue.toFixed(3)}) = ${statistic.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { k, nullIndex, df, bestIndex, statistic, nullValue, bestValue },
    };
}

/** The likelihood ratio test module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A likelihood ratio test asks how much better the data can be explained by freeing a parameter than by holding it at its null value. The log likelihood gap is doubled because minus twice a log likelihood ratio behaves like a chi-square variable, giving a familiar reference scale.",
        invariants: [
            "The best candidate has the largest log likelihood in the profile.",
            "The statistic is never negative because the best fit is at least as good as the null fit.",
            "A null index at the best candidate gives a statistic of zero.",
        ],
        correctness:
            "Scanning the profile records its maximum exactly. Twice the difference between the unrestricted maximum and the null log likelihood is minus twice the log of the likelihood ratio, which under the null and standard regularity conditions converges to a chi-square distribution with degrees of freedom equal to the number of constrained parameters.",
        complexityRationale:
            "A single scan over k candidates finds the maximum and the statistic, so time is linear; the profile bars are the only stored array.",
        uses: [
            "Testing nested statistical models",
            "Model selection in generalized linear models",
            "Comparing constrained and unconstrained parameter fits",
        ],
        references: [
            "Wilks, The Large-Sample Distribution of the Likelihood Ratio, 1938",
            "Casella and Berger, Statistical Inference, Chapter 9",
        ],
        workedExample:
            "For log likelihoods minus 10.2, minus 8.4, minus 5.1, minus 6.7 and minus 9.3 with the null at index zero, the best value is minus 5.1. Twice the gap, 2 times 5.1, gives a statistic of 10.2 on one degree of freedom.",
    },
    id: "likelihood-ratio-test",
    name: "Likelihood Ratio Test",
    category: "statistics-probability",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { logLikelihoods: [-10.2, -8.4, -5.1, -6.7, -9.3], nullIndex: 0, df: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "read the log likelihood profile and the null constrained index",
        "initialize the best index to the first candidate",
        "for each candidate compare its log likelihood with the best",
        "record the largest log likelihood found",
        "set the statistic to twice the gap between best and null log likelihoods",
        "compare it with a chi square at the given degrees of freedom",
        "done: report the likelihood ratio statistic",
    ],
};

export default module;
