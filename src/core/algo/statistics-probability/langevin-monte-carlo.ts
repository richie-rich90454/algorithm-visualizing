/**
 * langevin-monte-carlo.ts - Metropolis-Adjusted Langevin Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Langevin Monte Carlo samples a target density by following its gradient with
 * noise. A proposal moves in the direction of the log-density gradient scaled
 * by half the step size squared, then adds Gaussian noise. Because that drift
 * makes the proposal asymmetric, a Metropolis correction restores the exact
 * target as the chain's stationary distribution. This demo targets a standard
 * normal, whose log-density gradient is simply minus the current state.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps) gradient and density evaluations
 *   Space: O(steps) for the recorded chain
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each recorded state is a node placed at (iteration, state).
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

/** One standard normal draw using Box-Muller on the supplied uniforms. */
function normal(u1: number, u2: number): number {
    return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-300))) * Math.cos(2 * Math.PI * u2);
}

/** Unnormalized log target for a standard normal. */
function logTarget(x: number): number {
    return (-x * x) / 2;
}

/** Gradient of the standard normal log target. */
function gradient(x: number): number {
    return -x;
}

/** Log density of the Gaussian proposal centered at the Langevin drift. */
function logProposal(from: number, to: number, step: number): number {
    const center = from + (step * step * gradient(from)) / 2;
    return -((to - center) ** 2) / (2 * step * step);
}

/** Build one node per recorded state. */
function makeNodes(samples: Array<{ value: number; accepted: boolean }>): VisualEntity[] {
    return samples.map((sample, index) => ({
        id: `sample-${index}`,
        type: "node" as const,
        label: sample.value.toFixed(2),
        value: sample.value,
        state: (sample.accepted ? "sorted" : "unvisited") as EntityState,
        x: index,
        y: sample.value,
        width: 0,
        height: 0,
        metadata: { iteration: index, accepted: sample.accepted },
    }));
}

/** The Langevin Monte Carlo generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { steps?: number; step?: number; seed?: number } | null) ?? {};
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 120;
    const stepSize = typeof task.step === "number" ? Math.max(0.01, task.step) : 0.6;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const rng = makeRng(seed);

    const samples: Array<{ value: number; accepted: boolean }> = [];
    let current = 0;
    let acceptedCount = 0;
    let sum = 0;
    let sumSq = 0;
    samples.push({ value: current, accepted: false });

    const meta = (iteration: number, from: number, proposal: number, logRatio: number, accepted: boolean) => ({
        seed,
        steps,
        stepSize,
        from,
        current,
        proposal,
        logRatio,
        accepted,
        acceptedCount,
        acceptanceRate: acceptedCount / iteration,
        mean: sum / samples.length,
        variance: sumSq / samples.length - (sum / samples.length) ** 2,
    });

    yield {
        stepNumber: 0,
        entities: makeNodes(samples),
        edges: [],
        description: `Start a Langevin chain at state 0 targeting a standard normal with step size ${stepSize}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: meta(1, 0, 0, 0, false),
    };
    let step = 1;

    for (let iteration = 1; iteration <= steps; iteration += 1) {
        const center = current + (stepSize * stepSize * gradient(current)) / 2;
        const z = normal(rng(), rng());
        const proposal = center + stepSize * z;
        const from = current;
        const logRatio =
            logTarget(proposal) +
            logProposal(proposal, from, stepSize) -
            logTarget(from) -
            logProposal(from, proposal, stepSize);
        const accepted = Math.log(Math.max(rng(), 1e-300)) < logRatio;
        if (accepted) {
            current = proposal;
            acceptedCount += 1;
        }
        sum += current;
        sumSq += current * current;
        samples.push({ value: current, accepted });
        yield {
            stepNumber: step,
            entities: makeNodes(samples),
            edges: [],
            description: `Step ${iteration}: drifted center ${center.toFixed(3)}, proposed ${proposal.toFixed(3)}, log acceptance ratio ${logRatio.toFixed(3)}, ${accepted ? "accepted" : "rejected"}; state ${current.toFixed(3)}.`,
            codeLineNumber: accepted ? 2 : 4,
            layout: "point",
            meta: meta(iteration, from, proposal, logRatio, accepted),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(samples),
        edges: [],
        description: `Chain finished: ${acceptedCount} of ${steps} moves accepted; sample mean ${(sum / samples.length).toFixed(3)} and variance ${(sumSq / samples.length - (sum / samples.length) ** 2).toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { ...meta(steps, current, 0, 0, false), finite: Number.isFinite(sum / samples.length) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain Metropolis-Hastings proposes random moves that ignore where the target is high, so many are wasted. Langevin Monte Carlo adds a drift toward higher density using the gradient, letting proposals follow the slope of the distribution. Because that drift biases the proposal in one direction, a Metropolis correction reweights each move so the chain still settles on exactly the intended distribution.",
        invariants: [
            "The proposal center is the current state plus half the step size squared times the log-density gradient.",
            "The acceptance ratio includes the forward and reverse proposal densities.",
            "The chain records its current state after each accept or reject decision.",
        ],
        correctness:
            "The Langevin drift plus Gaussian noise defines a proposal whose density is known, so the Metropolis-Hastings ratio q(reverse)/q(forward) makes the combined kernel satisfy detailed balance with the target. The target appears only through log densities and gradients, so a missing normalizing constant cancels. Ergodicity of the noisy chain then gives the target as its stationary distribution.",
        complexityRationale:
            "Each iteration computes one gradient, one Gaussian draw, and a constant number of density evaluations, so time is O(steps). Recording the chain uses O(steps) space.",
        uses: [
            "Sampling Bayesian posteriors in probabilistic programming",
            "Simulation in statistical physics and molecular dynamics",
            "Uncertainty quantification in machine learning models with differentiable densities",
        ],
        references: [
            "Metropolis, Rosenbluth, Rosenbluth, Teller, and Teller, Equation of State Calculations, 1953",
            "Roberts and Rosenthal, Optimal Scaling of Discrete Approximations to Langevin Diffusions, 1998",
        ],
        workedExample:
            "Starting at x = 1 with a standard normal target, the gradient is minus one, so with step size 0.5 the proposal centers at 0.875 before adding noise. An uphill proposal near zero is accepted readily, while one far into the tail is usually rejected, keeping the cloud of samples centered at zero.",
    },
    id: "langevin-monte-carlo",
    name: "Langevin Monte Carlo (MALA)",
    category: "statistics-probability",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { steps: 120, step: 0.6, seed: 7 },
    visualType: "point",
    run,
    pseudocode: [
        "start at an initial state",
        "for each iteration compute the gradient of the log target",
        "center the proposal at the state plus half step squared times the gradient",
        "add Gaussian noise scaled by the step size",
        "compute the Metropolis ratio including both proposal densities",
        "accept with that probability, otherwise stay put",
        "done: report accepted moves and the sample moments",
    ],
};

export default module;
