/**
 * gibbs-state-preparation.ts - Exact Gibbs State Preparation (small model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Gibbs (thermal) state assigns each energy eigenstate of a Hamiltonian a
 * probability proportional to exp(-beta * energy), where beta is the inverse
 * temperature. Preparing that state is a basic primitive in quantum simulation
 * and optimization. This module constructs the thermal distribution exactly by
 * spectral decomposition: it reads the energy levels, forms the Boltzmann
 * weights, normalizes by the partition function, and reports the resulting
 * state together with its mean energy and entropy.
 *
 * Limits: the simulation is exact for diagonal Hamiltonians with at most 16
 * energy levels (four qubits). It does not synthesize a circuit, include
 * coherences, or model a thermalizing bath and its dynamics.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L) for L energy levels
 *   Space: O(L) for the probability vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the population of each energy level.
 *   - The ground-state bar is gold; after normalization it turns green.
 *   - meta carries energies, probabilities, partition function, and statistics.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], ground: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (index === ground) {
            state = done ? "sorted" : "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(4),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, level: index, population: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { energies?: number[]; beta?: number } | null) ?? {};
    const raw = Array.isArray(task.energies) ? task.energies.map((v) => Number(v)) : [];
    const energies = raw.length > 0 ? raw.slice(0, 16) : [0, 0.5, 1, 1.5];
    const beta = Math.max(0, Number.isFinite(Number(task.beta)) ? Number(task.beta) : 1.5);
    const levels = energies.length;

    let ground = 0;
    for (let i = 1; i < levels; i += 1) {
        if ((energies[i] ?? 0) < (energies[ground] ?? 0)) ground = i;
    }
    const minEnergy = energies[ground] ?? 0;
    const weights = energies.map((energy) => Math.exp(-beta * ((energy ?? 0) - minEnergy)));
    const partition = weights.reduce((sum, value) => sum + value, 0);
    const probabilities = weights.map((value) => value / partition);
    const meanEnergy = probabilities.reduce((sum, p, i) => sum + p * (energies[i] ?? 0), 0);
    let entropy = 0;
    for (const p of probabilities) {
        if (p > 0) entropy -= p * Math.log(p);
    }

    const metaFor = (phase: string) => ({
        phase,
        levels,
        beta,
        energies: energies.slice(),
        probabilities: probabilities.slice(),
        partition,
        meanEnergy,
        entropy,
        groundIndex: ground,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(Array.from({ length: levels }, () => 1 / levels), ground, false),
        edges: [],
        description: `Infinite-temperature reference: ${levels} level(s) are equally likely before cooling.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor("uniform"),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(weights, ground, false),
        edges: [],
        description: `Apply Boltzmann factors exp(-beta times energy) with beta = ${beta.toFixed(3)}; partition function is ${partition.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: metaFor("boltzmann"),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, ground, true),
        edges: [],
        description: `Normalize the weights; level ${ground} has the largest population ${(probabilities[ground] ?? 0).toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: metaFor("normalized"),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, ground, true),
        edges: [],
        description: `Thermal state ready: mean energy ${meanEnergy.toFixed(4)} and entropy ${entropy.toFixed(4)} at beta ${beta.toFixed(3)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: metaFor("complete"),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A thermal state favors low energy but does not always sit in the ground state. The Boltzmann rule gives each level a weight that decays exponentially with its energy and temperature, and dividing by the total weight makes those numbers probabilities. At infinite temperature all levels are equal; as the system cools, probability piles into the ground state.",
        invariants: [
            "All probabilities are nonnegative and sum to one.",
            "For positive beta, lower energy always has at least as much population as higher energy.",
            "Shifting every energy by a constant leaves the probabilities unchanged because the shift cancels in normalization.",
        ],
        correctness:
            "By definition the Gibbs state of H is exp(-beta H) divided by its trace. When H is diagonal in the measured basis, exp(-beta H) is diagonal with entries exp(-beta E_i), so the normalized diagonal is exactly the Boltzmann distribution computed here. The trace is the partition function Z, and the standard identities for Z give the reported mean energy and entropy, so the constructed distribution is the unique thermal state for this Hamiltonian.",
        complexityRationale:
            "Each level needs one exponential and a few accumulations, so the time is O(L) for L levels. Only the weight and probability vectors are stored, giving O(L) space.",
        uses: [
            "Initializing thermal states in quantum simulation and annealing",
            "Modeling equilibrium occupation of molecular energy levels",
            "Boltzmann sampling in machine learning and statistical mechanics",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 2",
            "Kardar, Statistical Physics of Particles, Chapter 3",
        ],
        workedExample:
            "For energies 0 and 1 at beta equal to one, the weights are 1 and exp(-1) about 0.368. The partition function is 1.368, giving probabilities about 0.731 and 0.269, mean energy about 0.269, and entropy about 0.553 natural units.",
    },
    id: "gibbs-state-preparation",
    name: "Gibbs State Preparation",
    category: "quantum",
    complexity: { time: "O(L)", space: "O(L)" },
    defaultInput: { energies: [0, 0.5, 1, 1.5], beta: 1.5 },
    visualType: "array",
    run,
    pseudocode: [
        "read the energy levels and choose inverse temperature beta",
        "find the minimum energy and shift levels by it",
        "form each Boltzmann weight exp(-beta times shifted energy)",
        "sum the weights to obtain the partition function",
        "divide each weight by the partition function",
        "compute mean energy and entropy of the distribution",
        "done: report the thermal populations",
    ],
};

export default module;
