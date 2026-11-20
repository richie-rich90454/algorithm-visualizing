/**
 * effective-sample-size.ts - Effective Sample Size from Autocorrelation
 *
 * Correlated MCMC draws carry less information than independent ones. The
 * effective sample size converts a chain of n draws into the number of
 * independent draws it is worth, using the integrated autocorrelation time.
 * This module computes the autocorrelation function, applies the initial
 * positive sequence rule, and shows how the effective size is derived.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ESSInput {
    series?: number[];
}

/** Standard autocorrelation estimates for lags one through n-1. */
function autocorrelations(series: number[]): number[] {
    const n = series.length;
    const mean = series.reduce((a, b) => a + b, 0) / Math.max(1, n);
    const deviations = series.map((x) => x - mean);
    const denom = deviations.reduce((sum, d) => sum + d * d, 0);
    if (denom <= 0) return new Array<number>(Math.max(0, n - 1)).fill(0);
    const rhos: number[] = [];
    for (let lag = 1; lag < n; lag += 1) {
        let sum = 0;
        for (let t = 0; t + lag < n; t += 1) sum += deviations[t]! * deviations[t + lag]!;
        rhos.push(sum / denom);
    }
    return rhos;
}

/** Geyer initial positive sequence: pair lags and truncate at negativity. */
function initialPositive(rhos: number[]): number[] {
    const used: number[] = [];
    for (let i = 0; i + 1 < rhos.length; i += 2) {
        const pair = (rhos[i] ?? 0) + (rhos[i + 1] ?? 0);
        if (pair <= 0) break;
        used.push((rhos[i] ?? 0) + (rhos[i + 1] ?? 0));
    }
    return used;
}

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (done) state = value > 0 ? "sorted" : "visited";
        else if (index === active) state = "comparing";
        else if (index < active) state = "visited";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { lag: index + 1, autocorrelation: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ESSInput | null) ?? {};
    const raw = Array.isArray(task.series) ? task.series.map(Number).filter(Number.isFinite) : [];
    const series = raw.length >= 4 ? raw.slice(0, 2000) : Array.from({ length: 120 }, (_, t) =>
        Math.sin((2 * Math.PI * t) / 17) + 0.35 * Math.sin((2 * Math.PI * t) / 5));
    const n = series.length;
    const rhos = autocorrelations(series);
    const pairs = initialPositive(rhos);
    const tau = 1 + 2 * pairs.reduce((a, b) => a + b, 0);
    const ess = Math.min(n, Math.max(1, n / Math.max(tau, 1 / n)));

    yield {
        stepNumber: 0,
        entities: makeBars(rhos.map(() => 0), -1, false),
        edges: [],
        description: `Effective sample size of a ${n}-draw chain: estimate autocorrelation at each lag first.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, ess: 0, tau: 0, rhos: rhos.map(() => 0), pairs: [] },
    };

    // Batch long chains so the precomputed frame buffer stays small.
    const batch = Math.max(1, Math.ceil(rhos.length / 40));
    let step = 1;
    for (let lag = 0; lag < rhos.length; lag += batch) {
        const upto = Math.min(rhos.length, lag + batch);
        yield {
            stepNumber: step,
            entities: makeBars(rhos, lag, false),
            edges: [],
            description: `Lag ${lag + 1} autocorrelation is ${(rhos[lag] ?? 0).toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                n,
                ess: 0,
                tau: 0,
                rhos: rhos.slice(0, upto),
                pairs: [],
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(rhos, -1, true),
        edges: [],
        description: `Initial positive sequence sums to ${pairs.reduce((a, b) => a + b, 0).toFixed(4)}, giving tau = ${tau.toFixed(4)} and effective sample size ${ess.toFixed(2)} of ${n}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, ess, tau, rhos: [...rhos], pairs, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two hundred correlated simulation draws may contain as much information as twenty independent ones. The autocorrelation at lag k measures how much a draw tells us about the draw k steps later. Adding those correlations up gives the integrated autocorrelation time, and dividing the chain length by it converts the chain into an equivalent number of independent samples.",
        invariants: [
            "Each autocorrelation lies between minus one and one.",
            "The initial positive sequence stops as soon as a pair of lags sums to a nonpositive value.",
            "The effective sample size never exceeds the chain length and is at least one.",
        ],
        correctness:
            "For a stationary reversible chain the variance of a Monte Carlo mean is inflated by the factor one plus twice the sum of autocorrelations. The effective sample size is the number of independent draws with that same variance, namely n divided by the factor. Truncating the sum using the initial positive sequence avoids accumulating Monte Carlo noise from high lags while keeping only positive contributions, a standard consistent estimator of the integrated autocorrelation time.",
        complexityRationale:
            "Each of the n minus one lags sums at most n products, so computing the autocorrelation function costs O(n squared) time; storing the series and the displayed lags uses O(n) space.",
        uses: [
            "Diagnosing convergence and efficiency of MCMC output",
            "Reporting how many independent draws a sampler effectively produced",
            "Comparing samplers and tuning their proposal distributions",
        ],
        references: [
            "Geyer, Practical Markov Chain Monte Carlo, 1992",
            "Vehtari et al., Rank-Normalization, Folding and Localization for ESS, 2021",
        ],
        workedExample:
            "For four completely uncorrelated draws the autocorrelation sum is near zero, tau is about one and the effective sample size is about four. For a slowly mixing chain with a large positive lag-one autocorrelation, tau is large and the effective sample size can be only a small fraction of the chain length.",
    },
    id: "effective-sample-size",
    name: "Effective Sample Size",
    category: "statistics-probability",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: {
        series: Array.from({ length: 120 }, (_, t) =>
            Number((Math.sin((2 * Math.PI * t) / 17) + 0.35 * Math.sin((2 * Math.PI * t) / 5)).toFixed(6))),
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the chain of simulated draws",
        "subtract the sample mean from every draw",
        "for each lag compute the normalized sum of lagged products",
        "pair consecutive autocorrelations into an initial positive sequence",
        "stop at the first pair whose sum is nonpositive",
        "set tau to one plus twice the sum of retained pairs",
        "divide the chain length by tau to obtain the effective sample size",
        "done: report tau and the effective sample size",
    ],
};

export default module;
