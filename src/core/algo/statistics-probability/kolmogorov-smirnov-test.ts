/**
 * kolmogorov-smirnov-test.ts - One-Sample Kolmogorov-Smirnov Goodness-of-Fit Test
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The one-sample KS test compares an empirical distribution function with a
 * hypothesized continuous distribution. The statistic D is the largest vertical
 * gap between the two curves. Under the null hypothesis the sample comes from
 * the reference distribution, and the asymptotic Kolmogorov distribution gives
 * the p-value. This module uses a uniform reference on an interval [a, b].
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for sorting plus O(k) for the p-value series
 *   Space: O(n) for the sorted sample and per-point gaps
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A four-row grid: sorted value, empirical CDF, reference CDF, gap.
 *   - The column attaining the maximum gap is highlighted in the final frame.
 *   - The final frame reports D, the p-value, and the verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Asymptotic Kolmogorov upper tail: P(D > d). */
function ksSurvival(d: number): number {
    if (d <= 0) return 1;
    if (d >= 1) return 0;
    let sum = 0;
    for (let k = 1; k <= 100; k += 1) {
        const term = Math.exp(-2 * k * k * d * d);
        sum += k % 2 === 1 ? term : -term;
        if (term < 1e-16) break;
    }
    return Math.min(1, Math.max(0, 2 * sum));
}

/** Reference CDF of the uniform distribution on [a, b]. */
function uniformCdf(x: number, a: number, b: number): number {
    if (b <= a) return x >= a ? 1 : 0;
    return Math.min(1, Math.max(0, (x - a) / (b - a)));
}

/** Critical value d such that the survival function equals alpha. */
function criticalValue(alpha: number): number {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 60; i += 1) {
        const mid = (lo + hi) / 2;
        if (ksSurvival(mid) > alpha) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

/** Build the four-row KS table. */
function makeCells(
    sorted: number[],
    empirical: number[],
    reference: number[],
    gaps: number[],
    current: number,
    dIndex: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const rows = [sorted, empirical, reference, gaps];
    for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < sorted.length; col += 1) {
            let state: EntityState = "idle";
            if (done && col === dIndex) state = "highlight";
            else if (done) state = "sorted";
            else if (col < current) state = "sorted";
            else if (col === current) state = "comparing";
            const labels = [
                `x ${(sorted[col] as number).toFixed(3)}`,
                empirical[col] === undefined ? "Fn -" : `Fn ${(empirical[col] as number).toFixed(3)}`,
                reference[col] === undefined ? "F -" : `F ${(reference[col] as number).toFixed(3)}`,
                gaps[col] === undefined ? "-" : (gaps[col] as number).toFixed(3),
            ];
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: labels[row] as string,
                value: (rows[row] as number[])[col] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

/** The one-sample KS generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { sample?: number[]; a?: number; b?: number; alpha?: number } | null) ?? {};
    const sample = Array.isArray(task.sample) && task.sample.length > 0
        ? task.sample.map(Number)
        : [0.11, 0.29, 0.33, 0.42, 0.55, 0.61, 0.78, 0.83, 0.91, 0.97, 0.12, 0.48];
    const a = typeof task.a === "number" ? task.a : 0;
    const b = typeof task.b === "number" && task.b > a ? task.b : 1;
    const alpha = typeof task.alpha === "number" ? Math.min(1, Math.max(0, task.alpha)) : 0.05;
    const n = sample.length;
    const sqrtN = Math.sqrt(n);
    const pFromD = (d: number): number => ksSurvival(sqrtN * d);
    const crit = criticalValue(alpha) / sqrtN;
    const sorted = [...sample].sort((x, y) => x - y);

    const empirical: number[] = [];
    const reference: number[] = [];
    const gaps: Array<number | undefined> = Array.from({ length: n }, () => undefined);
    let dPlus = 0;
    let dMinus = 0;
    let dIndex = 0;
    let runningD = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(sorted, empirical, reference, gaps as number[], -1, dIndex, false),
        edges: [],
        description: `One-sample KS test of ${n} observations against a uniform reference on [${a}, ${b}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 4, cols: n, n, D: 0, dPlus: 0, dMinus: 0, pValue: 1, alpha, critical: crit, significant: false, dIndex },
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        const x = sorted[i] as number;
        const fn = (i + 1) / n;
        const f = uniformCdf(x, a, b);
        empirical.push(fn);
        reference.push(f);
        const plus = fn - f;
        const minus = f - i / n;
        const gap = Math.max(Math.abs(plus), Math.abs(minus));
        gaps[i] = gap;
        if (plus > dPlus) dPlus = plus;
        if (minus > dMinus) dMinus = minus;
        const currentD = Math.max(dPlus, dMinus);
        if (currentD > runningD) {
            runningD = currentD;
            dIndex = i;
        }
        yield {
            stepNumber: step,
            entities: makeCells(sorted, empirical, reference, gaps as number[], i, dIndex, false),
            edges: [],
            description: `Point ${i}: x ${x.toFixed(3)}, empirical ${fn.toFixed(3)}, reference ${f.toFixed(3)}, gap ${gap.toFixed(3)}; running D ${runningD.toFixed(3)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 4,
                cols: n,
                n,
                D: runningD,
                dPlus,
                dMinus,
                pValue: pFromD(runningD),
                alpha,
                critical: crit,
                significant: pFromD(runningD) < alpha,
                dIndex,
            },
        };
        step += 1;
    }

    const D = Math.max(dPlus, dMinus);
    const pValue = pFromD(D);
    yield {
        stepNumber: step,
        entities: makeCells(sorted, empirical, reference, gaps as number[], n, dIndex, true),
        edges: [],
        description: `D = ${D.toFixed(4)} at point ${dIndex}; p-value ${pValue.toFixed(5)}${pValue < alpha ? ", reject the null" : ", fail to reject the null"}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 4, cols: n, n, D, dPlus, dMinus, pValue, alpha, critical: crit, significant: pValue < alpha, dIndex },
    };
}

/** The one-sample KS module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Sort the observations and draw the empirical CDF as a staircase that jumps by one over n at each data point. Compare it with the smooth reference CDF and find the single largest vertical gap. If that gap is larger than sampling noise would typically produce, the data do not look like a draw from the reference distribution.",
        invariants: [
            "The empirical CDF reaches one at the largest observation.",
            "D is the maximum of the one-sided gaps D plus and D minus.",
            "The p-value is nonincreasing as D grows.",
        ],
        correctness:
            "The Glivenko-Cantelli theorem makes the empirical CDF converge uniformly to the true CDF, so the supremum gap is a natural discrepancy measure. Kolmogorov proved that, for a continuous reference distribution and large n, the distribution of sqrt(n) times D converges to the Kolmogorov distribution whose tail is twice the alternating sum of exp(-2 k squared d squared). The p-value is that tail evaluated at sqrt(n) times the observed D.",
        complexityRationale:
            "Sorting the n observations costs O(n log n) and the single scan that forms the gaps costs O(n). The p-value series runs a fixed number of terms, so it is constant time, and the sorted sample plus table use O(n) space.",
        uses: [
            "Checking whether data follow a specified continuous distribution",
            "Comparing residual distributions in model diagnostics",
            "Detecting changes in a monitored data stream",
        ],
        references: [
            "Kolmogorov, Sulla Determinazione Empirica di una Legge di Distribuzione, 1933",
            "Smirnov, On the Distribution of the Empirical Distribution Function, 1939",
        ],
        workedExample:
            "For the twelve sorted observations 0.11 through 0.97 against a uniform reference, the largest gap occurs near the upper tail where the empirical curve runs ahead of the diagonal. That maximum gap is D, and comparing its Kolmogorov tail probability with 0.05 gives the verdict.",
    },
    id: "kolmogorov-smirnov-test",
    name: "Kolmogorov-Smirnov Test",
    category: "statistics-probability",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { sample: [0.11, 0.29, 0.33, 0.42, 0.55, 0.61, 0.78, 0.83, 0.91, 0.97, 0.12, 0.48], a: 0, b: 1, alpha: 0.05 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the sample and the reference interval",
        "sort the observations in ascending order",
        "for each observation form the empirical and reference CDF",
        "track the largest one-sided gaps D plus and D minus",
        "set D to the larger of the two gaps",
        "evaluate the Kolmogorov tail to get the p-value",
        "compare the p-value with the significance level",
        "done: report D, the p-value, and the verdict",
    ],
};

export default module;
