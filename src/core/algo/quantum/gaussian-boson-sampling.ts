/**
 * gaussian-boson-sampling.ts - Gaussian Boson Sampling (Two-Mode Gaussian Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gaussian boson sampling sends squeezed vacuum modes through a linear
 * optical interferometer and then detects photons at the outputs. This module
 * implements the exact two-mode Gaussian core: it builds the covariance matrix
 * Sigma = U diag(s0^2, s1^2) U^T of squeezed modes after a beamsplitter, draws
 * correlated quadrature samples from that Gaussian with a seeded generator,
 * and applies threshold detection to produce a two-bit click pattern. Repeating
 * the draw estimates the click-pattern distribution. The marginal click
 * probability of each output is erfc(threshold / (sqrt(2) * sigma_i)).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(samples) draws of two correlated Gaussians
 *   Space: O(modes^2 + outcomes) for the covariance and click histogram
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four bars show the observed counts of outcomes 00, 01, 10, and 11.
 *   - Bars accumulate in batches so the sampling distribution is visible.
 *   - The final frame reports the covariance, marginals, and click frequencies.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GbsInput {
    samples?: number;
    squeeze0?: number;
    squeeze1?: number;
    angle?: number;
    threshold?: number;
    seed?: number;
}

/** Deterministic mulberry32 pseudo-random generator. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Abramowitz and Stegun approximation to the error function. */
function erf(x: number): number {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const poly = ((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592;
    return sign * (1 - poly * t * Math.exp(-ax * ax));
}

function makeBars(counts: number[], total: number): VisualEntity[] {
    const labels = ["00", "01", "10", "11"];
    return counts.map((count, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${labels[index]}: ${count} (${total ? (count / total).toFixed(3) : "0.000"})`,
        value: total ? count / total : 0,
        state: (total ? count / total : 0) > 0.01 ? "active" as EntityState : "idle" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, outcome: labels[index] ?? String(index), count },
    }));
}

/** The Gaussian boson sampling generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GbsInput | null) ?? {};
    const samples = Math.max(4, Math.min(50000, Math.floor(task.samples ?? 2000)));
    const s0 = typeof task.squeeze0 === "number" && task.squeeze0 > 0 ? task.squeeze0 : 1;
    const s1 = typeof task.squeeze1 === "number" && task.squeeze1 > 0 ? task.squeeze1 : 2;
    const angle = typeof task.angle === "number" ? task.angle : Math.PI / 4;
    const threshold = typeof task.threshold === "number" && task.threshold >= 0 ? task.threshold : 0.5;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const covariance = [
        c * c * s0 * s0 + s * s * s1 * s1,
        c * s * (s1 * s1 - s0 * s0),
        c * s * (s1 * s1 - s0 * s0),
        s * s * s0 * s0 + c * c * s1 * s1,
    ];
    const sigma0 = Math.sqrt(Math.max(1e-15, covariance[0] ?? 1));
    const sigma1 = Math.sqrt(Math.max(1e-15, covariance[3] ?? 1));
    const analytic = [
        1 - erf(threshold / (sigma0 * Math.SQRT2)),
        1 - erf(threshold / (sigma1 * Math.SQRT2)),
    ];
    const counts = [0, 0, 0, 0];
    const rand = mulberry32(seed);
    let step = 0;

    const gaussian = (): number => {
        const u1 = Math.max(1e-12, rand());
        const u2 = rand();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };

    const makeMeta = (drawn: number, done: boolean) => {
        const freq = counts.map((count) => (drawn ? count / drawn : 0));
        return {
            samples,
            drawn,
            covariance,
            sigma: [sigma0, sigma1],
            threshold,
            seed,
            counts: [...counts],
            frequencies: freq,
            analytic: [...analytic],
            done,
        };
    };

    yield {
        stepNumber: step++,
        entities: makeBars(counts, 0),
        edges: [],
        description: `Preparing squeezed modes s0=${s0}, s1=${s1} through a beamsplitter at angle ${angle.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: makeMeta(0, false),
    };

    const batches = 4;
    for (let batch = 1; batch <= batches; batch += 1) {
        const upTo = Math.floor((samples * batch) / batches);
        while (counts.reduce((sum, v) => sum + v, 0) < upTo) {
            const z0 = gaussian();
            const z1 = gaussian();
            const x0 = c * s0 * z0 + s * s1 * z1;
            const x1 = -s * s0 * z0 + c * s1 * z1;
            const bit0 = Math.abs(x0) > threshold ? 1 : 0;
            const bit1 = Math.abs(x1) > threshold ? 1 : 0;
            const outcome = bit0 * 2 + bit1;
            counts[outcome] = (counts[outcome] ?? 0) + 1;
        }
        const drawn = counts.reduce((sum, v) => sum + v, 0);
        yield {
            stepNumber: step++,
            entities: makeBars(counts, drawn),
            edges: [],
            description: `Drawn ${drawn} of ${samples} samples; click outcomes are accumulating in the histogram.`,
            codeLineNumber: 4,
            layout: "array",
            meta: makeMeta(drawn, false),
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(counts, samples),
        edges: [],
        description: `After ${samples} samples the marginal click rates are ${(analytic[0]!).toFixed(3)} and ${(analytic[1]!).toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: makeMeta(samples, true),
    };
}

/** The Gaussian boson sampling module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Squeezed light has one quadrature noise below the vacuum level and the other above it. Passing two such modes through a beamsplitter mixes their fluctuations into correlated Gaussian outputs. Threshold detectors ask a simple yes or no question at each output: was a photon detected? Sampling many times builds a click histogram. Because the underlying state is Gaussian, the chance that a detector clicks follows a closed-form complementary error function of that output's variance.",
        invariants: [
            "The covariance matrix equals U diag(s0^2, s1^2) U^T and stays positive semidefinite.",
            "Each output quadrature is Gaussian with variance equal to the matching covariance diagonal.",
            "The four click counts always sum to the number of samples drawn.",
        ],
        correctness:
            "Squeezing produces independent Gaussian quadratures with variances s0^2 and s1^2. A linear optical interferometer is an orthogonal matrix U, so the output covariance is U diag(s0^2, s1^2) U^T and each output remains Gaussian with variance Sigma_ii. Threshold detection fires when the absolute quadrature exceeds the threshold, whose probability for a zero-mean Gaussian is erfc(threshold / (sqrt(2) sigma_i)). The empirical click frequencies therefore converge to the analytic marginals by the law of large numbers, and the seeded generator makes the run reproducible.",
        complexityRationale:
            "Each sample draws two independent standard normals by Box-Muller, mixes them with four multiplications, and tests two thresholds, all constant work; total time is O(samples). Memory holds the 2 by 2 covariance and a four-bin histogram, O(1).",
        uses: [
            "Benchmarking quantum advantage with photonic sampling devices",
            "Modeling Gaussian state propagation through linear optics",
            "Estimating detector click statistics in continuous-variable experiments",
        ],
        references: [
            "Hamilton et al., Gaussian Boson Sampling, Physical Review Letters, 2017",
            "Kruse, Hamilton, and Sansoni, Detailed Study of Gaussian Boson Sampling, 2019",
        ],
        workedExample:
            "With squeezing 1 and 2 at a 45 degree beamsplitter the output covariance has diagonal entries 2.5 and 2.5 and off-diagonal 1.5. At threshold 0.5 each detector clicks with probability erfc(0.5 / sqrt(5)), about 0.75. Over a few thousand seeded samples the two marginal click rates land near that value while the joint histogram shows the correlation.",
    },
    id: "gaussian-boson-sampling",
    name: "Gaussian Boson Sampling (Two-Mode Core)",
    category: "quantum",
    complexity: { time: "O(samples)", space: "O(1)" },
    defaultInput: { samples: 2000, squeeze0: 1, squeeze1: 2, angle: Math.PI / 4, threshold: 0.5, seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "build the covariance Sigma from squeezing and the beamsplitter angle",
        "compute each output variance and analytic click probability",
        "for each sample draw two independent standard normal quadratures",
        "mix them through the interferometer into output quadratures",
        "record a click when an output magnitude exceeds the threshold",
        "accumulate the four click-pattern counts into a histogram",
        "repeat until the sample budget is spent",
        "done: report the histogram and analytic marginals",
    ],
};

export default module;
