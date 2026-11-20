/**
 * one-way-anova.ts - One-Way Analysis of Variance
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * One-way ANOVA tests whether several groups have the same population mean. It
 * splits the total variation of the data into a between-groups part, caused by
 * real differences among group means, and a within-groups part, caused by noise
 * around each mean. Their ratio, adjusted by degrees of freedom, is the F
 * statistic; a small p value indicates that at least one group mean differs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) for N total observations
 *   Space: O(k) for k group summaries and displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per group shows that group's mean.
 *   - Each group is highlighted while its mean is computed.
 *   - meta carries the full variance decomposition and the F test result.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Log Gamma via the Lanczos approximation. */
function logGamma(z: number): number {
    const coefficients = [
        76.18009172947146, -86.50532032941677, 24.01409824083091,
        -1.231739572450155, 0.001208650973866179, -0.000005395239384953,
    ];
    let x = z;
    let y = z;
    let series = 1.000000000190015;
    for (const coefficient of coefficients) {
        y += 1;
        series += coefficient / y;
    }
    const t = x + 5.5;
    return -t + (x + 0.5) * Math.log(t) + Math.log((2.5066282746310005 * series) / x);
}

/** Continued fraction for the incomplete beta function. */
function betacf(a: number, b: number, x: number): number {
    const maxIterations = 200;
    const epsilon = 3e-12;
    const tiny = 1e-300;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < tiny) {
        d = tiny;
    }
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= maxIterations; m += 1) {
        const m2 = 2 * m;
        let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < tiny) {
            d = tiny;
        }
        c = 1 + aa / c;
        if (Math.abs(c) < tiny) {
            c = tiny;
        }
        d = 1 / d;
        h *= d * c;
        aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < tiny) {
            d = tiny;
        }
        c = 1 + aa / c;
        if (Math.abs(c) < tiny) {
            c = tiny;
        }
        d = 1 / d;
        const delta = d * c;
        h *= delta;
        if (Math.abs(delta - 1) < epsilon) {
            break;
        }
    }
    return h;
}

/** Regularized incomplete beta function. */
function betai(a: number, b: number, x: number): number {
    if (x <= 0) {
        return 0;
    }
    if (x >= 1) {
        return 1;
    }
    const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) {
        return (front * betacf(a, b, x)) / a;
    }
    return 1 - (front * betacf(b, a, 1 - x)) / b;
}

/** Upper-tail p value of the F distribution. */
function fPValue(f: number, dfBetween: number, dfWithin: number): number {
    if (!(f > 0)) {
        return 1;
    }
    return betai(dfWithin / 2, dfBetween / 2, dfWithin / (dfWithin + dfBetween * f));
}

/** Build one bar per group. */
function makeBars(means: number[], current: number, phase: string): VisualEntity[] {
    return means.map((mean, index) => {
        let state: EntityState = "idle";
        if (phase === "done") {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `G${index + 1}:${mean.toFixed(3)}`,
            value: mean,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, mean },
        };
    });
}

/** The one-way ANOVA generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { groups?: number[][] } | null) ?? {};
    const fallback = [[6, 8, 4, 5, 7], [8, 12, 9, 11, 10], [13, 9, 11, 8, 12]];
    const groups = Array.isArray(task.groups) && task.groups.length >= 2
        ? task.groups.map((group) => (Array.isArray(group) ? group.map((value) => Number(value)).filter((value) => Number.isFinite(value)) : [])).filter((group) => group.length > 0)
        : fallback;
    const k = groups.length;
    const groupMeans = groups.map((group) => group.reduce((sum, value) => sum + value, 0) / group.length);
    const totalN = groups.reduce((sum, group) => sum + group.length, 0);
    const grandMean = groups.reduce((sum, group) => sum + group.reduce((g, value) => g + value, 0), 0) / totalN;

    let ssBetween = 0;
    for (let i = 0; i < k; i += 1) {
        ssBetween += groups[i]!.length * (groupMeans[i]! - grandMean) ** 2;
    }
    let ssWithin = 0;
    for (let i = 0; i < k; i += 1) {
        for (const value of groups[i]!) {
            ssWithin += (value - groupMeans[i]!) ** 2;
        }
    }
    let ssTotal = 0;
    for (const group of groups) {
        for (const value of group) {
            ssTotal += (value - grandMean) ** 2;
        }
    }
    const dfBetween = k - 1;
    const dfWithin = totalN - k;
    const msBetween = dfBetween > 0 ? ssBetween / dfBetween : 0;
    const msWithin = dfWithin > 0 ? ssWithin / dfWithin : 0;
    const f = msWithin > 0 ? msBetween / msWithin : 0;
    const pValue = fPValue(f, dfBetween, dfWithin);

    const meta = { k, totalN, groupMeans, grandMean, ssBetween, ssWithin, ssTotal, dfBetween, dfWithin, msBetween, msWithin, f, pValue };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(groupMeans, -1, "setup"),
        edges: [],
        description: `One-way ANOVA on ${k} groups with ${totalN} observations; testing for equal group means.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...meta, phase: "setup" },
    };
    step += 1;

    for (let i = 0; i < k; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(groupMeans, i, "mean"),
            edges: [],
            description: `Group ${i + 1}: ${groups[i]!.length} observations, mean ${groupMeans[i]!.toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { ...meta, phase: "mean", group: i },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(groupMeans, -1, "grand"),
        edges: [],
        description: `The grand mean over all observations is ${grandMean.toFixed(3)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...meta, phase: "grand" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(groupMeans, -1, "between"),
        edges: [],
        description: `Between-groups variation SSB = ${ssBetween.toFixed(3)} with ${dfBetween} degree(s) of freedom.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...meta, phase: "between" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(groupMeans, -1, "within"),
        edges: [],
        description: `Within-groups variation SSW = ${ssWithin.toFixed(3)} with ${dfWithin} degree(s) of freedom; SSB + SSW equals SST ${ssTotal.toFixed(3)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...meta, phase: "within" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(groupMeans, -1, "done"),
        edges: [],
        description: `F = MSB / MSW = ${f.toFixed(3)} with p approximately ${pValue.toFixed(5)}; ${pValue < 0.05 ? "reject" : "do not reject"} equal means at the 5 percent level.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...meta, phase: "done", rejectAtFivePercent: pValue < 0.05 },
    };
}

/** The one-way ANOVA module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Ask whether the differences between group averages are large compared with the scatter inside each group. If groups are far apart relative to their internal noise, that is evidence their true means differ. ANOVA turns this comparison into one F ratio by splitting total variation into a between part and a within part.",
        invariants: [
            "The total sum of squares equals the between plus the within sum of squares.",
            "Degrees of freedom add: df total equals df between plus df within.",
            "The p value lies between zero and one and decreases as F grows.",
        ],
        correctness:
            "Under the null hypothesis of equal normal means with common variance, the between-groups sum of squares divided by its degrees of freedom and the within-groups sum of squares divided by its degrees of freedom are independent estimates of the same variance. Their ratio therefore follows an F distribution with k minus one and N minus k degrees of freedom. Computing the upper-tail probability of that F distribution gives a p value with the stated significance level, so rejecting when p is small controls the false-positive rate.",
        complexityRationale:
            "Each observation contributes once to a group sum and once to a squared deviation, so computing all sums of squares takes O(N) time. Only k group means and summary statistics are stored, giving O(k) space.",
        uses: [
            "Comparing average yields across several treatments",
            "Testing whether user groups differ on a metric",
            "A first step before post hoc pairwise comparisons",
        ],
        references: [
            "Fisher, Statistical Methods for Research Workers, 1925",
            "Montgomery, Design and Analysis of Experiments, Chapter 3",
        ],
        workedExample:
            "For groups 6,8,4,5,7 and 8,12,9,11,10 and 13,9,11,8,12, the group means are 6, 10, and 10.6 with a grand mean near 8.87. The between variation is large relative to the scatter inside groups, producing an F above the critical value and a small p value, so the equal-means hypothesis is rejected.",
    },
    id: "one-way-anova",
    name: "One-Way ANOVA",
    category: "statistics-probability",
    complexity: { time: "O(N)", space: "O(k)" },
    defaultInput: { groups: [[6, 8, 4, 5, 7], [8, 12, 9, 11, 10], [13, 9, 11, 8, 12]] },
    visualType: "array",
    run,
    pseudocode: [
        "compute each group mean and the overall grand mean",
        "accumulate the between-groups sum of squares",
        "accumulate the within-groups sum of squares",
        "divide each sum of squares by its degrees of freedom",
        "form F as the ratio of the two mean squares",
        "convert F to an upper-tail p value",
        "done: report F, p, and the significance verdict",
    ],
};

export default module;
