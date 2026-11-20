/**
 * hamiltonian-monte-carlo.ts - Hamiltonian Monte Carlo
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Hamiltonian Monte Carlo (HMC) samples a target density by simulating
 * Hamiltonian dynamics. It augments the position q with an auxiliary momentum
 * p, follows the energy-conserving leapfrog flow, and accepts the endpoint with
 * a Metropolis correction. Because the trajectory uses gradient information it
 * moves far across the distribution with far less random-walk behavior than
 * Metropolis-Hastings. Here the target is the standard normal, so U(q)=q^2/2
 * and grad U(q)=q, and momentum is standard normal with K(p)=p^2/2.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * leapfrogSteps) gradient evaluations
 *   Space: O(steps) for the recorded chain
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each node is (iteration, position) on a trace plot.
 *   - An accepted endpoint is GREEN; a rejected one stays GRAY.
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

/** Standard normal draw via Box-Muller, driven by the supplied generator. */
function normal(rng: () => number): number {
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Potential energy of the standard normal target. */
function potential(q: number): number {
    return (q * q) / 2;
}

/** Hamiltonian (total energy) at a position-momentum pair. */
function hamiltonian(q: number, p: number): number {
    return potential(q) + (p * p) / 2;
}

/** Run L leapfrog steps with step size eps, returning the proposal endpoint. */
function leapfrog(q: number, p: number, eps: number, steps: number): [number, number] {
    let position = q;
    let momentum = p - (eps / 2) * position;
    for (let i = 0; i < steps; i += 1) {
        position += eps * momentum;
        momentum -= eps * position;
    }
    momentum -= (eps / 2) * position;
    return [position, -momentum];
}

/** Build the trace-plot nodes recorded so far. */
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { steps?: number; stepSize?: number; leapfrogSteps?: number; seed?: number } | null) ??
        {};
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 60;
    const eps = typeof task.stepSize === "number" ? Math.max(0.001, task.stepSize) : 0.3;
    const leap = typeof task.leapfrogSteps === "number" ? Math.max(1, Math.floor(task.leapfrogSteps)) : 5;
    const rng = makeRng(typeof task.seed === "number" ? Math.floor(task.seed) : 7);

    const samples: Array<{ value: number; accepted: boolean }> = [{ value: 0, accepted: false }];
    let current = 0;
    let acceptedCount = 0;
    let sum = 0;

    yield {
        stepNumber: 0,
        entities: makeNodes(samples),
        edges: [],
        description: `Starting Hamiltonian Monte Carlo at q=0 with ${steps} iteration(s) and ${leap} leapfrog step(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { iteration: 0, current: 0, accepted: 0, acceptRate: 0, mean: 0 },
    };

    for (let iteration = 1; iteration <= steps; iteration += 1) {
        const p0 = normal(rng);
        const [proposal, pProposal] = leapfrog(current, p0, eps, leap);
        const deltaH = hamiltonian(proposal, pProposal) - hamiltonian(current, p0);
        const accepted = rng() < Math.min(1, Math.exp(-deltaH));
        if (accepted) {
            current = proposal;
            acceptedCount += 1;
            sum += current;
        }
        samples.push({ value: current, accepted });

        yield {
            stepNumber: iteration,
            entities: makeNodes(samples),
            edges: [],
            description: `Iteration ${iteration}: momentum ${p0.toFixed(2)}, proposal ${proposal.toFixed(3)}, energy gain ${deltaH.toFixed(3)}, ${accepted ? "accepted" : "rejected"}; q=${current.toFixed(3)}.`,
            codeLineNumber: accepted ? 6 : 7,
            layout: "point",
            meta: {
                iteration,
                current,
                proposal,
                deltaH,
                accepted,
                acceptedCount,
                acceptRate: acceptedCount / iteration,
                mean: sum / acceptedCount || 0,
            },
        };
    }

    yield {
        stepNumber: steps + 1,
        entities: makeNodes(samples),
        edges: [],
        description: `Chain finished: ${acceptedCount} of ${steps} proposals accepted; mean position ${(sum / (acceptedCount || 1)).toFixed(4)}.`,
        codeLineNumber: 8,
        layout: "point",
        meta: {
            iteration: steps + 1,
            accepted: acceptedCount,
            acceptRate: acceptedCount / steps,
            mean: sum / (acceptedCount || 1),
            current,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of stumbling randomly, give the sampler a momentum and let it glide along the target density's contours. The gradient tells the trajectory which way is downhill in potential energy, so each proposal travels a long distance while staying in a high-probability region. A final accept or reject step removes the small error introduced by simulating the trajectory in discrete steps.",
        invariants: [
            "The augmented Hamiltonian is potential energy plus kinetic energy.",
            "Momentum is redrawn independently from a standard normal each iteration.",
            "The leapfrog endpoint is negated so the proposal kernel is reversible.",
        ],
        correctness:
            "Exact Hamiltonian flow conserves the Hamiltonian, so it would keep the target density invariant. Leapfrog is volume-preserving and reversible but only approximately conserves energy, so a Metropolis accept with probability min(1, exp(H(current) minus H(proposal))) restores detailed balance. Negating the momentum makes the proposal symmetric, which is exactly the condition that correction needs; therefore the chain has the target as its stationary distribution.",
        complexityRationale:
            "Each iteration evaluates the gradient O(leapfrogSteps) times during leapfrog and evaluates the Hamiltonian a constant number of times, giving O(steps times leapfrogSteps) work. The recorded chain stores one position per iteration, so space is O(steps).",
        uses: [
            "Bayesian posterior inference in probabilistic programming systems",
            "Sampling continuous distributions in statistical physics",
            "Fitting hierarchical models where random-walk Metropolis mixes poorly",
        ],
        references: [
            "Duane, Kennedy, Pendleton and Roweth, Hybrid Monte Carlo, 1987",
            "Neal, MCMC Using Hamiltonian Dynamics, Handbook of Markov Chain Monte Carlo, 2011",
        ],
        workedExample:
            "Starting at q=0 with step size 0.3 and five leapfrog steps, a drawn momentum of about 0.5 carries the state toward q near 0.8. If the endpoint's Hamiltonian is larger by 0.1, it is accepted with probability exp(-0.1), about 0.90. Over many iterations the recorded positions center near zero, as a standard normal should.",
    },
    id: "hamiltonian-monte-carlo",
    name: "Hamiltonian Monte Carlo",
    category: "statistics-probability",
    complexity: { time: "O(steps * leapfrogSteps)", space: "O(steps)" },
    defaultInput: { steps: 60, stepSize: 0.3, leapfrogSteps: 5, seed: 7 },
    visualType: "point",
    run,
    pseudocode: [
        "set the current position and the leapfrog step size",
        "for each sampling iteration",
        "draw a fresh momentum from the standard normal",
        "run leapfrog integration to move position and momentum",
        "negate the momentum so the proposal is reversible",
        "compute the Hamiltonian difference between current and proposal",
        "accept when a uniform draw is below exp of negative energy gain",
        "otherwise keep the current position and reject the proposal",
        "done: report the chain mean and the acceptance rate",
    ],
};

export default module;
