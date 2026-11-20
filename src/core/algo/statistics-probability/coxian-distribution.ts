/**
 * coxian-distribution.ts - Coxian Phase-Type Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Coxian distribution is a finite mixture of sequential exponential phases.
 * Starting in phase zero, each phase completes at its own rate and either
 * moves to the next phase with a continuation probability or absorbs. This
 * makes it a dense, named subclass of phase-type laws that can shape a wide
 * range of positive-valued data. The cumulative function is evaluated by
 * uniformizing the transient generator into a sub-stochastic matrix.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points * uniformizationTerms * phases)
 *   Space: O(points + phases) for the curve and phase matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the cumulative probability.
 *   - The current grid point is highlighted during evaluation.
 *   - The final frame reports the mean and the phase count.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const RATES = [0.8, 1.5, 2.2, 3.0];
const PROBS = [0.7, 0.5, 0.35];

/** Build the sub-stochastic uniformization matrix P = I + T / theta. */
function buildMatrix(rates: number[], probs: number[]): { theta: number; matrix: number[][] } {
    let theta = 0;
    for (const rate of rates) theta = Math.max(theta, rate);
    const n = rates.length;
    const matrix = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        matrix[i]![i] = 1 - rates[i]! / theta;
        if (i + 1 < n) matrix[i]![i + 1] = (probs[i] ?? 0) * rates[i]! / theta;
    }
    return { theta, matrix };
}

/** Survival probability 1 - F(x) = alpha exp(Tx) 1 via uniformization. */
function survivalAt(
    x: number,
    rates: number[],
    theta: number,
    matrix: number[][],
): number {
    if (x <= 0) return 1;
    const n = rates.length;
    let vector = new Array<number>(n).fill(0);
    vector[0] = 1;
    let weight = Math.exp(-theta * x);
    let survival = 0;
    for (let k = 0; k < 4000; k += 1) {
        let mass = 0;
        for (const value of vector) mass += value;
        survival += weight * mass;
        const next = new Array<number>(n).fill(0);
        for (let j = 0; j < n; j += 1) {
            next[j] = vector[j]! * matrix[j]![j]!;
            if (j > 0) next[j] += vector[j - 1]! * matrix[j - 1]![j]!;
        }
        vector = next;
        weight *= (theta * x) / (k + 1);
        if (k > theta * x && weight < 1e-16) break;
    }
    return survival;
}

/** Mean time to absorption for a Coxian chain starting in phase zero. */
function meanAbsorption(rates: number[], probs: number[]): number {
    const n = rates.length;
    const expected = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i -= 1) {
        const next = i + 1 < n ? (probs[i] ?? 0) * expected[i + 1]! : 0;
        expected[i] = (1 + next) / rates[i]!;
    }
    return expected[0]!;
}

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, cumulative: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { rates?: number[]; probs?: number[]; points?: number } | null) ?? {};
    const rates = Array.isArray(task.rates) && task.rates.length > 0
        ? task.rates.filter((r) => typeof r === "number" && r > 0) : RATES;
    const cleanRates = rates.length > 0 ? rates : RATES;
    const probs = Array.isArray(task.probs)
        ? task.probs.slice(0, cleanRates.length - 1).map((p) => Math.max(0, Math.min(1, Number(p) || 0)))
        : PROBS.slice(0, cleanRates.length - 1);
    const points = typeof task.points === "number"
        ? Math.max(5, Math.min(200, Math.floor(task.points))) : 60;
    const { theta, matrix } = buildMatrix(cleanRates, probs);
    const mean = meanAbsorption(cleanRates, probs);
    const xMax = 5 * mean + 8;
    const xs = Array.from({ length: points + 1 }, (_, i) => (xMax * i) / points);

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points + 1).fill(0), -1, false),
        edges: [],
        description: `Building a Coxian cumulative curve with ${cleanRates.length} phase(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phases: cleanRates.length, rates: cleanRates, probs, theta, points, xs, cdf: [], mean, complete: false },
    };
    let step = 1;
    const cdf: number[] = [];
    for (let i = 0; i < xs.length; i += 1) {
        const value = Math.max(0, Math.min(1, 1 - survivalAt(xs[i] as number, cleanRates, theta, matrix)));
        cdf.push(value);
        yield {
            stepNumber: step,
            entities: makeBars([...cdf, ...new Array<number>(points + 1 - cdf.length).fill(0)], i, false),
            edges: [],
            description: `At x = ${(xs[i] as number).toFixed(3)} the cumulative probability is ${value.toFixed(6)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { phases: cleanRates.length, rates: cleanRates, probs, theta, points, xs, cdf: [...cdf], mean, complete: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(cdf, points + 1, true),
        edges: [],
        description: `Curve complete: ${cleanRates.length} phase(s), mean ${mean.toFixed(4)}, upper limit ${cdf[points]?.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { phases: cleanRates.length, rates: cleanRates, probs, theta, points, xs, cdf, mean, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a patient moving through several stages of recovery. At each stage they may leave the system or continue to the next, with stage-specific rates. The Coxian law is the time until absorption in such a chain; by tuning rates and continuation probabilities it can mimic many positive-valued distributions with a small state space.",
        invariants: [
            "The cumulative value is zero at zero and increases toward one.",
            "All rates are positive and continuation probabilities lie in zero to one.",
            "With a single phase the law is a plain exponential distribution.",
        ],
        correctness:
            "The transient generator T has diagonal entries minus the phase rates and superdiagonal entries equal to continuation probability times rate. Absorption time has cumulative 1 minus alpha exp(Tx) 1. Uniformization rewrites exp(Tx) as the sum over k of exp(-theta x)(theta x)^k/k! times P^k with P = I + T/theta, so summing alpha P^k 1 with Poisson weights yields the exact cumulative function; theta bounds the largest exit rate so P is sub-stochastic.",
        complexityRationale:
            "Each grid point sums Poisson terms until the weight is negligible, and each term updates an n-vector against an upper-triangular matrix in O(n). That gives O(points times terms times phases) time and O(points plus phases) space.",
        uses: [
            "Modeling service and sojourn times with a phase-type structure",
            "Approximating general positive distributions in queueing and reliability",
            "Fitting survival data with a small Markov model",
        ],
        references: [
            "Cox, A Use of Complex Probabilities in the Theory of Stochastic Processes, 1955",
            "Neuts, Matrix-Geometric Solutions in Stochastic Models, 1981",
        ],
        workedExample:
            "With one phase of rate 0.8 the cumulative function is 1 minus exp(-0.8 x), so at x = 2 it is about 0.80. Adding a second phase of rate 1.5 with continuation probability 0.7 delays absorption and raises the mean from 1.25 to 1.25 plus 0.7/1.5, about 1.72.",
    },
    id: "coxian-distribution",
    name: "Coxian Phase-Type Distribution",
    category: "statistics-probability",
    complexity: { time: "O(points * terms * phases)", space: "O(points + phases)" },
    defaultInput: { rates: RATES, probs: PROBS, points: 60 },
    visualType: "array",
    run,
    pseudocode: [
        "read phase rates and continuation probabilities",
        "set theta to the largest phase rate",
        "build uniformization matrix P = I + T/theta",
        "compute the mean absorption time by backward recursion",
        "for each grid x set vector alpha and Poisson weight exp(-theta x)",
        "add weight times sum of vector to the survival total",
        "multiply vector by P and advance the Poisson weight",
        "done: report cumulative probability one minus survival",
    ],
};

export default module;
