/**
 * quantum-metropolis.ts - Quantum Metropolis Sampling (exact small simulator)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quantum Metropolis prepares a thermal state rho proportional to exp(-beta H)
 * by combining reversible quantum moves with a Metropolis accept or reject
 * step. The acceptance probability is implemented coherently: an ancilla is
 * rotated by an angle whose squared sine equals the Gibbs acceptance ratio,
 * and the proposal is applied conditionally on that ancilla. Energy is
 * measured after each step, so the observable state is a distribution over
 * energy levels that converges to the Boltzmann distribution.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an exact state-vector simulation for a toy Hamiltonian with at most
 * six energy levels on a line and symmetric nearest-neighbor proposals. The
 * coherent accept rotation is evaluated exactly rather than by phase
 * estimation and amplitude amplification, and no shot noise, decoherence, or
 * hardware error is modeled. The reported distribution is exact, not sampled.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(steps * n) for n energy levels
 *   Space: O(n) for the distribution and accept amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the probability of occupying each energy level.
 *   - Each step highlights the level with the largest probability change.
 *   - The final frame compares the distribution with the exact Gibbs state.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface MetropolisInput {
    energies?: number[];
    beta?: number;
    start?: number;
    steps?: number;
}

function bars(probabilities: number[], highlight: number): VisualEntity[] {
    return probabilities.map((probability, index) => ({
        id: `level-${index}`,
        type: "bar" as const,
        label: `E${index}: ${probability.toFixed(3)}`,
        value: probability,
        state: (index === highlight ? "active" : "comparing") as VisualEntity["state"],
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability },
    }));
}

function acceptance(from: number, to: number, energies: number[], beta: number): number {
    const delta = (energies[to] ?? 0) - (energies[from] ?? 0);
    return Math.min(1, Math.exp(-beta * delta));
}

/** One coherent Metropolis step: rotate an accept ancilla, then propose. */
function metropolisStep(
    distribution: number[],
    energies: number[],
    beta: number,
): { next: number[]; acceptAmps: number[] } {
    const n = distribution.length;
    const next = new Array<number>(n).fill(0);
    const acceptAmps: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const p = distribution[i] ?? 0;
        const neighbors: number[] = [];
        if (i > 0) {
            neighbors.push(i - 1);
        }
        if (i + 1 < n) {
            neighbors.push(i + 1);
        }
        const proposalProb = neighbors.length > 0 ? 0.5 : 1;
        const selfLoop = neighbors.length === 0 ? p : neighbors.length === 1 ? p * 0.5 : 0;
        next[i] = (next[i] ?? 0) + selfLoop;
        for (const j of neighbors) {
            const a = acceptance(i, j, energies, beta);
            const acceptAmp = Math.sqrt(p * proposalProb * a);
            const rejectAmp = Math.sqrt(p * proposalProb * (1 - a));
            acceptAmps.push(acceptAmp);
            next[j] = (next[j] ?? 0) + acceptAmp * acceptAmp;
            next[i] = (next[i] ?? 0) + rejectAmp * rejectAmp;
        }
    }
    return { next, acceptAmps };
}

function gibbs(energies: number[], beta: number): number[] {
    const min = Math.min(...energies);
    const weights = energies.map((energy) => Math.exp(-beta * (energy - min)));
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((weight) => weight / sum);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MetropolisInput | null) ?? {};
    const energies = (task.energies ?? [0, 1, 2]).slice(0, 6);
    const n = Math.max(1, energies.length);
    const beta = typeof task.beta === "number" ? Math.max(0, task.beta) : 1.5;
    const steps = Math.max(0, Math.min(200, typeof task.steps === "number" ? task.steps : 30));
    const start = Math.max(0, Math.min(n - 1, typeof task.start === "number" ? task.start : 0));

    let distribution = new Array<number>(n).fill(0);
    distribution[start] = 1;
    const target = gibbs(energies, beta);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(distribution, start),
        edges: [],
        description: `Quantum Metropolis on ${n} energy levels at beta ${beta.toFixed(3)}: start in level ${start}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, beta, step: 0, steps },
    };
    step += 1;

    for (let t = 1; t <= steps; t += 1) {
        const { next, acceptAmps } = metropolisStep(distribution, energies, beta);
        let highlight = 0;
        for (let i = 1; i < n; i += 1) {
            if (Math.abs((next[i] ?? 0) - (distribution[i] ?? 0)) > Math.abs((next[highlight] ?? 0) - (distribution[highlight] ?? 0))) {
                highlight = i;
            }
        }
        distribution = next;
        const meanAccept = acceptAmps.length > 0
            ? acceptAmps.reduce((a, b) => a + b * b, 0) / acceptAmps.length
            : 1;
        yield {
            stepNumber: step,
            entities: bars(distribution, highlight),
            edges: [],
            description: `Step ${t}: rotate the accept ancilla and apply the proposal conditionally; mean squared accept amplitude ${meanAccept.toFixed(3)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, beta, step: t, steps, acceptAmps, meanAccept },
        };
        step += 1;
    }

    const distance = distribution.reduce((sum, value, index) => sum + Math.abs(value - (target[index] ?? 0)), 0) / 2;
    let peak = 0;
    for (let i = 1; i < n; i += 1) {
        if ((distribution[i] ?? 0) > (distribution[peak] ?? 0)) {
            peak = i;
        }
    }
    yield {
        stepNumber: step,
        entities: bars(distribution, peak),
        edges: [],
        description: `After ${steps} step(s) the total variation distance to the exact Gibbs state is ${distance.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, beta, step: steps, steps, totalVariation: distance, gibbs: target, peak },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A thermal state favors low-energy configurations but still visits high-energy ones with a Boltzmann weight. Quantum Metropolis reaches that state by proposing a reversible move and accepting it with a probability that enforces detailed balance. The twist is that the accept probability is not produced by a classical coin flip: it is encoded in the amplitude of an ancilla qubit and the move is applied conditionally, which is the subroutine that a quantum processor can implement more efficiently.",
        invariants: [
            "Each proposal is symmetric between neighboring levels, so the accept ratio depends only on the energy change.",
            "The accept ancilla amplitude squared equals the Metropolis acceptance probability.",
            "The distribution stays normalized and satisfies detailed balance at the Gibbs fixed point.",
        ],
        correctness:
            "For a symmetric proposal the Metropolis rule accepts a move from i to j with probability min of one and exp(-beta times the energy increase). Rotating an ancilla so that its one amplitude has squared magnitude equal to that probability and applying the proposal controlled on the ancilla reproduces the same transition probabilities as an ideal quantum accept step. The resulting chain has the Boltzmann distribution as its stationary distribution because pi_i times q_ij times A_ij equals pi_j times q_ji times A_ji for every pair, and the chain is irreducible on the connected line, so iterating converges to the Gibbs state.",
        complexityRationale:
            "Each step visits n levels and at most two neighbors each, costing O(n) time and O(n) space. A physical implementation replaces the exact ancilla rotation with phase estimation and amplitude amplification, changing the gate count but not this conceptual bound.",
        uses: [
            "Preparing thermal states for quantum simulation of materials and molecules",
            "Sampling Gibbs distributions when direct preparation is infeasible",
            "A teaching example of coherent accept or reject in a quantum walk",
        ],
        references: [
            "Temme, Kastoryano, Rieffel and Verstraete, Quantum Metropolis Sampling (2011)",
            "Nielsen and Chuang, Quantum Computation and Quantum Information (2010), Chapter 13",
        ],
        workedExample:
            "With levels of energy 0 and 1 at beta equal to one, moving uphill is accepted with probability exp(-1) about 0.368 while moving downhill is always accepted. Starting in the upper level, repeated proposals therefore drain probability into the lower level until the probabilities approach 0.731 and 0.269, the normalized Boltzmann weights.",
    },
    id: "quantum-metropolis",
    name: "Quantum Metropolis Sampling",
    category: "quantum",
    complexity: { time: "O(steps * n)", space: "O(n)" },
    defaultInput: { energies: [0, 1, 2], beta: 1.5, start: 0, steps: 30 },
    visualType: "array",
    run,
    pseudocode: [
        "read the energy levels, inverse temperature, and starting level",
        "prepare a point distribution at the starting energy",
        "compute the target Boltzmann weights for reference",
        "for each step propose a symmetric move to a neighboring level",
        "compute the Metropolis acceptance ratio from the energy change",
        "rotate an accept ancilla so its squared amplitude equals that ratio",
        "apply the proposal controlled on the ancilla and read the new energy",
        "report the distribution and its distance to the Gibbs state",
    ],
};

export default module;
