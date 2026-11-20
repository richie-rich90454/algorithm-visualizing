/**
 * students-t-test.ts - One-Sample Student t-Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The one-sample t-test asks whether a sample mean differs from a hypothesized
 * population mean. It forms t = (mean - mu0) divided by the standard error
 * s over the square root of n, where s is the sample standard deviation with
 * n minus one degrees of freedom. The two-sided p value comes from the t
 * density through the regularized incomplete beta function.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for the sums plus O(1) for the special function
 *   Space: O(n) for the displayed sample bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per observation shows its value.
 *   - The current observation is highlighted while sums accumulate.
 *   - The final frame reports the statistic, degrees of freedom, and p value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TTestInput {
    sample?: number[];
    mu0?: number;
}

const LANCZOS = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
];

/** Log gamma by the Lanczos approximation. */
function logGamma(z: number): number {
    if (z < 0.5) {
        return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    }
    const shifted = z - 1;
    let x = LANCZOS[0]!;
    for (let i = 1; i < LANCZOS.length; i += 1) {
        x += LANCZOS[i]! / (shifted + i);
    }
    const t = shifted + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Continued fraction for the incomplete beta function. */
function betaContinuedFraction(a: number, b: number, x: number): number {
    const maxIterations = 300;
    const eps = 3e-14;
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
        logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
    );
    if (x < (a + 1) / (a + b + 2)) {
        return (front * betaContinuedFraction(a, b, x)) / a;
    }
    return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Two-sided p value for a t statistic with df degrees of freedom. */
function twoSidedPValue(t: number, df: number): number {
    if (df <= 0) {
        return 1;
    }
    return regularizedBeta(df / 2, 0.5, df / (df + t * t));
}

/** Build sample bars, highlighting the observation being accumulated. */
function makeBars(sample: number[], current: number, done: boolean): VisualEntity[] {
    return sample.map((value, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        } else if (index < current) {
            state = "visited";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, observation: value },
        };
    });
}

/** The one-sample t-test generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TTestInput | null) ?? {};
    const sample: number[] = Array.isArray(task.sample) ? [...task.sample] : [9, 10, 11, 12, 13];
    const mu0 = typeof task.mu0 === "number" ? task.mu0 : 10;
    const n = sample.length;
    let sum = 0;
    let sumSquares = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(sample, -1, false),
        edges: [],
        description: `One-sample t-test of ${n} observation(s) against mu0 = ${mu0}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, mu0, mean: 0, sampleStd: 0, standardError: 0, t: 0, df: n - 1, pValue: 1 },
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        const value = sample[i] ?? 0;
        sum += value;
        sumSquares += value * value;
        const runningMean = sum / (i + 1);
        yield {
            stepNumber: step,
            entities: makeBars(sample, i, false),
            edges: [],
            description: `Observation ${i}: value ${value}, running sum ${sum}, running sum of squares ${sumSquares}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { n, mu0, mean: runningMean, sampleStd: 0, standardError: 0, t: 0, df: n - 1, pValue: 1 },
        };
        step += 1;
    }

    const mean = n === 0 ? 0 : sum / n;
    const variance = n > 1 ? (sumSquares - (sum * sum) / n) / (n - 1) : 0;
    const sampleStd = Math.sqrt(Math.max(0, variance));
    const standardError = n > 0 ? sampleStd / Math.sqrt(n) : 0;
    const t = standardError === 0 ? 0 : (mean - mu0) / standardError;
    const df = n - 1;
    const pValue = twoSidedPValue(t, df);

    yield {
        stepNumber: step,
        entities: makeBars(sample, -1, true),
        edges: [],
        description: `mean ${mean.toFixed(4)}, s ${sampleStd.toFixed(4)}, t(${df}) = ${t.toFixed(4)}, two-sided p = ${pValue.toFixed(6)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, mu0, mean, sampleStd, standardError, t, df, pValue },
    };
}

/** The Student t-test module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A t-test compares the gap between the sample mean and a claimed mean against the natural noise in the sample. The noise is the standard error, which shrinks as the sample grows. A large t means the observed gap is big relative to that noise, and the p value converts t into the chance of seeing such a gap if the claim were true.",
        invariants: [
            "The sample standard deviation uses n minus one degrees of freedom.",
            "The standard error equals the sample standard deviation divided by the square root of n.",
            "The two-sided p value lies between zero and one and equals one when t is zero.",
        ],
        correctness:
            "The sums give the exact sample mean and the unbiased sample variance, so t follows a Student t distribution with n minus one degrees of freedom when the data are normal and the null hypothesis holds. The two-sided tail area of that density is the regularized incomplete beta value I with argument df over df plus t squared, shape df over two and one half. Evaluating that special function therefore yields the correct p value.",
        complexityRationale:
            "One pass accumulates the sum and sum of squares in O(n) time, and the beta continued fraction converges in a bounded number of iterations, so the whole computation is O(n) time and O(n) space for the displayed bars.",
        uses: [
            "Testing whether a new process changes the average outcome",
            "Comparing a sample mean against a known historical baseline",
            "Reporting confidence in small-sample experiments",
        ],
        references: [
            "Student, The Probable Error of a Mean, 1908",
            "Press et al., Numerical Recipes, Section on Beta and Incomplete Beta",
        ],
        workedExample:
            "For observations 9, 10, 11, 12, 13 the mean is 11 and the sample standard deviation is about 1.581. Against mu0 of 10 the standard error is about 0.707, giving t near 1.414 with four degrees of freedom and a two-sided p value near 0.23, so the difference is not strong evidence against the claim.",
    },
    id: "students-t-test",
    name: "Student's t-Test",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { sample: [9, 10, 11, 12, 13], mu0: 10 },
    visualType: "array",
    run,
    pseudocode: [
        "read the sample and the hypothesized population mean mu0",
        "for each observation add its value and its square to running sums",
        "compute the sample mean from the running sum",
        "form the unbiased sample variance with n minus one degrees of freedom",
        "divide the sample standard deviation by the square root of n for the standard error",
        "set t to the mean minus mu0 divided by the standard error",
        "evaluate the two-sided p value from the incomplete beta function",
        "done: report t, degrees of freedom, and p value",
    ],
};

export default module;
