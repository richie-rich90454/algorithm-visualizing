/**
 * trimmed-mean.ts - Trimmed Mean
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A trimmed mean discards a fixed fraction of the smallest and largest values
 * before averaging the rest. Removing both tails makes the estimate robust to
 * outliers while still using more information than the median. The count
 * removed from each tail is floor(proportion * n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for the sort, plus O(n) for the sum
 *   Space: O(n) for the sorted copy and displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the values in sorted order.
 *   - Discarded tail bars are ERROR; retained bars are SORTED.
 *   - The final frame reports the retained count and mean in meta.
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

/** Sort, drop both tails, then average the survivors. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; proportion?: number } | null) ?? {};
    const raw = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map(Number)
        : [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    const proportion = typeof task.proportion === "number"
        ? Math.max(0, Math.min(0.49, task.proportion))
        : 0.1;
    const sorted = [...raw].sort((a, b) => a - b);
    const k = Math.floor(proportion * sorted.length);
    const keepCount = sorted.length - 2 * k;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(raw),
        edges: [],
        description: `Sort ${raw.length} values, then remove ${k} smallest and ${k} largest before averaging.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: raw.length, proportion, k, keepCount },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(sorted),
        edges: [],
        description: `Values in sorted order; the ${k} values at each end will be discarded.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { n: sorted.length, proportion, k, keepCount },
    };
    step += 1;

    const tailStates = new Map<number, EntityState>();
    for (let i = 0; i < sorted.length; i += 1) {
        tailStates.set(i, i < k || i >= sorted.length - k ? "error" : "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeBars(sorted, tailStates),
        edges: [],
        description: `Discard ${k} smallest and ${k} largest values, keeping ${keepCount} central values.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { n: sorted.length, proportion, k, keepCount },
    };
    step += 1;

    if (keepCount <= 0) {
        yield {
            stepNumber: step,
            entities: makeBars(sorted, tailStates),
            edges: [],
            description: "Too many values were trimmed, so no central values remain to average.",
            codeLineNumber: 3,
            layout: "array",
            meta: { n: sorted.length, proportion, k, keepCount, result: 0, valid: false },
        };
        return;
    }

    let sum = 0;
    for (let i = k; i < sorted.length - k; i += 1) {
        sum += sorted[i] ?? 0;
        const states = new Map<number, EntityState>(tailStates);
        states.set(i, "comparing");
        yield {
            stepNumber: step,
            entities: makeBars(sorted, states),
            edges: [],
            description: `Add the retained value ${sorted[i]} to the sum (running sum ${sum}).`,
            codeLineNumber: 4,
            layout: "array",
            meta: { n: sorted.length, k, keepCount, index: i, sum },
        };
        step += 1;
    }

    const result = sum / keepCount;
    yield {
        stepNumber: step,
        entities: makeBars(sorted, tailStates),
        edges: [],
        description: `Trimmed mean = ${sum} / ${keepCount} = ${result.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n: sorted.length, proportion, k, keepCount, sum, result, valid: true },
    };
}

/** The trimmed mean module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A single extreme value can drag an ordinary mean far from the bulk of the data. A trimmed mean first sorts the data and throws away a chosen fraction of the smallest and largest observations, then averages what remains. It keeps most of the data while refusing to let a few wild values decide the answer, and with a large trim it approaches the median.",
        invariants: [
            "The sorted array contains exactly the original multiset of values.",
            "The removed count k is the same at both ends, so the retained block is contiguous.",
            "The running sum after a prefix of the retained block equals the sum of those retained values.",
        ],
        correctness:
            "Sorting partitions the values into a lower tail, a retained central block, and an upper tail. Discarding the tails is a deterministic rule based only on rank, so it removes exactly the intended outliers. The final division by the retained count is the ordinary arithmetic mean of that block, which is the definition of the trimmed mean.",
        complexityRationale:
            "Sorting dominates at O(n log n); the removal and summation are single linear passes, so total time is O(n log n). The sorted copy and bars take O(n) space.",
        uses: [
            "Robust reporting of panel scores after dropping extreme judgments",
            "Estimating central tendency in the presence of measurement errors",
            "Financial statistics that discount rare market shocks",
        ],
        references: [
            "Tukey, Exploratory Data Analysis, chapter on robust summaries",
            "NIST/SEMATECH e-Handbook of Statistical Methods, robust estimators",
        ],
        workedExample:
            "For 1, 2, 3, 4, 5, 6, 7, 8, 9, 100 with proportion 0.1, k is 1, so 1 and 100 are removed. The remaining sum is 45 over 8 values, giving a trimmed mean of 5.625 instead of the outlier-sensitive 14.5.",
    },
    id: "trimmed-mean",
    name: "Trimmed Mean",
    category: "statistics-probability",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 100], proportion: 0.1 },
    visualType: "array",
    run,
    pseudocode: [
        "sort the values in nondecreasing order",
        "let k be floor(proportion times n)",
        "mark the first k and last k values as discarded",
        "if no values remain, report an undefined mean",
        "sum the values from index k through n minus k minus one",
        "divide the sum by the number of retained values",
        "done: report the trimmed mean",
    ],
};

export default module;
