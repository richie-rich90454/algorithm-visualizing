/**
 * interquartile-range.ts - Interquartile Range
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The interquartile range, or IQR, is the width of the middle half of a data
 * set. It is the third quartile minus the first quartile, where each quartile
 * is the median of its half of the sorted data. Because it ignores both
 * extremes it is a robust measure of spread and forms the basis of the box
 * plot outlier rule: values below Q1 minus 1.5 IQR or above Q3 plus 1.5 IQR
 * are flagged.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for the sort
 *   Space: O(n) for the sorted copy and displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show sorted values, colored by lower half, upper half, or median.
 *   - The quartile frames highlight the value that fixes Q1 and Q3.
 *   - The final frame reports Q1, Q3, IQR, and the outlier fences in meta.
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

/** Median of an already sorted array. */
function medianOfSorted(sorted: number[]): number {
    const n = sorted.length;
    if (n === 0) {
        return 0;
    }
    const mid = Math.floor(n / 2);
    return n % 2 === 1
        ? (sorted[mid] ?? 0)
        : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Split sorted data into quartiles via the median-of-halves convention. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const raw = Array.isArray(task.values)
        ? task.values.map(Number)
        : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(raw),
        edges: [],
        description: `Find the interquartile range of ${raw.length} values from their sorted halves.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: raw.length },
    };
    step += 1;

    if (raw.length < 2) {
        yield {
            stepNumber: step,
            entities: makeBars(raw),
            edges: [],
            description: "At least two values are needed to define an interquartile range.",
            codeLineNumber: 1,
            layout: "array",
            meta: { n: raw.length, result: 0, valid: false },
        };
        return;
    }

    const sorted = [...raw].sort((a, b) => a - b);
    const half = Math.floor(sorted.length / 2);
    const lower = sorted.slice(0, half);
    const upper = sorted.slice(sorted.length - half);
    const halfStates = new Map<number, EntityState>();
    for (let i = 0; i < sorted.length; i += 1) {
        halfStates.set(i, i < half ? "active" : i >= sorted.length - half ? "highlight" : "idle");
    }
    yield {
        stepNumber: step,
        entities: makeBars(sorted, halfStates),
        edges: [],
        description: `Values sorted; split into ${half}-value lower and upper halves.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { n: sorted.length, half },
    };
    step += 1;

    const q1 = medianOfSorted(lower);
    const q3 = medianOfSorted(upper);
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;

    yield {
        stepNumber: step,
        entities: makeBars(sorted, halfStates),
        edges: [],
        description: `Q1 is the median of the lower half: ${q1}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { n: sorted.length, q1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(sorted, halfStates),
        edges: [],
        description: `Q3 is the median of the upper half: ${q3}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { n: sorted.length, q1, q3 },
    };
    step += 1;

    const outlierStates = new Map<number, EntityState>();
    for (let i = 0; i < sorted.length; i += 1) {
        const value = sorted[i] ?? 0;
        outlierStates.set(i, value < lowerFence || value > upperFence ? "error" : "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeBars(sorted, outlierStates),
        edges: [],
        description: `IQR = Q3 - Q1 = ${iqr}; fences are ${lowerFence.toFixed(2)} and ${upperFence.toFixed(2)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n: sorted.length, q1, q3, iqr, lowerFence, upperFence, result: iqr, valid: true },
    };
}

/** The interquartile range module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A box plot draws the middle half of the data as a box. The interquartile range is that box's width: the third quartile minus the first. Each quartile is found by taking the median of one half of the sorted data, so the measure depends only on ranks and ignores how far the extreme values sit.",
        invariants: [
            "The sorted array preserves the original multiset of values.",
            "The lower and upper halves have equal size and exclude a middle value when n is odd.",
            "Q3 is at least Q1, so the interquartile range is nonnegative.",
        ],
        correctness:
            "By the median-of-halves convention, Q1 is the median of the lower half and Q3 is the median of the upper half. Sorting makes those medians exact, and subtracting them yields the width that contains the central fifty percent of ordered observations. The 1.5 IQR fences follow directly from Tukey's rule and identify values outside that robust central region.",
        complexityRationale:
            "Sorting costs O(n log n); slicing the halves and computing their medians is linear in the slice sizes, so the overall time is O(n log n). The sorted array and bars occupy O(n) space.",
        uses: [
            "Drawing box plots and detecting candidate outliers",
            "Summarizing test score or income dispersion",
            "Robust monitoring of latency and other skewed metrics",
        ],
        references: [
            "Tukey, Exploratory Data Analysis, chapter on box plots",
            "NIST/SEMATECH e-Handbook of Statistical Methods, descriptive statistics",
        ],
        workedExample:
            "For 1 through 12 the lower half is 1,2,3,4,5,6 with median 3.5 and the upper half is 7,8,9,10,11,12 with median 9.5. The IQR is 6, the fences are -5.5 and 18.5, so none of the twelve values is flagged as an outlier.",
    },
    id: "interquartile-range",
    name: "Interquartile Range",
    category: "statistics-probability",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    visualType: "array",
    run,
    pseudocode: [
        "sort the values in nondecreasing order",
        "if fewer than two values exist, report undefined",
        "split the sorted values into equal lower and upper halves",
        "set Q1 to the median of the lower half",
        "set Q3 to the median of the upper half",
        "set IQR to Q3 minus Q1 and form the 1.5 IQR fences",
        "done: report the interquartile range and flagged values",
    ],
};

export default module;
