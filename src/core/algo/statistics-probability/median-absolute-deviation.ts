/**
 * median-absolute-deviation.ts - Median Absolute Deviation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The median absolute deviation, or MAD, is a robust measure of spread. It is
 * the median of the absolute deviations from the data median. Multiplying the
 * raw MAD by 1.4826 makes it a consistent estimator of the standard deviation
 * for normally distributed data. Unlike variance it is barely affected by a
 * handful of extreme observations.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for the two sorts
 *   Space: O(n) for the sorted copy and deviation bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The first phase shows sorted values with the median highlighted.
 *   - The second phase shows absolute deviations as bars.
 *   - The final frame reports median, MAD, and scaled MAD in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** Median of an array that the caller has already sorted. */
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

/** Compute the median, the deviations, then the median of those deviations. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const raw = Array.isArray(task.values)
        ? task.values.map(Number)
        : [1, 2, 2, 3, 4, 7, 9, 100];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(raw),
        edges: [],
        description: `Measure the spread of ${raw.length} values with the median absolute deviation.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: raw.length },
    };
    step += 1;

    if (raw.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "No values were supplied, so the median absolute deviation is undefined.",
            codeLineNumber: 1,
            layout: "array",
            meta: { n: 0, result: 0, valid: false },
        };
        return;
    }

    const sorted = [...raw].sort((a, b) => a - b);
    yield {
        stepNumber: step,
        entities: makeBars(sorted),
        edges: [],
        description: "Values sorted so the middle element gives the data median.",
        codeLineNumber: 1,
        layout: "array",
        meta: { n: sorted.length },
    };
    step += 1;

    const median = medianOfSorted(sorted);
    const medianStates = new Map<number, EntityState>();
    for (let i = 0; i < sorted.length; i += 1) {
        medianStates.set(i, sorted[i] === median ? "highlight" : "idle");
    }
    yield {
        stepNumber: step,
        entities: makeBars(sorted, medianStates),
        edges: [],
        description: `The data median is ${median}; deviations are measured from this center.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { n: sorted.length, median },
    };
    step += 1;

    const deviations = raw.map((value) => Math.abs(value - median));
    yield {
        stepNumber: step,
        entities: makeBars(deviations),
        edges: [],
        description: "Absolute deviations from the median, ready for their own median.",
        codeLineNumber: 3,
        layout: "array",
        meta: { n: deviations.length, median },
    };
    step += 1;

    const sortedDeviations = [...deviations].sort((a, b) => a - b);
    const result = medianOfSorted(sortedDeviations);
    const scaled = 1.4826 * result;
    const finalStates = new Map<number, EntityState>();
    const mid = Math.floor(sortedDeviations.length / 2);
    for (let i = 0; i < sortedDeviations.length; i += 1) {
        finalStates.set(i, i === mid || (sortedDeviations.length % 2 === 0 && i === mid - 1)
            ? "highlight"
            : "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeBars(sortedDeviations, finalStates),
        edges: [],
        description: `MAD = median of deviations = ${result.toFixed(4)}; scaled MAD = ${scaled.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n: sorted.length, median, mad: result, scaledMad: scaled, result, valid: true },
    };
}

/** The median absolute deviation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Variance squares deviations, which lets one extreme point dominate the answer. The median absolute deviation instead measures every point's distance from the middle value and then takes the middle of those distances. Both layers use medians, so up to half the data can be arbitrary before the answer changes dramatically.",
        invariants: [
            "The sorted values contain exactly the original multiset.",
            "Each deviation is nonnegative and equals the distance from the data median.",
            "The final result is the median of the deviation multiset, not its mean.",
        ],
        correctness:
            "By definition the MAD is the median of the absolute deviations from the median. Sorting the data locates that center exactly; taking absolute differences produces the deviation multiset; sorting those and taking their middle element returns the MAD. The constant 1.4826 is the reciprocal of the normal distribution's median absolute deviation, so the scaled value is consistent with the normal standard deviation.",
        complexityRationale:
            "Two sorts of n elements dominate, each O(n log n); computing deviations and locating medians is linear. The sorted arrays and bars take O(n) space.",
        uses: [
            "Robust outlier detection in signal processing",
            "Reliable spread estimates for skewed income or latency data",
            "Quality control when measurements contain gross errors",
        ],
        references: [
            "Rousseeuw and Croux, Alternatives to the Median Absolute Deviation, 1993",
            "NIST/SEMATECH e-Handbook of Statistical Methods, robust estimators",
        ],
        workedExample:
            "For 1, 2, 2, 3, 4, 7, 9, 100 the median is 3.5. The absolute deviations are 2.5, 1.5, 1.5, 0.5, 0.5, 3.5, 5.5, 96.5; their median is 2. The scaled MAD is 2.965, far less than the standard deviation inflated by the value 100.",
    },
    id: "median-absolute-deviation",
    name: "Median Absolute Deviation",
    category: "statistics-probability",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { values: [1, 2, 2, 3, 4, 7, 9, 100] },
    visualType: "array",
    run,
    pseudocode: [
        "sort the data and find the median m",
        "if the data are empty, report an undefined deviation",
        "highlight the value or values that determine m",
        "compute each absolute deviation from m",
        "sort the deviations and take their median",
        "multiply by 1.4826 for a normal-consistent scale",
        "done: report the median absolute deviation",
    ],
};

export default module;
