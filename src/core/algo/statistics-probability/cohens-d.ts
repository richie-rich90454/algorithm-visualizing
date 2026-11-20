/**
 * cohens-d.ts - Cohen's d Standardized Effect Size
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cohen's d expresses the difference between two sample means in units of the
 * pooled standard deviation. It computes each sample mean, pools the two
 * sample variances by their degrees of freedom, and divides the mean gap by
 * the square root of that pooled variance.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n observations across both samples
 *   Space: O(n) for the displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per observation, colored by which sample it belongs to.
 *   - The bar contributing to the running sum of squared deviations is active.
 *   - The final frame reports the pooled standard deviation and Cohen's d.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], groups: number[], active: number): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (active === index) {
            state = "active";
        } else if (active === -2) {
            state = groups[index] === 0 ? "sorted" : "visited";
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
            metadata: { index, group: groups[index] ?? 0 },
        };
    });
}

function mean(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleSumOfSquares(values: number[], center: number): number {
    return values.reduce((sum, value) => sum + (value - center) ** 2, 0);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { group1?: number[]; group2?: number[] } | null) ?? {};
    const group1: number[] = Array.isArray(task.group1) ? task.group1.slice() : [1, 2, 3, 4];
    const group2: number[] = Array.isArray(task.group2) ? task.group2.slice() : [5, 6, 7, 8];
    const values = [...group1, ...group2];
    const groups = [...group1.map(() => 0), ...group2.map(() => 1)];
    const n = values.length;

    yield {
        stepNumber: 0,
        entities: makeBars(values, groups, -1),
        edges: [],
        description: `Computing Cohen's d from two samples of sizes ${group1.length} and ${group2.length}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, m1: 0, m2: 0, pooledVariance: 0, d: 0 },
    };
    let step = 1;

    const m1 = mean(group1);
    const m2 = mean(group2);
    yield {
        stepNumber: step,
        entities: makeBars(values, groups, -1),
        edges: [],
        description: `Sample means are ${m1.toFixed(3)} and ${m2.toFixed(3)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { n, m1, m2, pooledVariance: 0, d: 0 },
    };
    step += 1;

    let sumOfSquares = 0;
    for (let i = 0; i < n; i += 1) {
        const center = groups[i] === 0 ? m1 : m2;
        const value = values[i] ?? 0;
        sumOfSquares += (value - center) ** 2;
        yield {
            stepNumber: step,
            entities: makeBars(values, groups, i),
            edges: [],
            description: `Observation ${i} is ${value.toFixed(3)}; its squared deviation is ${((value - center) ** 2).toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, m1, m2, pooledVariance: 0, d: 0, sumOfSquares },
        };
        step += 1;
    }

    const degrees = n - 2;
    const pooledVariance = degrees > 0 && n > 0 ? sumOfSquares / degrees : 0;
    const pooledSd = Math.sqrt(pooledVariance);
    const d = pooledSd > 0 ? (m1 - m2) / pooledSd : 0;
    yield {
        stepNumber: step,
        entities: makeBars(values, groups, -2),
        edges: [],
        description: `Pooled variance ${pooledVariance.toFixed(4)}; Cohen's d = ${d.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { n, m1, m2, pooledVariance, pooledSd, d },
    };
}

/** The Cohen d module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A raw mean difference is hard to judge without knowing the spread of the data. Cohen's d rescales that difference by the pooled standard deviation, so a value of one means the groups differ by roughly one within-group standard deviation.",
        invariants: [
            "The two sample means are the arithmetic averages of their groups.",
            "The pooled variance is the total within-group sum of squares divided by n minus two.",
            "Swapping the two groups negates d while leaving its magnitude unchanged.",
        ],
        correctness:
            "Each observation contributes exactly one squared deviation about its own group mean, so their sum is the within-group sum of squares. Dividing by the combined degrees of freedom gives the pooled variance under the equal-variance assumption, and dividing the mean gap by its square root produces the standardized difference. Identical groups give a zero numerator and therefore d equals zero.",
        complexityRationale:
            "Computing both means and the sum of squares makes a constant number of passes over the n observations, so time is linear; storing one bar per observation uses linear space.",
        uses: [
            "Reporting effect size in psychology and medical studies",
            "Power analysis and sample size planning",
            "Comparing the magnitude of effects across studies with different units",
        ],
        references: [
            "Cohen, Statistical Power Analysis for the Behavioral Sciences, 1988",
            "Cumming, Understanding the New Statistics, Chapter 5",
        ],
        workedExample:
            "For samples 1, 2, 3, 4 and 5, 6, 7, 8 the means are 2.5 and 6.5. The within-group sum of squares is 10, pooled variance is 10 over 6, and the pooled standard deviation is about 1.291. Cohen's d is negative 4 divided by 1.291, about negative 3.10.",
    },
    id: "cohens-d",
    name: "Cohen's d",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { group1: [1, 2, 3, 4], group2: [5, 6, 7, 8] },
    visualType: "array",
    run,
    pseudocode: [
        "read the two samples and concatenate their observations",
        "compute the arithmetic mean of each sample",
        "for each observation add its squared deviation from its sample mean",
        "divide the total by n minus two to get the pooled variance",
        "take the square root to get the pooled standard deviation",
        "subtract the second sample mean from the first",
        "divide the mean difference by the pooled standard deviation",
        "done: report Cohen's d",
    ],
};

export default module;
