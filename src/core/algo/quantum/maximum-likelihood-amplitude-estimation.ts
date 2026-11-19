/**
 * maximum-likelihood-amplitude-estimation.ts - Maximum Likelihood Amplitude Estimation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Amplitude amplification maps an unknown amplitude a into a measurement
 * probability sin squared of (2m+1) times arcsin of the square root of a.
 * Given a histogram of zeros and ones from such a circuit, maximum likelihood
 * amplitude estimation finds the value of a that makes the observed histogram
 * most probable. This is the classical post-processing step that extracts an
 * estimate from amplified measurements without a full quantum phase estimation.
 *
 * ---------------------------------------------------------------------------
 * Limits of the simulation
 * ---------------------------------------------------------------------------
 *   - Amplitudes are restricted to the principal branch so the mapping is one to one.
 *   - Ideal measurement statistics; no shot noise beyond the supplied counts.
 *   - Real amplitudes and a single amplification depth m.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(g) likelihood evaluations on a grid of g points
 *   Space: O(g) for the plotted likelihood curve
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MleInput {
    zeros?: number;
    ones?: number;
    iterations?: number;
}

const GRID = 64;
const FINE = 2000;

/** Amplified zero probability for amplitude a after m Grover iterations. */
function predicted(a: number, factor: number): number {
    const theta = Math.asin(Math.sqrt(Math.max(0, Math.min(1, a))));
    const value = Math.sin(factor * theta);
    return value * value;
}

/** Log likelihood of the counts under amplitude a. */
function logLikelihood(a: number, factor: number, zeros: number, ones: number): number {
    const p = Math.max(1e-12, Math.min(1 - 1e-12, predicted(a, factor)));
    return zeros * Math.log(p) + ones * Math.log(1 - p);
}

/** Fine grid search plus ternary refinement on the principal branch. */
function maximize(zeros: number, ones: number, factor: number): { a: number; logL: number } {
    const upper = Math.pow(Math.sin(Math.PI / (2 * factor)), 2);
    let bestA = 0;
    let bestL = -Infinity;
    for (let i = 0; i <= FINE; i += 1) {
        const a = (upper * i) / FINE;
        const value = logLikelihood(a, factor, zeros, ones);
        if (value > bestL) {
            bestL = value;
            bestA = a;
        }
    }
    let lo = Math.max(0, bestA - upper / FINE);
    let hi = Math.min(upper, bestA + upper / FINE);
    for (let i = 0; i < 80; i += 1) {
        const m1 = lo + (hi - lo) / 3;
        const m2 = hi - (hi - lo) / 3;
        if (logLikelihood(m1, factor, zeros, ones) < logLikelihood(m2, factor, zeros, ones)) lo = m1;
        else hi = m2;
    }
    const a = (lo + hi) / 2;
    return { a, logL: logLikelihood(a, factor, zeros, ones) };
}

function makeBars(values: number[], bestIndex: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `grid-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: done ? "sorted" : index === bestIndex ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, likelihood: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MleInput | null) ?? {};
    const zeros = Math.max(0, Math.floor(typeof task.zeros === "number" ? task.zeros : 90));
    const ones = Math.max(0, Math.floor(typeof task.ones === "number" ? task.ones : 10));
    const m = Math.max(0, Math.min(10, Math.floor(typeof task.iterations === "number" ? task.iterations : 2)));
    const factor = 2 * m + 1;
    const upper = Math.pow(Math.sin(Math.PI / (2 * factor)), 2);
    const total = zeros + ones;

    if (total === 0) {
        yield {
            stepNumber: 0,
            entities: makeBars(Array.from({ length: GRID }, () => 0), 0, true),
            edges: [],
            description: "No measurements were supplied, so no amplitude can be estimated.",
            codeLineNumber: 0,
            layout: "array",
            meta: { estimate: 0, zeros, ones, iterations: m, converged: false },
        };
        return;
    }

    yield {
        stepNumber: 0,
        entities: makeBars(Array.from({ length: GRID }, () => 0), 0, false),
        edges: [],
        description: `Estimating an amplitude from ${zeros} zero and ${ones} one outcomes at amplification depth ${m}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { estimate: 0, zeros, ones, iterations: m, converged: false },
    };

    const optimum = maximize(zeros, ones, factor);
    const logValues = Array.from({ length: GRID }, (_, i) =>
        logLikelihood((upper * i) / (GRID - 1), factor, zeros, ones),
    );
    const maxLog = Math.max(...logValues);
    const normalized = logValues.map((value) => Math.exp(value - maxLog));
    let bestIndex = 0;
    normalized.forEach((value, index) => {
        if (value > normalized[bestIndex]!) bestIndex = index;
    });

    yield {
        stepNumber: 1,
        entities: makeBars(normalized, bestIndex, false),
        edges: [],
        description: `Searched the principal branch up to a = ${upper.toFixed(6)}; the likelihood peaks near a = ${optimum.a.toFixed(6)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            estimate: optimum.a,
            zeros,
            ones,
            iterations: m,
            logLikelihood: optimum.logL,
            predicted: predicted(optimum.a, factor),
            upper,
            converged: false,
        },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(normalized, bestIndex, true),
        edges: [],
        description: `Maximum likelihood amplitude is ${optimum.a.toFixed(6)}, predicting zero probability ${predicted(optimum.a, factor).toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            estimate: optimum.a,
            zeros,
            ones,
            iterations: m,
            logLikelihood: optimum.logL,
            predicted: predicted(optimum.a, factor),
            observedProbability: zeros / total,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Amplitude amplification bends the unknown amplitude into a measurement probability that swings with the number of Grover steps. Running the circuit many times gives a histogram of zeros and ones. Rather than inverting the swing formula naively, maximum likelihood asks which amplitude would have made this exact histogram most likely and reports that value.",
        invariants: [
            "The search is limited to amplitudes whose amplified angle stays in the principal branch.",
            "The predicted zero probability always lies strictly between zero and one.",
            "The reported amplitude maximizes the binomial log likelihood of the counts.",
        ],
        correctness:
            "For a fixed amplitude a and depth m, each shot is a Bernoulli trial with success probability sin squared of (2m+1) times arcsin of the square root of a. The joint probability of the observed counts is proportional to p raised to the number of zeros times (one minus p) raised to the number of ones, so its log is a concave function of p on the principal branch where the angle stays below pi over two. Maximizing that log by a grid search followed by ternary refinement therefore finds the unique maximum likelihood probability; inverting the monotonic angle map recovers the amplitude. With no amplification the estimate reduces to the observed fraction of zeros, the familiar Bernoulli maximum likelihood estimator.",
        complexityRationale:
            "The optimizer evaluates the likelihood on a fixed fine grid and then refines by a fixed number of ternary steps, so time is O(g) where g is the grid size and independent of the number of shots. Storage is the plotted grid of g likelihood values.",
        uses: [
            "Extracting estimates from amplitude-amplified measurements",
            "Monte Carlo integration with quadratic speedup",
            "Post-processing near-term quantum experiments without phase estimation",
        ],
        references: [
            "Brassard, Hoyer, Mosca, and Tapp, Quantum Amplitude Amplification and Estimation, 2002",
            "Suzuki, Unbiased Estimation of Amplitude by Maximum Likelihood, 2016",
        ],
        workedExample:
            "With two amplification steps the principal branch allows amplitudes up to about 0.0955. An amplitude of 0.06 gives an amplified zero probability near 0.9, so a run with 90 zeros and 10 out of 100 shots leads the optimizer back to an estimate close to 0.06.",
    },
    id: "maximum-likelihood-amplitude-estimation",
    name: "Maximum Likelihood Amplitude Estimation",
    category: "quantum",
    complexity: { time: "O(g)", space: "O(g)" },
    defaultInput: { zeros: 90, ones: 10, iterations: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "read the observed counts of zero and one outcomes",
        "set the amplification factor to twice the depth plus one",
        "bound the principal branch where the amplified angle is at most pi over two",
        "evaluate the binomial log likelihood on a fine amplitude grid",
        "refine the best grid point with ternary search",
        "invert the amplified angle at the maximizing amplitude",
        "plot the normalized likelihood curve",
        "done: report the maximum likelihood amplitude",
    ],
};

export default module;
