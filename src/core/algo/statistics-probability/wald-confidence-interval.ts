/**
 * wald-confidence-interval.ts - Wald Confidence Interval for a Proportion
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Wald interval estimates a population proportion from a sample count. It
 * centers the interval on the sample proportion p-hat and extends z standard
 * errors on each side, where the standard error is sqrt(p-hat(1-p-hat)/n) and
 * z is the normal quantile for the requested confidence level.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) apart from a fixed number of quantile iterations
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Three bars show the lower bound, the point estimate and the upper bound.
 *   - The point estimate is GREEN; the two bounds are BLUE (active).
 *   - The final frame reports p-hat, standard error, z and the interval.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Abramowitz and Stegun error-function approximation used by the CDF. */
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

function normalCdf(z: number): number {
    return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Inverse standard normal CDF by bisection on a fixed bracket. */
function inverseNormal(p: number): number {
    const clamped = Math.min(0.999999, Math.max(0.000001, p));
    let low = -12;
    let high = 12;
    for (let i = 0; i < 80; i += 1) {
        const mid = (low + high) / 2;
        if (normalCdf(mid) < clamped) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return (low + high) / 2;
}

function makeBars(
    lower: number,
    phat: number,
    upper: number,
    states: Map<string, EntityState>,
): VisualEntity[] {
    const specs: Array<[string, string, number]> = [
        ["lower", "lower", lower],
        ["phat", "p-hat", phat],
        ["upper", "upper", upper],
    ];
    return specs.map(([id, label, value]) => ({
        id: `bar-${id}`,
        type: "bar" as const,
        label,
        value,
        state: states.get(id) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { bound: id, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { successes?: number; trials?: number; confidence?: number } | null) ?? {};
    const successes = typeof task.successes === "number" ? task.successes : 45;
    const trials = typeof task.trials === "number" ? Math.max(1, task.trials) : 100;
    const confidence = typeof task.confidence === "number" ? task.confidence : 0.95;

    const phat = successes / trials;
    const se = Math.sqrt((phat * (1 - phat)) / trials);
    const z = inverseNormal((1 + confidence) / 2);
    const margin = z * se;
    const lower = phat - margin;
    const upper = phat + margin;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(lower, phat, upper, new Map()),
        edges: [],
        description: `Building a ${(confidence * 100).toFixed(1)} percent Wald interval from ${successes} successes in ${trials} trials.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { successes, trials, confidence, phat, se, z, lower, upper, margin },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(lower, phat, upper, new Map([["phat", "sorted"]])),
        edges: [],
        description: `Sample proportion p-hat = ${phat.toFixed(4)}; standard error = ${se.toFixed(6)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phat, se, z },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(lower, phat, upper, new Map([["lower", "active"], ["phat", "sorted"], ["upper", "active"]])),
        edges: [],
        description: `With z = ${z.toFixed(4)}, the margin is ${margin.toFixed(4)} and the interval is [${lower.toFixed(4)}, ${upper.toFixed(4)}].`,
        codeLineNumber: 3,
        layout: "array",
        meta: { successes, trials, confidence, phat, se, z, lower, upper, margin },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A sample proportion is a point guess for the true proportion. The Wald interval adds and subtracts a few standard errors to turn that point guess into a plausible range. The multiplier comes from the normal curve and grows as you demand more confidence.",
        invariants: [
            "The point estimate p-hat equals successes divided by trials.",
            "The standard error is sqrt(p-hat times one minus p-hat divided by n).",
            "The interval is symmetric about p-hat with half-width z times the standard error.",
        ],
        correctness:
            "For large n the central limit theorem makes the sampling distribution of p-hat approximately normal with mean p and standard deviation sqrt(p(1-p)/n). Replacing p by p-hat in the standard error and inverting the approximate normal test gives p-hat plus or minus z standard errors, which captures the true proportion with probability approximately equal to the chosen confidence level.",
        complexityRationale:
            "The bounds use a fixed number of arithmetic operations plus a constant-time bisection for the normal quantile, so time and space are both constant with respect to the data.",
        uses: [
            "Reporting poll margins of error",
            "Quick confidence bands for conversion rates",
            "A baseline interval that more accurate methods such as Wilson improve upon",
        ],
        references: [
            "Casella and Berger, Statistical Inference, Chapter 9",
            "Wald, On the Criteria by Which Small Samples May Be Judged, 1939",
        ],
        workedExample:
            "With 45 successes in 100 trials and 95 percent confidence, p-hat is 0.45, the standard error is sqrt(0.45 times 0.55 over 100) which is about 0.0497, z is about 1.96, and the interval is roughly 0.353 to 0.547.",
    },
    id: "wald-confidence-interval",
    name: "Wald Confidence Interval",
    category: "statistics-probability",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { successes: 45, trials: 100, confidence: 0.95 },
    visualType: "array",
    run,
    pseudocode: [
        "set p-hat to successes divided by trials",
        "set the standard error to sqrt(p-hat (1 - p-hat) / n)",
        "find z so the normal CDF covers the confidence level",
        "set the margin to z times the standard error",
        "report the interval p-hat minus margin to p-hat plus margin",
    ],
};

export default module;
