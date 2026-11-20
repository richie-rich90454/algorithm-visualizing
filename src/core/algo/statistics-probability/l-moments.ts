/**
 * l-moments.ts - L-Moments from Order Statistics
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * L-moments summarize a distribution using linear combinations of its sorted
 * values rather than powers of deviations. They are less sensitive to extreme
 * observations than ordinary moments. The module sorts the sample, forms the
 * first four probability-weighted moment estimates b0 through b3, and converts
 * them into the L-moments L1 through L4 and the dimensionless ratios tau3 and
 * tau4.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for the sort, then O(n) for the four sums
 *   Space: O(n) for the sorted copy and displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the sample values in sorted (order-statistic) order.
 *   - The bar entering the current probability-weighted sum is highlighted.
 *   - The final frame is green and reports L1 through L4.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], current = -1, done = false): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        } else if (index < current) {
            state = "visited";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value },
        };
    });
}

/** Compute the first four sample L-moments with a frame per stage. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values =
        Array.isArray(task.values) && task.values.length > 0
            ? task.values.map(Number)
            : [3, 1, 7, 2, 9, 4, 6, 5];
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const b0 = sorted.reduce((sum, value) => sum + value, 0) / n;
    let sum1 = 0;
    let sum2 = 0;
    let sum3 = 0;
    for (let i = 1; i < n; i += 1) {
        sum1 += i * (sorted[i] ?? 0);
    }
    for (let i = 2; i < n; i += 1) {
        sum2 += i * (i - 1) * (sorted[i] ?? 0);
    }
    for (let i = 3; i < n; i += 1) {
        sum3 += i * (i - 1) * (i - 2) * (sorted[i] ?? 0);
    }
    const b1 = n >= 2 ? sum1 / (n * (n - 1)) : 0;
    const b2 = n >= 3 ? sum2 / (n * (n - 1) * (n - 2)) : 0;
    const b3 = n >= 4 ? sum3 / (n * (n - 1) * (n - 2) * (n - 3)) : 0;

    const L1 = b0;
    const L2 = 2 * b1 - b0;
    const L3 = 6 * b2 - 6 * b1 + b0;
    const L4 = 20 * b3 - 30 * b2 + 12 * b1 - b0;
    const tau3 = L2 === 0 ? 0 : L3 / L2;
    const tau4 = L2 === 0 ? 0 : L4 / L2;

    yield {
        stepNumber: 0,
        entities: makeBars(values, -1, false),
        edges: [],
        description: `Sorting ${n} value(s) into ascending order statistics before forming L-moments.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, L1: 0, L2: 0, L3: 0, L4: 0, tau3: 0, tau4: 0 },
    };
    yield {
        stepNumber: 1,
        entities: makeBars(sorted, -1, false),
        edges: [],
        description: `Order statistics ready: smallest ${sorted[0]} and largest ${sorted[n - 1]}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { n, L1: b0, L2: 0, L3: 0, L4: 0, tau3: 0, tau4: 0 },
    };

    let step = 2;
    const stages: Array<{ label: string; b: number; line: number }> = [
        { label: "b0", b: b0, line: 2 },
        { label: "b1", b: b1, line: 3 },
        { label: "b2", b: b2, line: 4 },
        { label: "b3", b: b3, line: 5 },
    ];
    for (const stage of stages) {
        yield {
            stepNumber: step,
            entities: makeBars(sorted, -1, false),
            edges: [],
            description: `Probability-weighted estimate ${stage.label} = ${stage.b.toFixed(6)} from the sorted sample.`,
            codeLineNumber: stage.line,
            layout: "array",
            meta: { n, L1: b0, L2: 0, L3: 0, L4: 0, tau3: 0, tau4: 0, [stage.label]: stage.b },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(sorted, -1, true),
        edges: [],
        description: `L1 = ${L1.toFixed(4)}, L2 = ${L2.toFixed(4)}, L3 = ${L3.toFixed(4)}, L4 = ${L4.toFixed(4)}; tau3 = ${tau3.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { n, L1, L2, L3, L4, tau3, tau4 },
    };
}

/** The L-moments module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "L-moments replace powers with order. After sorting the data, each L-moment is a weighted average of the smallest, second smallest, and so on. The first is just the mean, the second is half the average gap between pairs, and higher ones describe shape. Because nothing is raised to a high power, a single outlier cannot dominate the answer the way it can for ordinary moments.",
        invariants: [
            "L1 always equals the arithmetic mean of the sample.",
            "L2 equals half of Gini's mean difference, so it is nonnegative and zero only for constant data.",
            "Shifting every value by a constant changes only L1; scaling by a factor scales every L-moment by that factor.",
        ],
        correctness:
            "The b_k estimates are the unbiased sample probability-weighted moments of Hosking. Substituting them into the identities L1 = b0, L2 = 2b1 - b0, L3 = 6b2 - 6b1 + b0 and L4 = 20b3 - 30b2 + 12b1 - b0 gives the sample L-moments. For L2 the algebra reduces to the average pairwise absolute gap over n(n-1), which is exactly half of Gini's mean difference, confirming the scale and location behavior.",
        complexityRationale:
            "Sorting dominates at O(n log n); each of b0 through b3 then uses one linear pass over the order statistics, so the total is O(n log n) time. The sorted copy and bars take O(n) space.",
        uses: [
            "Robust regional frequency analysis of hydrologic extremes",
            "Fitting distributions when samples are short or noisy",
            "Summarizing skewness and tail weight with low outlier sensitivity",
        ],
        references: [
            "Hosking, L-Moments: Analysis and Estimation of Distributions, 1990",
            "Hosking and Wallis, Regional Frequency Analysis, Chapter 2",
        ],
        workedExample:
            "For the sorted sample 1, 2, 3, 4, 5, 6, 7, 9 the mean L1 is 4.625. The average absolute pairwise gap is about 2.46, so L2 is about 2.46; the ratios tau3 and tau4 then describe a mildly right-skewed, moderate-tailed shape.",
    },
    id: "l-moments",
    name: "L-Moments",
    category: "statistics-probability",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { values: [3, 1, 7, 2, 9, 4, 6, 5] },
    visualType: "array",
    run,
    pseudocode: [
        "sort the sample into ascending order statistics",
        "set b0 to the arithmetic mean of all values",
        "form b1 from a weighted sum of order statistics two through n",
        "form b2 from a weighted sum of order statistics three through n",
        "form b3 from a weighted sum of order statistics four through n",
        "convert b0 through b3 into L1 through L4",
        "divide L3 and L4 by L2 to obtain tau3 and tau4",
        "done: report the L-moments and L-moment ratios",
    ],
};

export default module;
