/**
 * winsorized-mean.ts - Winsorized Mean
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A winsorized mean limits extreme values instead of deleting them. After
 * sorting, the k smallest values are replaced by the value at rank k and the
 * k largest values by the value at rank n-k-1; the ordinary mean of the
 * modified list is then taken. Unlike a trimmed mean it keeps the sample size,
 * which helps when estimating variability.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for the sort, plus O(n) for the replacements and sum
 *   Space: O(n) for the modified copy and displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the sorted values with replaced tails in HIGHLIGHT.
 *   - The replacement step states which ranks clamp which tails.
 *   - The final frame reports the winsorized mean in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** Sort, clamp both tails to the nearest retained value, then average. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; proportion?: number } | null) ?? {};
    const raw = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map(Number)
        : [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    const proportion = typeof task.proportion === "number"
        ? Math.max(0, Math.min(0.49, task.proportion))
        : 0.1;
    const sorted = [...raw].sort((a, b) => a - b);
    const n = sorted.length;
    const k = Math.floor(proportion * n);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(raw),
        edges: [],
        description: `Winsorize ${n} values by clamping ${k} observations at each tail.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, proportion, k },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(sorted),
        edges: [],
        description: "Values in sorted order, ready for tail clamping.",
        codeLineNumber: 1,
        layout: "array",
        meta: { n, proportion, k },
    };
    step += 1;

    if (2 * k >= n) {
        yield {
            stepNumber: step,
            entities: makeBars(sorted),
            edges: [],
            description: "Too many values would be clamped, so the winsorized mean is undefined.",
            codeLineNumber: 2,
            layout: "array",
            meta: { n, proportion, k, result: 0, valid: false },
        };
        return;
    }

    const low = sorted[k] ?? 0;
    const high = sorted[n - k - 1] ?? 0;
    const winsorized = [...sorted];
    for (let i = 0; i < k; i += 1) {
        winsorized[i] = low;
        winsorized[n - 1 - i] = high;
    }
    const clampStates = new Map<number, EntityState>();
    for (let i = 0; i < n; i += 1) {
        clampStates.set(i, i < k || i >= n - k ? "highlight" : "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeBars(winsorized, clampStates),
        edges: [],
        description: `Clamp the ${k} smallest values to ${low} and the ${k} largest to ${high}; the sample size stays ${n}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { n, k, low, high },
    };
    step += 1;

    let sum = 0;
    for (let i = 0; i < n; i += 1) {
        sum += winsorized[i] ?? 0;
        const states = new Map<number, EntityState>(clampStates);
        states.set(i, "comparing");
        yield {
            stepNumber: step,
            entities: makeBars(winsorized, states),
            edges: [],
            description: `Add winsorized value ${winsorized[i]} to the sum (running sum ${sum}).`,
            codeLineNumber: 4,
            layout: "array",
            meta: { n, k, index: i, sum },
        };
        step += 1;
    }

    const result = sum / n;
    yield {
        stepNumber: step,
        entities: makeBars(winsorized, clampStates),
        edges: [],
        description: `Winsorized mean = ${sum} / ${n} = ${result.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, proportion, k, low, high, sum, result, valid: true },
    };
}

/** The winsorized mean module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of throwing away outliers, winsorizing pulls them back to the nearest value that survived the cut. The smallest observations are raised to the lowest retained value and the largest are lowered to the highest retained value. Because no observation is removed, the sample size and the ability to estimate spread are preserved.",
        invariants: [
            "Sorting preserves the original multiset of observations.",
            "Clamping only changes values in the first k and last k ranks.",
            "The winsorized array always has the same length as the input.",
        ],
        correctness:
            "Each replaced tail value becomes exactly the boundary retained value, so no winsorized observation is more extreme than that boundary. Averaging the modified array is the arithmetic mean of a list in which the tails have been capped, which is the definition of the winsorized mean. Keeping all n entries distinguishes it from a trimmed mean.",
        complexityRationale:
            "The sort costs O(n log n), clamping visits at most 2k entries, and the summation visits n entries, so the total time is O(n log n). The sorted and modified copies use O(n) space.",
        uses: [
            "Robust location estimation when sample size must be preserved",
            "Winsorized covariance and correlation in finance",
            "Limiting the influence of extreme survey responses",
        ],
        references: [
            "Tukey, Exploratory Data Analysis, chapter on robust summaries",
            "Wilcox, Introduction to Robust Estimation and Hypothesis Testing",
        ],
        workedExample:
            "For 1, 2, 3, 4, 5, 6, 7, 8, 9, 100 with k equal to 1, the value 1 becomes 2 and 100 becomes 9. The modified list sums to 55, and dividing by all 10 observations gives 5.5, compared with the ordinary mean 14.5.",
    },
    id: "winsorized-mean",
    name: "Winsorized Mean",
    category: "statistics-probability",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 100], proportion: 0.1 },
    visualType: "array",
    run,
    pseudocode: [
        "sort the values in nondecreasing order",
        "let k be floor(proportion times n)",
        "if two k reaches or exceeds n, report undefined",
        "set the first k values to the value at rank k",
        "set the last k values to the value at rank n minus k minus one",
        "sum all n values and divide by n",
        "done: report the winsorized mean",
    ],
};

export default module;
