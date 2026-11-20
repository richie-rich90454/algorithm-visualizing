/**
 * sequential-importance-sampling.ts - Sequential Importance Sampling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Sequential importance sampling estimates an expectation under a target law
 * by drawing particles from an easier proposal and weighting each by the
 * likelihood ratio between target and proposal. Normalizing the weights turns
 * the weighted particle cloud into an empirical approximation of the target.
 * This is the core building block of sequential Monte Carlo methods.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(particles)
 *   Space: O(particles) for the particle positions and weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each particle is drawn at its sampled position on the horizontal axis.
 *   - Brighter highlighted particles carry larger normalized weight.
 *   - The final frame reports the weighted estimate and effective sample size.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeRng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function standardNormal(rng: () => number): number {
    const u1 = Math.max(1e-12, rng());
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Standard normal density. */
function normalPdf(x: number, sd: number): number {
    return Math.exp(-0.5 * (x / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
}

function makeEntities(xs: number[], weights: number[], current: number): VisualEntity[] {
    const maxWeight = Math.max(1e-12, ...weights);
    return xs.map((x, index) => ({
        id: `particle-${index}`,
        type: "node" as const,
        label: weights[index]!.toFixed(3),
        value: { x, weight: weights[index] },
        state: index > current ? "unvisited" : weights[index]! > 0.6 * maxWeight ? "highlight" : "active",
        x,
        y: weights[index]! * 4,
        width: 0,
        height: 0,
        metadata: { index, x, weight: weights[index] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; particles?: number; proposalSd?: number } | null) ?? {};
    const seed = typeof task.seed === "number" ? task.seed : 2024;
    const particles = typeof task.particles === "number"
        ? Math.max(2, Math.min(20000, Math.floor(task.particles))) : 2000;
    const proposalSd = typeof task.proposalSd === "number" && task.proposalSd > 0 ? task.proposalSd : 1.5;
    const rng = makeRng(seed);

    const xs = Array.from({ length: particles }, () => proposalSd * standardNormal(rng));
    const rawWeights = xs.map((x) => normalPdf(x, 1) / normalPdf(x, proposalSd));
    const weightSum = rawWeights.reduce((a, b) => a + b, 0);
    const weights = rawWeights.map((w) => w / weightSum);
    const estimate = xs.reduce((acc, x, i) => acc + weights[i]! * x * x, 0);
    const ess = 1 / weights.reduce((acc, w) => acc + w * w, 0);

    yield {
        stepNumber: 0,
        entities: makeEntities(xs, new Array<number>(particles).fill(0), -1),
        edges: [],
        description: `Drawing ${particles} particles from a proposal with standard deviation ${proposalSd}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { seed, particles, proposalSd, estimate: 0, ess: 0, complete: false },
    };
    let step = 1;
    const stride = Math.max(1, Math.floor(particles / 40));
    const shown = new Array<number>(particles).fill(0);
    for (let i = 0; i < particles; i += 1) {
        shown[i] = weights[i]!;
        if (i % stride === stride - 1 || i === particles - 1) {
            yield {
                stepNumber: step,
                entities: makeEntities(xs, shown, i),
                edges: [],
                description: `Particle ${i + 1} of ${particles}: importance weight ${weights[i]!.toFixed(6)}.`,
                codeLineNumber: 2,
                layout: "point",
                meta: { seed, particles, proposalSd, estimate: 0, ess: 0, complete: false },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeEntities(xs, weights, particles - 1),
        edges: [],
        description: `Weighted estimate of E[X squared] is ${estimate.toFixed(4)}; effective sample size ${ess.toFixed(1)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { seed, particles, proposalSd, estimate, ess, weightSum: weights.reduce((a, b) => a + b, 0), complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When sampling directly from a target is hard, sample from a nearby proposal instead and correct the bias with weights equal to the target density divided by the proposal density. A cloud of weighted particles then stands in for the target distribution, letting us estimate quantities such as means and tail probabilities.",
        invariants: [
            "Every importance weight is nonnegative.",
            "The normalized weights sum to one.",
            "The weighted estimate targets the expectation under the proposal when reweighted.",
        ],
        correctness:
            "For particles drawn from proposal q, the importance identity says E_p[h(X)] equals E_q[w(X) h(X)] with w = p/q. Replacing the expectation by a particle average gives a consistent estimator. Normalizing the weights is valid because the self-normalized estimator converges to the same target as the number of particles grows, and the effective sample size one over the sum of squared weights measures how concentrated the weights are.",
        complexityRationale:
            "Sampling each particle, evaluating two densities, and accumulating the weighted sum are all constant-time operations, so the method runs in O(particles) time and O(particles) space.",
        uses: [
            "Estimating integrals in Bayesian inference",
            "Particle filters for state-space models",
            "Rare-event probability estimation with a tilted proposal",
        ],
        references: [
            "Geweke, Bayesian Inference via Simulations of Economic Models, 1989",
            "Doucet, de Freitas, and Gordon, Sequential Monte Carlo Methods in Practice, 2001",
        ],
        workedExample:
            "Target the standard normal while proposing from a normal with standard deviation 1.5. A particle at x = 2 gets weight exp(-2) divided by exp(-2/2.25) times 1.5, about 0.34. Averaging x squared under all normalized weights estimates one, the true variance of the target; the effective sample size is below the particle count because the proposal is wider than the target.",
    },
    id: "sequential-importance-sampling",
    name: "Sequential Importance Sampling",
    category: "statistics-probability",
    complexity: { time: "O(particles)", space: "O(particles)" },
    defaultInput: { seed: 2024, particles: 2000, proposalSd: 1.5 },
    visualType: "point",
    run,
    pseudocode: [
        "read particle count and proposal spread",
        "for each particle draw a position from the proposal",
        "set weight to target density divided by proposal density",
        "sum the raw weights and normalize them",
        "estimate the target moment as the weighted average",
        "compute effective sample size from squared weights",
        "done: report the estimate and effective sample size",
    ],
};

export default module;
