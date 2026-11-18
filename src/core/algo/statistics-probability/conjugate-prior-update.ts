/**
 * conjugate-prior-update.ts - Beta-Binomial Conjugate Prior Update
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In Bayesian inference a Beta prior on a success probability is conjugate to
 * binomial data: after observing successes and failures the posterior is again
 * Beta, with parameters obtained by simple addition. This module starts from a
 * Beta(alpha, beta) prior and folds in a sequence of Bernoulli observations one
 * at a time, showing how the posterior curve shifts as evidence accumulates.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * g) for m observations and a posterior grid of g points
 *   Space: O(g) for the displayed density curves
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid value of p shows the current Beta density.
 *   - The current observation is described in the caption.
 *   - meta carries both curves, the parameters, and the predictive probability.
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

/** Beta density at a point p. */
function betaPdf(p: number, a: number, b: number): number {
    const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
    return Math.exp((a - 1) * Math.log(p) + (b - 1) * Math.log(1 - p) - logBeta);
}

/** Build the posterior density bars. */
function makeBars(grid: number[], density: number[], phase: string): VisualEntity[] {
    let peak = 0;
    for (let i = 1; i < grid.length; i += 1) {
        if ((density[i] ?? 0) > (density[peak] ?? 0)) {
            peak = i;
        }
    }
    return grid.map((p, index) => {
        let state: EntityState = "idle";
        if (phase === "done" && index === peak) {
            state = "sorted";
        } else if (phase !== "setup" && index === peak) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `p=${p.toFixed(2)}:${(density[index] ?? 0).toFixed(2)}`,
            value: density[index] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, p, density: density[index] ?? 0 },
        };
    });
}

/** The Beta-Binomial conjugate update generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { alpha?: number; beta?: number; observations?: number[]; samples?: number } | null) ?? {};
    const priorAlpha = Math.max(1, Math.floor(Number(task.alpha ?? 2)) || 2);
    const priorBeta = Math.max(1, Math.floor(Number(task.beta ?? 2)) || 2);
    const observations = Array.isArray(task.observations)
        ? task.observations.map((value) => (Number(value) >= 0.5 ? 1 : 0))
        : [1, 1, 0, 1, 0, 0, 1];
    const samples = Math.min(81, Math.max(9, Math.floor(Number(task.samples ?? 41)) || 41));

    const grid: number[] = [];
    for (let i = 0; i < samples; i += 1) {
        grid.push(0.01 + (0.98 * i) / (samples - 1));
    }
    const priorPdf = grid.map((p) => betaPdf(p, priorAlpha, priorBeta));

    let successes = 0;
    let failures = 0;
    let alpha = priorAlpha;
    let beta = priorBeta;
    let posteriorPdf = priorPdf;

    const buildMeta = (phase: string) => ({
        phase,
        priorAlpha,
        priorBeta,
        successes,
        failures,
        posteriorAlpha: alpha,
        posteriorBeta: beta,
        posteriorMean: alpha / (alpha + beta),
        map: alpha > 1 && beta > 1 ? (alpha - 1) / (alpha + beta - 2) : alpha / (alpha + beta),
        predictive: alpha / (alpha + beta),
        grid: [...grid],
        priorPdf: [...priorPdf],
        posteriorPdf: [...posteriorPdf],
        observations: [...observations],
    });

    yield {
        stepNumber: 0,
        entities: makeBars(grid, priorPdf, "setup"),
        edges: [],
        description: `Start with a Beta(${priorAlpha}, ${priorBeta}) prior and ${observations.length} Bernoulli observation(s) to fold in.`,
        codeLineNumber: 0,
        layout: "array",
        meta: buildMeta("setup"),
    };
    let step = 1;

    for (let i = 0; i < observations.length; i += 1) {
        const observation = observations[i] ?? 0;
        if (observation === 1) {
            alpha += 1;
            successes += 1;
        } else {
            beta += 1;
            failures += 1;
        }
        posteriorPdf = grid.map((p) => betaPdf(p, alpha, beta));
        yield {
            stepNumber: step,
            entities: makeBars(grid, posteriorPdf, "update"),
            edges: [],
            description: `Observation ${i + 1} was ${observation === 1 ? "a success" : "a failure"}; the posterior is now Beta(${alpha}, ${beta}).`,
            codeLineNumber: 2,
            layout: "array",
            meta: buildMeta("update"),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(grid, posteriorPdf, "done"),
        edges: [],
        description: `After ${successes} success(es) and ${failures} failure(s), the posterior is Beta(${alpha}, ${beta}) with mean ${(alpha / (alpha + beta)).toFixed(4)} and predictive success probability ${(alpha / (alpha + beta)).toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: buildMeta("done"),
    };
}

/** The conjugate prior module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A conjugate prior is chosen so that updating beliefs keeps the same family of curves. For a success probability, the Beta curve is that convenient family: count the prior as imaginary successes and failures, then add the real ones you observe. The posterior curve simply gets more peaked as the evidence grows.",
        invariants: [
            "The posterior parameters equal the prior parameters plus the observed counts.",
            "Successes increase alpha and failures increase beta, one at a time.",
            "The posterior remains a valid Beta distribution at every step.",
        ],
        correctness:
            "The Bernoulli likelihood for s successes and f failures is p to the s times (1 minus p) to the f. Multiplying by a Beta(alpha, beta) density proportional to p to the alpha minus one times (1 minus p) to the beta minus one gives a kernel proportional to p to the alpha plus s minus one times (1 minus p) to the beta plus f minus one, which is exactly Beta(alpha plus s, beta plus f). Because the family is preserved and each observation is applied by adding one to the matching parameter, the final posterior is correct by induction over the observations.",
        complexityRationale:
            "Each observation recomputes the density over g grid points, taking O(g) work, so m observations cost O(m times g). Storing the grid and both curves uses O(g) space.",
        uses: [
            "Sequential updating of conversion or click probabilities",
            "Thompson sampling in multi-armed bandits",
            "A first example of conjugate Bayesian inference",
        ],
        references: [
            "Beta, Verhandelingen van het Bataviaasch Genootschap, 1832",
            "Gelman et al., Bayesian Data Analysis, Chapter 2",
        ],
        workedExample:
            "Start from Beta(2, 2), a symmetric prior around 0.5. Observing the sequence success, success, failure, success, failure, failure, success adds four to alpha and three to beta, giving Beta(6, 5). Its posterior mean is 6 over 11, about 0.545, and the predictive probability of another success is the same 0.545.",
    },
    id: "conjugate-prior-update",
    name: "Conjugate Prior Update",
    category: "statistics-probability",
    complexity: { time: "O(m * g)", space: "O(g)" },
    defaultInput: { alpha: 2, beta: 2, observations: [1, 1, 0, 1, 0, 0, 1], samples: 41 },
    visualType: "array",
    run,
    pseudocode: [
        "start with prior Beta parameters alpha and beta",
        "tabulate the prior density on a grid of probabilities",
        "for each observed Bernoulli outcome",
        "add one to alpha for success or one to beta for failure",
        "recompute the posterior Beta density on the grid",
        "compute the posterior mean and predictive probability",
        "done: report the final posterior parameters",
    ],
};

export default module;
