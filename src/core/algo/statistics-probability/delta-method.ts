/**
 * delta-method.ts - The Delta Method for Variance Propagation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The delta method approximates the variance of a transformed estimator. If a
 * sample mean has standard deviation sigma/sqrt(n), then g of that mean has
 * approximate standard deviation abs(g'(mu)) * sigma / sqrt(n). The module
 * evaluates the derivative of a chosen smooth transform at mu, propagates the
 * variance, and builds a normal-approximation confidence interval for g(mu).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for a closed-form derivative and interval
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show g(mu), g(xbar), the standard error, and the interval bounds.
 *   - The bar built in the current step is highlighted.
 *   - The final frame reports derivative, variance, and interval in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Transform = "square" | "log" | "exp" | "sqrt";

/** Evaluate the chosen transform. */
function g(transform: Transform, x: number): number {
    switch (transform) {
        case "square":
            return x * x;
        case "log":
            return Math.log(x);
        case "exp":
            return Math.exp(x);
        case "sqrt":
            return Math.sqrt(x);
    }
}

/** Evaluate the exact first derivative of the chosen transform. */
function gp(transform: Transform, x: number): number {
    switch (transform) {
        case "square":
            return 2 * x;
        case "log":
            return 1 / x;
        case "exp":
            return Math.exp(x);
        case "sqrt":
            return 1 / (2 * Math.sqrt(x));
    }
}

/** Build bars for the five reported quantities. */
function makeBars(values: number[], labels: string[], active: number, states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `stat-${index}`,
        type: "bar" as const,
        label: labels[index] ?? "",
        value,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** Propagate the variance of a mean through a smooth transform. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        mu?: number;
        sigma?: number;
        n?: number;
        xbar?: number;
        transform?: Transform;
        z?: number;
    } | null) ?? {};
    const transform: Transform = task.transform ?? "log";
    const mu = typeof task.mu === "number" ? task.mu : 4;
    const sigma = typeof task.sigma === "number" ? Math.max(0, task.sigma) : 2;
    const n = typeof task.n === "number" ? Math.max(1, Math.floor(task.n)) : 100;
    const xbar = typeof task.xbar === "number" ? task.xbar : 4.2;
    const z = typeof task.z === "number" ? task.z : 1.96;

    const derivative = gp(transform, mu);
    const variance = derivative * derivative * sigma * sigma / n;
    const se = Math.sqrt(variance);
    const gMu = g(transform, mu);
    const gBar = g(transform, xbar);
    const lower = gBar - z * se;
    const upper = gBar + z * se;

    const labels = ["g(mu)", "g(xbar)", "std error", "CI lower", "CI upper"];
    const values = [gMu, gBar, se, lower, upper];
    const statesFor = (active: number): EntityState[] =>
        values.map((_value, index) => (index === active ? "highlight" : index < active ? "sorted" : "idle"));

    let step = 0;
    const baseMeta = { transform, mu, sigma, n, xbar, z, derivative, variance, se, gMu, gBar };

    yield {
        stepNumber: step,
        entities: makeBars(values, labels, -1, statesFor(-1)),
        edges: [],
        description: `Applying the delta method to ${transform} at mu = ${mu} with n = ${n}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: baseMeta,
    };
    step += 1;

    const milestones: Array<{ code: number; text: string; extra: Record<string, number> }> = [
        { code: 2, text: `The derivative g'(mu) is ${derivative.toFixed(5)}.`, extra: { derivative } },
        { code: 3, text: `Propagated variance is ${variance.toFixed(6)}.`, extra: { variance } },
        { code: 4, text: `The standard error is ${se.toFixed(6)}.`, extra: { se } },
        { code: 5, text: `g(xbar) is ${gBar.toFixed(5)} with interval [${lower.toFixed(5)}, ${upper.toFixed(5)}].`, extra: { lower, upper } },
    ];
    for (let i = 0; i < milestones.length; i += 1) {
        const item = milestones[i];
        if (!item) {
            continue;
        }
        yield {
            stepNumber: step,
            entities: makeBars(values, labels, i, statesFor(i)),
            edges: [],
            description: item.text,
            codeLineNumber: item.code,
            layout: "array",
            meta: { ...baseMeta, ...item.extra },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(values, labels, 4, statesFor(4)),
        edges: [],
        description: `Approximate ${z}-interval for g(mu): [${lower.toFixed(5)}, ${upper.toFixed(5)}].`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...baseMeta, lower, upper },
    };
}

/** The delta-method module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "When you transform an estimate, its uncertainty changes with the slope of the transform. The delta method replaces the transform near the true mean by its tangent line, so the transformed estimator inherits the original variance multiplied by the squared slope. A steep slope inflates the uncertainty and a flat slope shrinks it.",
        invariants: [
            "The derivative is evaluated at the assumed mean mu, not at the observed xbar.",
            "The propagated variance equals the squared derivative times sigma squared over n.",
            "The interval is centered on g(xbar) with half-width z times the standard error.",
        ],
        correctness:
            "A first-order Taylor expansion gives g(Xbar) about g(mu) plus g'(mu)(Xbar - mu). Because Xbar is asymptotically normal with variance sigma squared over n, the linear term is normal with variance g'(mu) squared times sigma squared over n. Errors are second order in Xbar - mu and vanish as n grows, which justifies the normal interval.",
        complexityRationale:
            "For the square, log, exponential, and square-root transforms the derivative is closed form, so each step is constant time and no auxiliary storage is needed.",
        uses: [
            "Confidence intervals for transformed parameters such as log odds",
            "Error propagation in measurement and instrumentation",
            "Approximate standard errors for ratios and products in surveys",
        ],
        references: [
            "Casella and Berger, Statistical Inference, Section 5.5",
            "van der Vaart, Asymptotic Statistics, Chapter 3",
        ],
        workedExample:
            "With square as the transform, mu = 3, sigma = 2, and n = 16, the derivative is 6 and the propagated variance is 36 times 4 over 16, which is 9. The standard error is 3, so for xbar = 3.1 and z = 1.96 the interval is about 9.61 plus or minus 5.88.",
    },
    id: "delta-method",
    name: "Delta Method",
    category: "statistics-probability",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { mu: 4, sigma: 2, n: 100, xbar: 4.2, transform: "log", z: 1.96 },
    visualType: "array",
    run,
    pseudocode: [
        "read mean mu, standard deviation sigma, and sample size n",
        "choose a smooth transform g and critical value z",
        "compute the derivative g_prime at mu",
        "set variance to g_prime squared times sigma squared over n",
        "set standard error to the square root of variance",
        "build the interval g(xbar) plus or minus z times standard error",
        "done: report derivative, variance, and interval",
    ],
};

export default module;
