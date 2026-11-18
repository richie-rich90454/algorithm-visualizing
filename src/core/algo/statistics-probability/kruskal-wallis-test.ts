/**
 * kruskal-wallis-test.ts - Kruskal-Wallis H Test with Tie Correction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Kruskal-Wallis test is the nonparametric analogue of one-way ANOVA. It
 * pools all observations, replaces each value by its rank in the pooled sample
 * (averaging ranks for ties), sums the ranks within each group, and forms the H
 * statistic from those rank sums. A correction for ties divides H by a factor
 * below one, and the corrected statistic is compared with a chi-square
 * distribution having k minus one degrees of freedom.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N log N) for sorting the pooled observations
 *   Space: O(N) for the pooled ranking and O(k) for group summaries
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per group shows that group's average rank.
 *   - The group being accumulated is yellow; the final verdict is green.
 *   - meta carries ranks, rank sums, H, the tie correction, and the p value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Regularized lower incomplete gamma by the series expansion. */
function gammaSeries(a: number, x: number): number {
    const maxIterations = 300;
    const epsilon = 3e-14;
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n <= maxIterations; n += 1) {
        term *= x / (a + n);
        sum += term;
        if (Math.abs(term) < Math.abs(sum) * epsilon) {
            break;
        }
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Regularized upper incomplete gamma by a continued fraction. */
function gammaContinuedFraction(a: number, x: number): number {
    const maxIterations = 300;
    const epsilon = 3e-14;
    const tiny = 1e-300;
    let b = x + 1 - a;
    let c = 1 / tiny;
    let d = 1 / Math.max(tiny, b);
    let h = d;
    for (let i = 1; i <= maxIterations; i += 1) {
        const an = -i * (i - a);
        b += 2;
        d = an * d + b;
        if (Math.abs(d) < tiny) {
            d = tiny;
        }
        c = b + an / c;
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
    return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Log gamma via the Lanczos approximation. */
function logGamma(z: number): number {
    const coefficients = [
        76.18009172947146, -86.50532032941677, 24.01409824083091,
        -1.231739572450155, 0.001208650973866179, -0.000005395239384953,
    ];
    let y = z;
    let series = 1.000000000190015;
    for (const coefficient of coefficients) {
        y += 1;
        series += coefficient / y;
    }
    const t = z + 5.5;
    return -t + (z + 0.5) * Math.log(t) + Math.log((2.5066282746310005 * series) / z);
}

/** Upper-tail probability of the chi-square distribution. */
function chiSquareSurvival(x: number, df: number): number {
    if (df <= 0) {
        return 1;
    }
    if (x <= 0) {
        return 1;
    }
    const a = df / 2;
    const half = x / 2;
    return half < a + 1 ? 1 - gammaSeries(a, half) : gammaContinuedFraction(a, half);
}

function makeBars(avgRanks: number[], active: number, done: boolean): VisualEntity[] {
    return avgRanks.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `G${index + 1}: ${value.toFixed(2)}`,
        value,
        state: (done ? "sorted" : index === active ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, avgRank: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { groups?: number[][] } | null) ?? {};
    const fallback = [[7, 9, 6, 8], [12, 14, 11, 13], [4, 5, 3, 6]];
    const groups = Array.isArray(task.groups) && task.groups.length >= 2
        ? task.groups
            .map((group) => (Array.isArray(group) ? group.map((v) => Number(v)).filter((v) => Number.isFinite(v)) : []))
            .filter((group) => group.length > 0)
        : fallback;
    const k = groups.length;
    const sizes = groups.map((group) => group.length);
    const n = sizes.reduce((sum, size) => sum + size, 0);

    // Pool values with their group, then sort by value to assign ranks.
    const pooled = groups.flatMap((group, groupIndex) =>
        group.map((value) => ({ value, group: groupIndex })),
    );
    pooled.sort((a, b) => a.value - b.value);
    const ranks = new Array<number>(pooled.length).fill(0);
    let i = 0;
    const tieSizes: number[] = [];
    while (i < pooled.length) {
        let j = i + 1;
        while (j < pooled.length && pooled[j]!.value === pooled[i]!.value) {
            j += 1;
        }
        const averageRank = (i + 1 + j) / 2;
        for (let t = i; t < j; t += 1) {
            ranks[t] = averageRank;
        }
        if (j - i > 1) {
            tieSizes.push(j - i);
        }
        i = j;
    }

    const rankSums = new Array<number>(k).fill(0);
    for (let t = 0; t < pooled.length; t += 1) {
        rankSums[pooled[t]!.group] = (rankSums[pooled[t]!.group] ?? 0) + (ranks[t] ?? 0);
    }
    const avgRanks = rankSums.map((sum, g) => sum / (sizes[g] ?? 1));

    let h = 0;
    for (let g = 0; g < k; g += 1) {
        h += ((rankSums[g] ?? 0) ** 2) / (sizes[g] ?? 1);
    }
    h = (12 / (n * (n + 1))) * h - 3 * (n + 1);
    let tieTerm = 0;
    for (const size of tieSizes) {
        tieTerm += size ** 3 - size;
    }
    const tieCorrection = n ** 3 - n > 0 ? 1 - tieTerm / (n ** 3 - n) : 1;
    const hCorrected = tieCorrection > 0 ? h / tieCorrection : h;
    const df = k - 1;
    const pValue = chiSquareSurvival(hCorrected, df);
    const reject = pValue < 0.05;

    const meta = (phase: string, group: number) => ({
        phase,
        group,
        k,
        n,
        sizes,
        ranks,
        rankSums,
        avgRanks,
        tieSizes,
        h,
        tieCorrection,
        hCorrected,
        df,
        pValue,
        reject,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(avgRanks, -1, false),
        edges: [],
        description: `Kruskal-Wallis on ${k} groups and ${n} pooled observations; ranking the combined sample.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta("setup", -1),
    };
    let step = 1;

    yield {
        stepNumber: step,
        entities: makeBars(avgRanks, -1, false),
        edges: [],
        description: `Assigned pooled ranks ${ranks.join(", ")}; ${tieSizes.length} tie group(s) share averaged ranks.`,
        codeLineNumber: 2,
        layout: "array",
        meta: meta("ranks", -1),
    };
    step += 1;

    for (let g = 0; g < k; g += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(avgRanks, g, false),
            edges: [],
            description: `Group ${g + 1}: rank sum ${rankSums[g]} over ${sizes[g]} observations, average rank ${avgRanks[g]!.toFixed(2)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: meta("rankSums", g),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(avgRanks, -1, false),
        edges: [],
        description: `Uncorrected statistic H = ${h.toFixed(4)} from the squared rank sums.`,
        codeLineNumber: 4,
        layout: "array",
        meta: meta("statistic", -1),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(avgRanks, -1, false),
        edges: [],
        description: `Tie correction ${tieCorrection.toFixed(5)} gives corrected H = ${hCorrected.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: meta("tieCorrection", -1),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(avgRanks, -1, true),
        edges: [],
        description: `With ${df} degree(s) of freedom, p = ${pValue.toFixed(5)}; ${reject ? "reject" : "do not reject"} equal distributions at 5 percent.`,
        codeLineNumber: 6,
        layout: "array",
        meta: meta("done", -1),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If the groups really come from the same distribution, their ranks should be interleaved when all observations are pooled. The Kruskal-Wallis test checks how far each group's average rank drifts from the overall middle rank. Large drift, measured by the H statistic, is evidence that at least one group tends toward larger values.",
        invariants: [
            "The rank sums over all groups add up to N times (N plus one) divided by two.",
            "Tied values receive the same average rank.",
            "The tie correction lies between zero and one, so correcting never decreases H.",
        ],
        correctness:
            "Under the null hypothesis, the N ranks are randomly assigned to the groups, which makes the rank sums hypergeometric with known mean and variance. The statistic is the standardized sum of squared deviations from those means and converges to a chi-square law with k minus one degrees of freedom as the group sizes grow. Ties reduce the variance of ranks, and dividing by the tie correction restores the chi-square approximation, so the reported p value has the intended asymptotic level.",
        complexityRationale:
            "Sorting the pooled observations dominates, taking O(N log N); computing rank sums and H is linear in N, and only k group summaries are retained.",
        uses: [
            "Comparing several groups when the data are skewed or ordinal",
            "A robust alternative to one-way ANOVA without normality assumptions",
            "Testing treatment effects in small or non-Gaussian samples",
        ],
        references: [
            "Kruskal and Wallis, Use of Ranks in One-Criterion Variance Analysis, 1952",
            "Conover, Practical Nonparametric Statistics, Chapter 5",
        ],
        workedExample:
            "For groups 7,9,6,8 and 12,14,11,13 and 4,5,3,6 the pooled ranks run 1 through 12. The second group holds the four largest ranks and the third the four smallest, so the rank sums are far apart, H is large, and the chi-square p value is small: the groups do not share one distribution.",
    },
    id: "kruskal-wallis-test",
    name: "Kruskal-Wallis Test",
    category: "statistics-probability",
    complexity: { time: "O(N log N)", space: "O(N)" },
    defaultInput: { groups: [[7, 9, 6, 8], [12, 14, 11, 13], [4, 5, 3, 6]] },
    visualType: "array",
    run,
    pseudocode: [
        "pool the observations and sort them by value",
        "assign ranks, averaging ranks across tied values",
        "sum the ranks within each group",
        "form H from the squared rank sums and group sizes",
        "divide H by the tie correction factor",
        "look up the upper tail of chi-square with k minus one degrees of freedom",
        "done: report H, the tie correction, p, and the verdict",
    ],
};

export default module;
