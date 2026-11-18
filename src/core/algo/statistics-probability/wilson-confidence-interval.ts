/**
 * wilson-confidence-interval.ts - Wilson Score Confidence Interval
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Wilson score interval estimates a binomial proportion from x successes
 * in n trials. It inverts the normal-approximation score test instead of
 * plugging the sample proportion into a symmetric interval, so it stays inside
 * [0, 1] and behaves well for small samples or proportions near the boundaries.
 * The interval is centered on a shrunk estimate and its half-width is derived
 * from the score statistic, with the critical value obtained from the standard
 * normal quantile for the requested confidence level.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log(1/tol)) for the normal quantile bisection (constant in n)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Three bars show the lower bound, the raw estimate, and the upper bound.
 *   - The estimate bar is CYAN (active); the endpoints are GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Abramowitz and Stegun 7.1.26 approximation to erf. */
function erf(x: number): number {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const poly =
        ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
            0.254829592) *
        t;
    return sign * (1 - poly * Math.exp(-ax * ax));
}

/** Standard normal cumulative distribution function. */
function normalCdf(x: number): number {
    return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** Standard normal quantile by bisection on the CDF. */
function normalQuantile(probability: number): number {
    let low = 0;
    let high = 10;
    for (let i = 0; i < 80; i += 1) {
        const mid = (low + high) / 2;
        if (normalCdf(mid) < probability) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return (low + high) / 2;
}

/** Build the three bars for the current interval view. */
function makeBars(lower: number, estimate: number, upper: number, phase: number): VisualEntity[] {
    const values = [lower, estimate, upper];
    const labels = ["lower", "estimate", "upper"];
    return values.map((value, index) => {
        const state =
            phase >= 4 ? ("sorted" as EntityState) : index === 1 ? ("active" as EntityState) : ("idle" as EntityState);
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${labels[index]}: ${value.toFixed(3)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { successes?: number; trials?: number; confidence?: number } | null) ?? {};
    const n = typeof task.trials === "number" ? Math.max(1, Math.floor(task.trials)) : 100;
    const xRaw = typeof task.successes === "number" ? Math.floor(task.successes) : 45;
    const x = Math.max(0, Math.min(n, xRaw));
    const confidence =
        typeof task.confidence === "number" ? Math.max(0.5, Math.min(0.999999, task.confidence)) : 0.95;

    const phat = x / n;
    const z = normalQuantile(1 - (1 - confidence) / 2);

    const frame = (
        step: number,
        phase: number,
        description: string,
        codeLine: number,
        extra: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(0, phat, 0, phase),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "array",
        meta: { successes: x, trials: n, confidence, phat, z, ...extra },
    });

    yield frame(0, 0, `Observed ${x} successes in ${n} trials; sample proportion ${phat.toFixed(3)}.`, 0);

    const z2 = z * z;
    const denominator = 1 + z2 / n;
    const center = (phat + z2 / (2 * n)) / denominator;
    yield frame(1, 1, `Critical value z=${z.toFixed(4)} for ${(confidence * 100).toFixed(1)} percent confidence.`, 1, { z });

    yield frame(2, 2, `Shrunk center ${center.toFixed(4)} pulls the estimate toward one half.`, 2, { center });

    const margin =
        (z / denominator) * Math.sqrt((phat * (1 - phat)) / n + z2 / (4 * n * n));
    const lower = Math.max(0, center - margin);
    const upper = Math.min(1, center + margin);
    yield frame(3, 3, `Score margin ${margin.toFixed(4)} from the variance term and its correction.`, 3, {
        center,
        margin,
    });

    yield {
        stepNumber: 4,
        entities: makeBars(lower, phat, upper, 4),
        edges: [],
        description: `Wilson interval [${lower.toFixed(4)}, ${upper.toFixed(4)}] contains the sample proportion ${phat.toFixed(3)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { successes: x, trials: n, confidence, phat, z, center, margin, lower, upper },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain normal interval can run past zero or one when the sample is small or the proportion is extreme. Wilson's construction instead asks which true proportions would not be rejected by a score test at the observed data. Solving that inequality gives an asymmetric interval that always stays inside the valid range and covers the truth more reliably.",
        invariants: [
            "The interval always lies within zero and one.",
            "The center is the sample proportion shrunk toward one half.",
            "The score statistic equals the critical value at each endpoint.",
        ],
        correctness:
            "The Wilson endpoints are the two roots of the equation absolute value of (phat minus p) equals z times the square root of p times one minus p over n. Those roots solve a quadratic in p and give the bounds returned here. Because the interval is the inversion of a size-alpha score test, the probability under any true p that it covers p is at least one minus alpha up to the normal approximation, which is why coverage is better than the Wald interval.",
        complexityRationale:
            "The bound is a fixed number of arithmetic operations once the normal quantile is known. The quantile is found by bisection on a smooth monotone CDF with a fixed iteration count, so both time and space are constant in the sample size.",
        uses: [
            "Reporting poll and survey margins of error",
            "Conversion-rate confidence bounds in online experiments",
            "Binomial proportion intervals in clinical trial summaries",
        ],
        references: [
            "Wilson, Probable Inference, the Law of Succession, and Statistical Inference, 1927",
            "Agresti and Coull, Approximate is Better than Exact for Interval Estimation of Binomial Proportions, 1998",
        ],
        workedExample:
            "With 45 successes in 100 trials the sample proportion is 0.45 and the 95 percent critical value is about 1.96. The shrunk center is about 0.458 and the margin about 0.097, giving an interval near 0.361 to 0.555. Every point inside that range would not be rejected by the score test at the five percent level.",
    },
    id: "wilson-confidence-interval",
    name: "Wilson Score Confidence Interval",
    category: "statistics-probability",
    complexity: { time: "O(log 1/tol)", space: "O(1)" },
    defaultInput: { successes: 45, trials: 100, confidence: 0.95 },
    visualType: "array",
    run,
    pseudocode: [
        "compute the sample proportion from successes over trials",
        "find the normal critical value for the confidence level",
        "shrink the proportion toward one half using the squared critical value",
        "form the score margin with the variance and its small-sample correction",
        "subtract and add the margin, then clamp to zero and one",
        "done: report the lower bound, center, and upper bound",
    ],
};

export default module;
