/**
 * thompson-sampling.ts - Thompson Sampling for Bernoulli Bandits
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Thompson sampling solves the multi-armed bandit by sampling a plausible
 * success rate for each arm from its posterior and pulling the arm with the
 * largest sample. A Bernoulli arm starts with a Beta(1,1) prior; each observed
 * success or failure is added to the posterior's alpha or beta parameter. The
 * random sample automatically balances exploration and exploitation: uncertain
 * arms occasionally draw high values and get tried.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * arms) posterior samples per round
 *   Space: O(arms) for the posterior parameters and counts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per arm shows its posterior mean success rate.
 *   - The arm pulled in the current round is highlighted; the best final arm
 *     is marked green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic mulberry32 pseudo-random generator. */
function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Standard normal from two uniforms via Box-Muller. */
function normal(u1: number, u2: number): number {
    return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-300))) * Math.cos(2 * Math.PI * u2);
}

/** Gamma(shape, 1) sample by the Marsaglia-Tsang method for shape >= 1. */
function gammaSample(shape: number, rng: () => number): number {
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
        const z = normal(rng(), rng());
        const v = (1 + c * z) ** 3;
        if (v <= 0) continue;
        const u = rng();
        if (u < 1 - 0.0331 * z ** 4) return d * v;
        if (Math.log(u) < (z * z) / 2 + d * (1 - v + Math.log(v))) return d * v;
    }
}

/** Beta(alpha, beta) sample as a ratio of two gamma draws. */
function betaSample(alpha: number, beta: number, rng: () => number): number {
    const g1 = gammaSample(alpha, rng);
    const g2 = gammaSample(beta, rng);
    return g1 / (g1 + g2);
}

/** Build posterior-mean bars for every arm. */
function makeBars(alpha: number[], beta: number[], chosen: number, finalBest: number): VisualEntity[] {
    return alpha.map((a, index) => {
        const mean = a / (a + (beta[index] ?? 0));
        let state: EntityState = "idle";
        if (index === finalBest && finalBest >= 0) state = "sorted";
        else if (index === chosen && chosen >= 0) state = "active";
        return {
            id: `arm-${index}`,
            type: "bar" as const,
            label: `${mean.toFixed(2)}`,
            value: mean,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, mean, alpha: a, beta: beta[index] ?? 0 },
        };
    });
}

/** The Thompson sampling generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { rates?: number[]; rounds?: number; seed?: number } | null) ?? {};
    const rates = Array.isArray(task.rates) && task.rates.length > 0
        ? task.rates.map(Number)
        : [0.15, 0.75, 0.4];
    const rounds = typeof task.rounds === "number" ? Math.max(1, Math.floor(task.rounds)) : 40;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 17;
    const rng = makeRng(seed);
    const arms = rates.length;
    const alpha = new Array<number>(arms).fill(1);
    const beta = new Array<number>(arms).fill(1);
    const pulls = new Array<number>(arms).fill(0);
    const rewards = new Array<number>(arms).fill(0);

    const frameMeta = (round: number, chosen: number, reward: number, sampled: number[]) => ({
        arms,
        rounds,
        round,
        alpha: [...alpha],
        beta: [...beta],
        pulls: [...pulls],
        rewards: [...rewards],
        chosen,
        reward,
        sampled: [...sampled],
    });

    yield {
        stepNumber: 0,
        entities: makeBars(alpha, beta, -1, -1),
        edges: [],
        description: `${arms} Bernoulli arms start with a Beta(1,1) prior; sample a rate per arm and pull the largest.`,
        codeLineNumber: 0,
        layout: "array",
        meta: frameMeta(0, -1, 0, new Array<number>(arms).fill(0)),
    };
    let step = 1;

    for (let round = 1; round <= rounds; round += 1) {
        const sampled = alpha.map((a, index) => betaSample(a, beta[index] as number, rng));
        let chosen = 0;
        for (let i = 1; i < arms; i += 1) {
            if ((sampled[i] as number) > (sampled[chosen] as number)) chosen = i;
        }
        const reward = rng() < (rates[chosen] as number) ? 1 : 0;
        pulls[chosen] = (pulls[chosen] as number) + 1;
        if (reward === 1) alpha[chosen] = (alpha[chosen] as number) + 1;
        else beta[chosen] = (beta[chosen] as number) + 1;
        rewards[chosen] = (rewards[chosen] as number) + reward;

        yield {
            stepNumber: step,
            entities: makeBars(alpha, beta, chosen, -1),
            edges: [],
            description: `Round ${round}: sampled rates [${sampled.map((s) => s.toFixed(2)).join(", ")}]; pulled arm ${chosen} and got reward ${reward}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: frameMeta(round, chosen, reward, sampled),
        };
        step += 1;
    }

    let best = 0;
    for (let i = 1; i < arms; i += 1) {
        if ((pulls[i] as number) > (pulls[best] as number)) best = i;
    }
    yield {
        stepNumber: step,
        entities: makeBars(alpha, beta, -1, best),
        edges: [],
        description: `After ${rounds} rounds, arm ${best} was pulled most often (${pulls[best]} times); posterior means [${alpha.map((a, i) => (a / (a + (beta[i] as number))).toFixed(2)).join(", ")}].`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...frameMeta(rounds, best, 0, new Array<number>(arms).fill(0)), best, bestRate: rates[best] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than committing to one guess about which option is best, Thompson sampling keeps a posterior belief about every arm's success rate. Each round it draws one random rate from each belief and picks the biggest draw. An arm that might be good gets sampled high sometimes and is explored; an arm known to be poor rarely wins a draw and is ignored.",
        invariants: [
            "Every arm begins with posterior parameters alpha = beta = 1.",
            "A success increments alpha and a failure increments beta for the pulled arm.",
            "alpha + beta always equals two plus the number of pulls of that arm.",
        ],
        correctness:
            "For a Bernoulli arm with a Beta prior, the Beta-Bernoulli conjugacy makes the posterior exactly Beta(alpha plus successes, beta plus failures). Sampling from these posteriors and taking the maximum is equivalent to choosing an arm with probability equal to the posterior probability that it is best, which is the definition of Thompson sampling. That randomized probability matching yields near-optimal regret because the posterior concentrates on the true best arm as data accumulates.",
        complexityRationale:
            "Each round draws one Beta sample per arm using a constant-time gamma sampler and a single reward draw, so time is O(rounds * arms). Storing two posterior parameters and two counts per arm uses O(arms) space.",
        uses: [
            "Online ad and content selection with unknown click-through rates",
            "A/B testing that automatically favors promising variants",
            "Recommender systems balancing exploration of new items",
        ],
        references: [
            "Thompson, On the Likelihood that One Unknown Probability Exceeds Another, 1933",
            "Agrawal and Goyal, Analysis of Thompson Sampling for the Multi-armed Bandit, 2012",
        ],
        workedExample:
            "With arms of true rates 0.1, 0.75, and 0.4, all start at Beta(1,1). Early draws are spread out, but after dozens of rounds the middle arm's posterior centers near 0.75 and wins most samples, so it is pulled far more often than the others.",
    },
    id: "thompson-sampling",
    name: "Thompson Sampling",
    category: "statistics-probability",
    complexity: { time: "O(rounds * arms)", space: "O(arms)" },
    defaultInput: { rates: [0.15, 0.75, 0.4], rounds: 40, seed: 17 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize every arm with a Beta(1,1) posterior",
        "for each round",
        "draw one sample from each arm's posterior",
        "pull the arm with the largest sample",
        "observe a Bernoulli reward from that arm",
        "increment alpha on success or beta on failure",
        "done: report pull counts and posterior means",
    ],
};

export default module;
