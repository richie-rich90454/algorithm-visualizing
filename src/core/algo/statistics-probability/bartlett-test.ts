/**
 * bartlett-test.ts - Bartlett's Test for Equal Variances
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bartlett's test checks whether several groups share a common variance. It
 * compares the pooled within-group variance with each group's own variance on
 * a log scale, producing a chi-square statistic with k-1 degrees of freedom.
 * Unlike Levene's test it assumes each group is normally distributed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) over all observations
 *   Space: O(k) for the per-group summaries and displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per group shows its sample variance.
 *   - The bar under evaluation is highlighted; the final frame is green.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Abramowitz-Stegun normal cumulative distribution approximation. */
function normalCdf(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
    const upper = phi * poly;
    return z >= 0 ? 1 - upper : upper;
}

function makeBars(variances: number[], current: number, done: boolean): VisualEntity[] {
    return variances.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `group ${index + 1}: ${value.toFixed(3)}`,
        value,
        state: (done ? "sorted" : index === current ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function groupStats(group: number[]): { n: number; variance: number } {
    const n = group.length;
    if (n < 2) return { n, variance: 0 };
    const mean = group.reduce((s, v) => s + v, 0) / n;
    const ss = group.reduce((s, v) => s + (v - mean) ** 2, 0);
    return { n, variance: ss / (n - 1) };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { groups?: number[][]; alpha?: number } | null) ?? {};
    const groups: number[][] = Array.isArray(task.groups) && task.groups.length >= 2
        ? task.groups.filter((g) => Array.isArray(g) && g.length >= 2)
        : [[4, 5, 6, 5, 4], [5, 6, 7, 6, 5], [4, 4, 5, 6, 6]];
    const alpha = typeof task.alpha === "number" && task.alpha > 0 && task.alpha < 1 ? task.alpha : 0.05;
    const stats = groups.map(groupStats);
    const variances = stats.map((s) => s.variance);
    const k = groups.length;
    const N = stats.reduce((s, g) => s + g.n, 0);
    const df = k - 1;
    const withinDf = N - k;
    const pooled = withinDf > 0
        ? stats.reduce((s, g) => s + (g.n - 1) * g.variance, 0) / withinDf
        : 0;
    const safeLog = (v: number): number => Math.log(Math.max(v, 1e-12));
    const T = withinDf * safeLog(pooled) - stats.reduce((s, g) => s + (g.n - 1) * safeLog(g.variance), 0);
    const correction = 1 + (1 / (3 * df)) * (stats.reduce((s, g) => s + 1 / (g.n - 1), 0) - 1 / withinDf);
    const statistic = T / correction;
    const z = ((Math.pow(Math.max(statistic, 0) / df, 1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df)));
    const pValue = Math.min(1, Math.max(0, 1 - normalCdf(z)));
    const equalVariances = pValue >= alpha;

    const base = { k, N, df, pooled, statistic, correction, chiSquare: statistic, pValue, alpha, equalVariances };
    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(variances, -1, false),
        edges: [],
        description: `Testing equal variances across ${k} groups with ${N} total observations.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, groupSizes: stats.map((s) => s.n), variances },
    };
    for (let i = 0; i < k; i += 1) {
        yield {
            stepNumber: step++,
            entities: makeBars(variances, i, false),
            edges: [],
            description: `Group ${i + 1}: n = ${stats[i]?.n}, sample variance = ${variances[i]?.toFixed(4)}.`,
            codeLineNumber: 0,
            layout: "array",
            meta: { ...base, groupSizes: stats.map((s) => s.n), variances, current: i },
        };
    }
    yield {
        stepNumber: step++,
        entities: makeBars(variances, -1, false),
        edges: [],
        description: `Pooled within-group variance = ${pooled.toFixed(4)} over ${withinDf} degrees of freedom.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...base, groupSizes: stats.map((s) => s.n), variances },
    };
    yield {
        stepNumber: step++,
        entities: makeBars(variances, -1, false),
        edges: [],
        description: `Log-variance statistic T = ${T.toFixed(4)}, correction C = ${correction.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...base, groupSizes: stats.map((s) => s.n), variances, T },
    };
    yield {
        stepNumber: step++,
        entities: makeBars(variances, -1, false),
        edges: [],
        description: `Chi-square statistic = T / C = ${statistic.toFixed(4)} with ${df} degrees of freedom.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...base, groupSizes: stats.map((s) => s.n), variances, T },
    };
    yield {
        stepNumber: step,
        entities: makeBars(variances, -1, true),
        edges: [],
        description: `p-value ${pValue.toFixed(4)} ${equalVariances ? "does not reject" : "rejects"} equal variances at alpha ${alpha}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { ...base, groupSizes: stats.map((s) => s.n), variances, T },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If several groups really share one variance, their individual sample variances should all be close to the pooled variance. Bartlett's test measures the gap on a logarithmic scale, so a large gap is evidence that at least one group has a different spread.",
        invariants: [
            "The pooled variance is a weighted average of the group variances with weights n_i - 1.",
            "The correction factor is at least one, so it never inflates the statistic.",
            "The statistic is nonnegative and grows as the group variances differ more.",
        ],
        correctness:
            "Under the null hypothesis of equal normal variances, the log-variance contrast T divided by the correction C is approximately chi-square distributed with k-1 degrees of freedom. The correction comes from the second-order expansion of the log sample variance, which restores the nominal size of the test in small samples. Comparing the resulting p-value with alpha therefore controls the type I error to the approximation's accuracy.",
        complexityRationale:
            "Computing each group's mean and variance scans its observations once, giving O(N) time. Only k group summaries and k bars are stored, so space is O(k).",
        uses: [
            "Checking the equal-variance assumption before analysis of variance",
            "Validating that measurement instruments have comparable precision",
            "Quality control across several production batches",
        ],
        references: [
            "Bartlett, Properties of Sufficiency and Statistical Tests, 1937",
            "Casella and Berger, Statistical Inference, Section on testing variances",
        ],
        workedExample:
            "For three groups of five observations with variances 0.5, 0.5 and 0.5 the pooled variance is 0.5, T is zero and the test never rejects. If the third variance rises to 5, T grows sharply and the p-value falls below 0.05.",
    },
    id: "bartlett-test",
    name: "Bartlett's Test",
    category: "statistics-probability",
    complexity: { time: "O(N)", space: "O(k)" },
    defaultInput: { groups: [[4, 5, 6, 5, 4], [5, 6, 7, 6, 5], [4, 4, 5, 6, 6]], alpha: 0.05 },
    visualType: "array",
    run,
    pseudocode: [
        "compute each group's sample variance",
        "pool the within-group variances",
        "form the log-variance statistic T",
        "compute the small-sample correction C",
        "set the chi-square statistic to T over C",
        "find the p-value with k minus one degrees of freedom",
        "compare the p-value with the significance level",
        "done: report the statistic, p-value, and decision",
    ],
};

export default module;
