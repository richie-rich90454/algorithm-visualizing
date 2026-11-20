/**
 * metropolis-hastings.ts - Metropolis-Hastings Markov Chain Monte Carlo
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Metropolis-Hastings draws samples from a target distribution known only up
 * to a proportionality constant. From the current state it proposes a nearby
 * state with a symmetric random walk and accepts the move with probability
 * min(1, target(proposal) / target(current)). Accepted states are recorded as
 * samples from the target, which need not be normalized.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps) target evaluations
 *   Space: O(steps) for the sampled chain
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each step is a node placed at (iteration, sampled state).
 *   - An accepted move is green; a rejected move stays gray.
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

/** Unnormalized standard normal target density. */
function target(x: number): number {
    return Math.exp((-x * x) / 2);
}

/** Build one node per recorded state. */
function makeNodes(samples: Array<{ value: number; accepted: boolean }>): VisualEntity[] {
    return samples.map((sample, index) => {
        const state: EntityState = sample.accepted ? "sorted" : "unvisited";
        return {
            id: `sample-${index}`,
            type: "node" as const,
            label: sample.value.toFixed(2),
            value: sample.value,
            state,
            x: index,
            y: sample.value,
            width: 0,
            height: 0,
            metadata: { iteration: index, accepted: sample.accepted },
        };
    });
}

/** The Metropolis-Hastings generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { steps?: number; step?: number; seed?: number } | null) ?? {};
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 120;
    const width = typeof task.step === "number" ? Math.max(0.01, task.step) : 1;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 42;
    const rng = makeRng(seed);

    const samples: Array<{ value: number; accepted: boolean }> = [];
    let current = 0;
    let currentDensity = target(current);
    let acceptedCount = 0;
    let sum = 0;

    const push = (value: number, accepted: boolean): void => {
        samples.push({ value, accepted });
        sum += value;
    };
    push(current, false);

    yield {
        stepNumber: 0,
        entities: makeNodes(samples),
        edges: [],
        description: `Starting a Metropolis-Hastings chain at state 0 with ${steps} step(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { seed, steps, accepted: 0, acceptanceRate: 0, mean: 0, current: 0 },
    };
    let step = 1;

    for (let iteration = 1; iteration <= steps; iteration += 1) {
        const proposal = current + (2 * rng() - 1) * width;
        const proposalDensity = target(proposal);
        const ratio = proposalDensity / currentDensity;
        const uniform = rng();
        const accepted = uniform < Math.min(1, ratio);
        if (accepted) {
            current = proposal;
            currentDensity = proposalDensity;
            acceptedCount += 1;
        }
        push(current, accepted);
        yield {
            stepNumber: step,
            entities: makeNodes(samples),
            edges: [],
            description: `Step ${iteration}: proposed ${proposal.toFixed(3)}, ratio ${ratio.toFixed(3)}, ${accepted ? "accepted" : "rejected"}; state ${current.toFixed(3)}.`,
            codeLineNumber: accepted ? 3 : 4,
            layout: "point",
            meta: {
                seed,
                steps,
                accepted: acceptedCount,
                acceptanceRate: acceptedCount / iteration,
                mean: sum / samples.length,
                current,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(samples),
        edges: [],
        description: `Chain finished: ${acceptedCount} of ${steps} moves accepted, sample mean ${(sum / samples.length).toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            seed,
            steps,
            accepted: acceptedCount,
            acceptanceRate: acceptedCount / steps,
            mean: sum / samples.length,
            current,
        },
    };
}

/** The Metropolis-Hastings module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "To sample from a distribution you cannot normalize, wander around its state space and visit each region in proportion to its density. Propose a small random move, and always accept moves that increase the target density. Sometimes accept downhill moves too, so the chain can explore the whole distribution instead of sticking at one peak.",
        invariants: [
            "The proposal distribution is symmetric, so the proposal ratio is one.",
            "The acceptance probability is the minimum of one and the density ratio.",
            "The chain records its current state after every proposed move.",
        ],
        correctness:
            "The Metropolis acceptance rule makes the proposal kernel satisfy detailed balance with respect to the target: the flow from state a to b equals the flow from b to a. Because the target appears only as a ratio, its unknown normalizing constant cancels. An irreducible aperiodic symmetric random walk therefore has the target as its stationary distribution, so long-run samples follow it.",
        complexityRationale:
            "Each iteration proposes one state and evaluates the target twice (once cached from the current state), so time is O(steps). Storing the sampled chain uses O(steps) space.",
        uses: [
            "Bayesian posterior sampling when the normalizing constant is unknown",
            "Simulating physical systems with the Metropolis criterion",
            "Fitting hierarchical statistical models in Markov chain Monte Carlo software",
        ],
        references: [
            "Metropolis et al., Equation of State Calculations by Fast Computing Machines, 1953",
            "Hastings, Monte Carlo Sampling Methods Using Markov Chains, 1970",
        ],
        workedExample:
            "Starting at zero with target exp(-x squared / 2), a proposal to 0.5 has density ratio exp(-0.125) near 0.882, so it is accepted about 88 percent of the time. A proposal to 3 has ratio exp(-4.5) near 0.011 and is almost always rejected, keeping the chain near the center.",
    },
    id: "metropolis-hastings",
    name: "Metropolis-Hastings Sampling",
    category: "statistics-probability",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { steps: 120, step: 1, seed: 42 },
    visualType: "point",
    run,
    pseudocode: [
        "start at an initial state and evaluate the target density",
        "for each iteration",
        "propose a symmetric random-walk move",
        "accept when a uniform draw is below min of one and the density ratio",
        "otherwise stay at the current state",
        "record the current state as a sample",
        "done: report accepted moves and the sample mean",
    ],
};

export default module;
