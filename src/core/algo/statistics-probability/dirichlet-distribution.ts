/**
 * dirichlet-distribution.ts - Dirichlet Distribution Sampling and Conjugate Update
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Dirichlet distribution is a distribution over probability vectors: it is
 * the multidimensional generalization of the Beta distribution and the
 * conjugate prior of the categorical and multinomial parameters. A draw is
 * produced by sampling K independent Gamma(shape alpha_i, scale 1) variates and
 * normalizing them to sum to one. The closed-form mean, variance and the
 * multinomial posterior update alpha + counts are computed alongside the draw.
 * A fixed-seed linear congruential generator makes every demo deterministic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(K) per draw, where K is the number of categories
 *   Space: O(K) for the parameter, sample and posterior vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per category shows alphas, raw gammas, the sample, or posterior.
 *   - The active category is yellow while its gamma variate is drawn.
 *   - The final frame is green and meta carries all analytic quantities.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic linear congruential generator. */
function lcg(seed: number): () => number {
    let state = (seed >>> 0) || 1;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

/** Standard normal variate by Box-Muller, driven by the supplied generator. */
function normal(rnd: () => number): number {
    const u = Math.max(1e-12, rnd());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

/** Marsaglia-Tsang Gamma(shape, 1) sampler with the shape-below-one boost. */
function gamma(shape: number, rnd: () => number): number {
    if (shape < 1) {
        const boosted = gamma(shape + 1, rnd);
        return boosted * Math.pow(Math.max(rnd(), 1e-12), 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
        let x = 0;
        let v = 0;
        do {
            x = normal(rnd);
            v = 1 + c * x;
        } while (v <= 0);
        v = v * v * v;
        const u = Math.max(1e-12, rnd());
        if (u < 1 - 0.0331 * x * x * x * x) {
            return d * v;
        }
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
            return d * v;
        }
    }
}

/** Build one bar per category for a given vector. */
function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `a${index}: ${value.toFixed(3)}`,
        value,
        state: (done ? "sorted" : index === active ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { alphas?: number[]; counts?: number[]; seed?: number } | null) ?? {};
    const raw = Array.isArray(task.alphas) ? task.alphas.map((a) => Number(a)) : [2, 3, 5];
    const alphas = raw.filter((a) => Number.isFinite(a) && a > 0).slice(0, 12);
    const safeAlphas = alphas.length >= 2 ? alphas : [2, 3, 5];
    const k = safeAlphas.length;
    const counts = Array.isArray(task.counts)
        ? safeAlphas.map((_, i) => Math.max(0, Math.floor(Number(task.counts?.[i] ?? 0)) || 0))
        : safeAlphas.map(() => 0);
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const alpha0 = safeAlphas.reduce((sum, a) => sum + a, 0);
    const mean = safeAlphas.map((a) => a / alpha0);
    const variance = safeAlphas.map((a) => (a * (alpha0 - a)) / (alpha0 * alpha0 * (alpha0 + 1)));
    const posterior = safeAlphas.map((a, i) => a + (counts[i] ?? 0));
    const rnd = lcg(seed);

    const meta = (phase: string, gammas: number[], sample: number[], sampleSum: number) => ({
        phase,
        k,
        alphas: safeAlphas,
        alpha0,
        seed,
        counts,
        posterior,
        mean,
        variance,
        gammas,
        sample,
        sampleSum,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(safeAlphas, -1, false),
        edges: [],
        description: `Dirichlet prior with ${k} categories: concentration vector (${safeAlphas.join(", ")}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta("setup", [], [], 0),
    };
    let step = 1;

    const gammas: number[] = [];
    for (let i = 0; i < k; i += 1) {
        const draw = gamma(safeAlphas[i] ?? 1, rnd);
        gammas.push(draw);
        yield {
            stepNumber: step,
            entities: makeBars([...gammas], i, false),
            edges: [],
            description: `Category ${i}: drew Gamma(alpha ${(safeAlphas[i] ?? 0).toFixed(2)}) = ${draw.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: meta("gamma", [...gammas], [], 0),
        };
        step += 1;
    }

    const total = gammas.reduce((sum, g) => sum + g, 0) || 1;
    const sample = gammas.map((g) => g / total);
    const sampleSum = sample.reduce((sum, p) => sum + p, 0);
    yield {
        stepNumber: step,
        entities: makeBars(sample, -1, true),
        edges: [],
        description: `Normalized the gammas: the sample sums to ${sampleSum.toFixed(4)} and lies on the simplex.`,
        codeLineNumber: 3,
        layout: "array",
        meta: meta("sample", [...gammas], sample, sampleSum),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(mean, -1, true),
        edges: [],
        description: `Analytic mean alpha_i / alpha_0 computed from alpha_0 = ${alpha0.toFixed(3)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: meta("moments", [...gammas], sample, sampleSum),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(posterior, -1, true),
        edges: [],
        description: `Multinomial observations (${counts.join(", ")}) update the prior to (${posterior.join(", ")}).`,
        codeLineNumber: 5,
        layout: "array",
        meta: meta("posterior", [...gammas], sample, sampleSum),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Dirichlet draw is a list of nonnegative numbers that add to one, so it can stand for the probabilities of several categories. To sample one, draw an independent Gamma variable for each category using its concentration parameter, then divide every draw by their total. The same concentration vector is also a prior: after counting outcomes, adding the counts to the parameters gives the posterior.",
        invariants: [
            "Every sampled component is nonnegative and the components sum to one.",
            "The mean of category i is alpha_i divided by the total concentration.",
            "The posterior parameters equal the prior parameters plus the observed category counts.",
        ],
        correctness:
            "Independent Gamma(alpha_i, 1) variables divided by their sum follow the Dirichlet(alpha) distribution by the standard gamma-normalization construction, which is why the law of the sample has the Dirichlet density on the simplex. The mean and variance formulas follow from the moments of the gamma ratio. Conjugacy holds because the Dirichlet density is proportional to the product of p_i to the (alpha_i minus one), and multiplying by a multinomial likelihood adds the counts to the exponents, leaving the same functional form.",
        complexityRationale:
            "Sampling draws one Gamma variate per category and a normalizes them, so a draw takes O(K) time and the parameter, sample and posterior vectors use O(K) space.",
        uses: [
            "Topic-model mixture weights in latent Dirichlet allocation",
            "Bayesian estimates of categorical and multinomial probabilities",
            "Random probability vectors for simulation and Bayesian nonparametrics",
        ],
        references: [
            "Johnson, Kotz and Balakrishnan, Continuous Multivariate Distributions, Volume 1",
            "Marsaglia and Tsang, A Simple Method for Generating Gamma Variables, 2000",
        ],
        workedExample:
            "With concentrations (2, 3, 5) the total is 10, so the prior means are (0.2, 0.3, 0.5). Drawing gammas of roughly 1.6, 2.9 and 5.5 and dividing by their total near 10 gives a sample near (0.16, 0.29, 0.55). Observing counts (1, 2, 1) updates the parameters to (3, 5, 6).",
    },
    id: "dirichlet-distribution",
    name: "Dirichlet Distribution",
    category: "statistics-probability",
    complexity: { time: "O(K)", space: "O(K)" },
    defaultInput: { alphas: [2, 3, 5], counts: [1, 2, 1], seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "read the concentration vector alpha and the observed counts",
        "initialize a seeded random generator",
        "for each category draw a Gamma(alpha_i, 1) variate",
        "divide each draw by the total to obtain a sample on the simplex",
        "compute the closed-form mean and variance",
        "add the counts to alpha for the conjugate posterior",
        "done: report the sample, moments, and posterior",
    ],
};

export default module;
