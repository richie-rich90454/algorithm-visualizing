/**
 * k-statistics.ts - Unbiased Estimators of Cumulants
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A k-statistic is the unique symmetric unbiased estimator of a population
 * cumulant. The first three are the mean, the unbiased variance, and the
 * unbiased third cumulant. Each is built from the power sums of the sample and
 * stays unbiased no matter what distribution produced the data.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n sample values
 *   Space: O(n) for the displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each sample value is drawn as a bar.
 *   - The bar being folded into the power sums is highlighted.
 *   - The final frame is green and reports all computed k-statistics.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    const states = new Map<number, EntityState>([[active, done ? "sorted" : "comparing"]]);
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: done ? "sorted" : (states.get(index) ?? "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map((v) => Number(v) || 0)
        : [1, 2, 3, 5, 9];
    const n = values.length;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values, -1, false),
        edges: [],
        description: `Accumulating the first three power sums over ${n} sample value(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, s1: 0, s2: 0, s3: 0 },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const x = values[i] ?? 0;
        s1 += x;
        s2 += x * x;
        s3 += x * x * x;
        yield {
            stepNumber: step,
            entities: makeBars(values, i, false),
            edges: [],
            description: `Added value ${x.toFixed(3)}: s1 = ${s1.toFixed(3)}, s2 = ${s2.toFixed(3)}, s3 = ${s3.toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { n, s1, s2, s3, current: i },
        };
        step += 1;
    }

    const k1 = s1 / n;
    yield {
        stepNumber: step,
        entities: makeBars(values, -1, false),
        edges: [],
        description: `The first k-statistic is the sample mean, ${k1.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { n, s1, s2, s3, k1 },
    };
    step += 1;

    let k2 = 0;
    let k3 = 0;
    if (n >= 2) {
        k2 = (n * s2 - s1 * s1) / (n * (n - 1));
        yield {
            stepNumber: step,
            entities: makeBars(values, -1, false),
            edges: [],
            description: `The second k-statistic is the unbiased variance, ${k2.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, k1, k2 },
        };
        step += 1;
    }
    if (n >= 3) {
        k3 = (n * n * s3 - 3 * n * s1 * s2 + 2 * s1 * s1 * s1) / (n * (n - 1) * (n - 2));
    }
    yield {
        stepNumber: step,
        entities: makeBars(values, -1, true),
        edges: [],
        description: n >= 3
            ? `Final k-statistics: k1 = ${k1.toFixed(4)}, k2 = ${k2.toFixed(4)}, k3 = ${k3.toFixed(4)}.`
            : `Final k-statistics: k1 = ${k1.toFixed(4)}, k2 = ${n >= 2 ? k2.toFixed(4) : "undefined"}; k3 needs at least three values.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, k1, k2: n >= 2 ? k2 : 0, k3: n >= 3 ? k3 : 0, hasK2: n >= 2, hasK3: n >= 3 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A cumulant describes the shape of a distribution, such as its center, spread, and asymmetry. A k-statistic is the symmetric function of the sample that estimates one cumulant without bias. The first three are built from sums of the values, their squares, and their cubes.",
        invariants: [
            "Every k-statistic is a symmetric function: reordering the sample changes nothing.",
            "The first power sum s1 is the sum of the values, s2 the sum of squares, and s3 the sum of cubes.",
            "Each k-statistic has expected value equal to the corresponding population cumulant.",
        ],
        correctness:
            "The first k-statistic is the sample mean, which is unbiased for the population mean. The second uses the denominator n(n-1), matching the unbiased sample variance. The third is the unique symmetric cubic estimator whose expectation equals the third cumulant; algebraically it equals n times the sum of cubed deviations about the mean divided by (n-1)(n-2), the known unbiased estimator.",
        complexityRationale:
            "One pass over the n values updates the three power sums, so the work is O(n). Only the three running sums and the bar entities are kept, giving O(n) space for the display.",
        uses: [
            "Unbiased moment and cumulant estimation in theoretical statistics",
            "Computing skewness estimates with correction factors for small samples",
            "Symbolic algebra systems that derive estimator formulas",
        ],
        references: [
            "R. A. Fisher, Contributions to Mathematical Statistics, 1922",
            "Kendall and Stuart, The Advanced Theory of Statistics, Volume 1",
        ],
        workedExample:
            "For the sample 1, 2, 3 the power sums are s1 = 6, s2 = 14, s3 = 36. Then k1 = 6/3 = 2, k2 = (3*14 - 36)/(3*2) = 1, and k3 = (9*36 - 3*3*6*14 + 2*216)/(3*2*1) = 0, the expected zero third cumulant of a symmetric sample.",
    },
    id: "k-statistics",
    name: "k-Statistics",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [1, 2, 3, 5, 9] },
    visualType: "array",
    run,
    pseudocode: [
        "read n sample values and set the power sums to zero",
        "for each value add x, x squared, and x cubed to the sums",
        "set k1 to s1 over n",
        "set k2 to (n s2 minus s1 squared) over n(n-1)",
        "set k3 to (n squared s3 minus 3n s1 s2 plus 2 s1 cubed) over n(n-1)(n-2)",
        "report the unbiased cumulant estimates",
    ],
};

export default module;
