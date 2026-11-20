/**
 * grubbs-test.ts - Grubbs Outlier Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Grubbs' test looks for a single outlier in an approximately normal sample.
 * It measures the largest deviation from the mean in units of the sample
 * standard deviation and compares that ratio with an exact critical value
 * built from the t distribution at the two-sided significance level.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + I) for n values and I iterations of the quantile search
 *   Space: O(n) for the displayed bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each sample value is drawn as a bar.
 *   - The bar currently being measured is highlighted.
 *   - The final frame marks the suspected outlier red when the test rejects,
 *     and green otherwise.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const LANCZOS = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
];

/** Logarithm of the gamma function via the Lanczos approximation. */
function logGamma(z: number): number {
    if (z < 0.5) {
        return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    }
    const shifted = z - 1;
    let x = LANCZOS[0] ?? 1;
    for (let i = 1; i < 9; i += 1) {
        x += (LANCZOS[i] ?? 0) / (shifted + i);
    }
    const t = shifted + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Continued fraction for the incomplete beta function (Lentz's method). */
function betaContinuedFraction(a: number, b: number, x: number): number {
    const maxIterations = 300;
    const eps = 1e-14;
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
        let term = (m * (b - m) * x) / ((qam + m2) * (a + m2));
        d = 1 + term * d;
        if (Math.abs(d) < tiny) {
            d = tiny;
        }
        c = 1 + term / c;
        if (Math.abs(c) < tiny) {
            c = tiny;
        }
        d = 1 / d;
        h *= d * c;
        term = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + term * d;
        if (Math.abs(d) < tiny) {
            d = tiny;
        }
        c = 1 + term / c;
        if (Math.abs(c) < tiny) {
            c = tiny;
        }
        d = 1 / d;
        const delta = d * c;
        h *= delta;
        if (Math.abs(delta - 1) < eps) {
            break;
        }
    }
    return h;
}

/** Regularized incomplete beta function I_x(a, b). */
function regularizedBeta(a: number, b: number, x: number): number {
    if (x <= 0) {
        return 0;
    }
    if (x >= 1) {
        return 1;
    }
    const front = Math.exp(
        logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x),
    );
    return x < (a + 1) / (a + b + 2)
        ? (front * betaContinuedFraction(a, b, x)) / a
        : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Cumulative distribution function of Student's t with the given degrees of freedom. */
function studentTCdf(t: number, df: number): number {
    const tail = 0.5 * regularizedBeta(df / 2, 0.5, df / (df + t * t));
    return t > 0 ? 1 - tail : tail;
}

/** Invert the t CDF by bisection; p must lie strictly between zero and one. */
function inverseStudentT(p: number, df: number): number {
    let lo = -100;
    let hi = 100;
    for (let i = 0; i < 120; i += 1) {
        const mid = (lo + hi) / 2;
        if (studentTCdf(mid, df) < p) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return (lo + hi) / 2;
}

function makeBars(values: number[], active: number, done: boolean, outlier: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: done
            ? (outlier === index ? "error" : "sorted")
            : (index === active ? "comparing" : "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; alpha?: number } | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map((v) => Number(v) || 0)
        : [10, 11, 10, 12, 11, 48];
    const alpha = typeof task.alpha === "number" && task.alpha > 0 && task.alpha < 1 ? task.alpha : 0.05;
    const n = values.length;
    const mean = values.reduce((total, v) => total + v, 0) / n;
    let sumSquares = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values, -1, false, -1),
        edges: [],
        description: `Scanning ${n} value(s) for a single outlier at significance ${alpha.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, alpha, mean },
    };
    step += 1;

    let maxDeviation = 0;
    let outlier = 0;
    for (let i = 0; i < n; i += 1) {
        const deviation = Math.abs((values[i] ?? 0) - mean);
        if (deviation > maxDeviation) {
            maxDeviation = deviation;
            outlier = i;
        }
        sumSquares += deviation * deviation;
        yield {
            stepNumber: step,
            entities: makeBars(values, i, false, -1),
            edges: [],
            description: `Value ${values[i]?.toFixed(3)} deviates from the mean by ${deviation.toFixed(4)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { n, alpha, mean, current: i, maxDeviation },
        };
        step += 1;
    }

    const sd = n >= 2 ? Math.sqrt(sumSquares / (n - 1)) : 0;
    const statistic = sd > 0 ? maxDeviation / sd : 0;
    let critical = 0;
    let reject = false;
    if (n >= 3 && sd > 0) {
        const tQuantile = inverseStudentT(1 - alpha / (2 * n), n - 2);
        critical = ((n - 1) / Math.sqrt(n)) * Math.sqrt((tQuantile * tQuantile) / (n - 2 + tQuantile * tQuantile));
        reject = statistic > critical;
    }
    yield {
        stepNumber: step,
        entities: makeBars(values, -1, true, reject ? outlier : -1),
        edges: [],
        description: n >= 3
            ? `Grubbs statistic ${statistic.toFixed(4)} versus critical ${critical.toFixed(4)}; ${reject ? "outlier detected" : "no outlier detected"}.`
            : `Grubbs statistic ${statistic.toFixed(4)}; at least three values are needed for a critical value.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            n,
            alpha,
            mean,
            sd,
            statistic,
            critical,
            outlierIndex: reject ? outlier : -1,
            reject,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single extreme observation can distort the mean and standard deviation, so Grubbs' test measures how far the farthest point sits from the mean in standard-deviation units. If that distance is larger than a cutoff derived from the t distribution for the sample size and significance level, the point is flagged as an outlier.",
        invariants: [
            "The largest absolute deviation identifies the only candidate the test can reject.",
            "The standard deviation is computed with n minus one degrees of freedom.",
            "The cutoff depends on the significance level and the sample size through a t quantile.",
        ],
        correctness:
            "The statistic is the normalized maximum deviation. Under the null hypothesis of a single normal population, the exact distribution of that maximum gives the cutoff ((n-1)/sqrt(n)) times sqrt(t squared over n-2+t squared), where t is the two-sided quantile at alpha over 2n with n minus two degrees of freedom. Computing that quantile by inverting the t CDF through the regularized incomplete beta function reproduces the published Grubbs critical values.",
        complexityRationale:
            "Accumulating the mean and the squared deviations takes one pass, so the data work is O(n). The quantile search uses a fixed number of bisection steps and continued-fraction evaluations, adding only a constant; the bars use O(n) space.",
        uses: [
            "Screening laboratory measurements for a single bad reading",
            "Quality control when one defective item may skew a batch",
            "Preprocessing data before fitting a mean-based model",
        ],
        references: [
            "Grubbs, Procedures for Detecting Outlying Observations, 1969",
            "National Institute of Standards and Technology, Engineering Statistics Handbook, Section 1.3.5",
        ],
        workedExample:
            "For 10, 11, 10, 12, 11, 48 the mean is 17 and the farthest value, 48, is 31 away. The sample standard deviation is about 15.2, so the statistic is about 2.04. With six points at the five percent level the exact cutoff is about 1.89, so 48 is flagged as an outlier.",
    },
    id: "grubbs-test",
    name: "Grubbs Test",
    category: "statistics-probability",
    complexity: { time: "O(n + I)", space: "O(n)" },
    defaultInput: { values: [10, 11, 10, 12, 11, 48], alpha: 0.05 },
    visualType: "array",
    run,
    pseudocode: [
        "read n values and the significance level alpha",
        "compute the sample mean and the sum of squared deviations",
        "track the largest absolute deviation and its index",
        "set the statistic to that deviation over the sample standard deviation",
        "find the t quantile at alpha over 2n with n-2 degrees of freedom",
        "set the cutoff to (n-1)/sqrt(n) times sqrt(t squared over n-2+t squared)",
        "flag an outlier when the statistic exceeds the cutoff",
    ],
};

export default module;
