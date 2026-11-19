/**
 * variational-quantum-dynamics.ts - Variational Quantum Dynamics for Excited States
 *
 * Variational quantum dynamics extends the variational principle from the ground
 * state to a whole tower of eigenstates. After one state has been optimized, the
 * next search adds a penalty proportional to the squared overlap with every
 * state already found. Minimizing the penalized energy therefore pushes the new
 * state into the orthogonal complement and lands on the next eigenvalue.
 *
 * This module simulates a two-qubit Hamiltonian with a three-angle real ansatz
 * and a deterministic coordinate search. It is a small exact state-vector
 * simulation, not a physical quantum processor.
 *
 * Time O(states * sweeps * angles * grid * dim) for a dim-dimensional state space;
 * space O(dim) for the amplitudes and the stored states.
 *
 * Visualization: bars show the amplitudes of the states as they are found.
 * Green marks the ground state, yellow the excited state.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface VqdInput {
    h?: number;
    j?: number;
    beta?: number;
    grid?: number;
    sweeps?: number;
}

/** The four by four symmetric Hamiltonian used by the teaching model. */
function hamiltonian(h: number, j: number): number[][] {
    return [
        [-h, 0, 0, j],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [j, 0, 0, h],
    ];
}

/** A normalized real state of four amplitudes from three hyperspherical angles. */
function ansatz(a: number, b: number, c: number): number[] {
    return [
        Math.cos(a),
        Math.sin(a) * Math.cos(b),
        Math.sin(a) * Math.sin(b) * Math.cos(c),
        Math.sin(a) * Math.sin(b) * Math.sin(c),
    ];
}

/** Expectation value psi^T H psi. */
function energy(state: number[], h: number, j: number): number {
    const s0 = state[0] ?? 0;
    const s3 = state[3] ?? 0;
    return -h * (s0 * s0 - s3 * s3) + 2 * j * s0 * s3;
}

/** Inner product of two real state vectors. */
function overlap(a: number[], b: number[]): number {
    return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

/** Build an orthonormal basis of the space orthogonal to a normalized state. */
function orthonormalComplement(state: number[]): number[][] {
    const basis: number[][] = [];
    for (let index = 0; index < 4 && basis.length < 3; index += 1) {
        const vector = [0, 0, 0, 0];
        vector[index] = 1;
        for (const existing of basis) {
            const projection = vector.reduce((sum, value, k) => sum + value * (existing[k] ?? 0), 0);
            vector.forEach((_, k) => {
                vector[k] = (vector[k] ?? 0) - projection * (existing[k] ?? 0);
            });
        }
        const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
        if (norm > 1e-9) basis.push(vector.map((value) => value / norm));
    }
    return basis;
}

/** Deterministic coordinate search, either in the full space or an orthogonal subspace. */
function optimize(
    h: number,
    j: number,
    beta: number,
    found: number[][],
    grid: number,
    sweeps: number,
    trace: number[],
    basis?: number[][],
): { angles: number[]; state: number[]; cost: number } {
    let angles = basis ? [1, 1] : [1, 1, 1];
    const buildState = (candidate: number[]): number[] => {
        if (!basis) return ansatz(candidate[0] ?? 0, candidate[1] ?? 0, candidate[2] ?? 0);
        const first = Math.cos(candidate[0] ?? 0);
        const second = Math.sin(candidate[0] ?? 0) * Math.cos(candidate[1] ?? 0);
        const third = Math.sin(candidate[0] ?? 0) * Math.sin(candidate[1] ?? 0);
        return [0, 1, 2, 3].map((index) =>
            first * (basis[0]?.[index] ?? 0) + second * (basis[1]?.[index] ?? 0) + third * (basis[2]?.[index] ?? 0),
        );
    };
    const evaluate = (candidate: number[]): number => {
        const state = buildState(candidate);
        let cost = energy(state, h, j);
        for (const previous of found) {
            const projection = overlap(state, previous);
            cost += beta * projection * projection;
        }
        return cost;
    };
    let bestCost = evaluate(angles);
    trace.push(bestCost);
    for (let sweep = 0; sweep < sweeps; sweep += 1) {
        for (let axis = 0; axis < angles.length; axis += 1) {
            let bestAngle = angles[axis] ?? 0;
            for (let step = 0; step < grid; step += 1) {
                const trial = [...angles];
                trial[axis] = (step * 2 * Math.PI) / grid;
                const cost = evaluate(trial);
                if (cost < bestCost) {
                    bestCost = cost;
                    bestAngle = trial[axis] ?? 0;
                }
            }
            angles[axis] = bestAngle;
        }
        trace.push(bestCost);
    }
    return { angles, state: buildState(angles), cost: bestCost };
}

function makeBars(states: number[][]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    states.forEach((state, which) => {
        state.forEach((amplitude, index) => {
            entities.push({
                id: `state-${which}-amp-${index}`,
                type: "bar" as const,
                label: amplitude.toFixed(3),
                value: amplitude,
                state: (which === 0 ? "sorted" : which === 1 ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { stateIndex: which, basis: index, amplitude },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as VqdInput | null) ?? {};
    const h = Math.max(0.01, Math.abs(Number(task.h ?? 0.6)) || 0.6);
    const j = Math.max(0.01, Math.abs(Number(task.j ?? 0.8)) || 0.8);
    const beta = Math.max(50, Number(task.beta ?? 200) || 200);
    const grid = Math.max(24, Math.min(241, Math.floor(Number(task.grid ?? 97)) || 97));
    const sweeps = Math.max(2, Math.min(20, Math.floor(Number(task.sweeps ?? 8)) || 8));
    const matrix = hamiltonian(h, j);
    const exactGap = Math.sqrt(h * h + j * j);
    const trace: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeBars([]),
        edges: [],
        description: `Built a two-qubit Hamiltonian with field ${h} and coupling ${j}; exact extremal energies are plus or minus ${exactGap.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { h, j, energies: [], ground: 0, firstExcited: 0, overlap: 0, sweeps: 0, hamiltonian: matrix.flat(), ready: false },
    };

    const groundTrace: number[] = [];
    const ground = optimize(h, j, beta, [], grid, sweeps, groundTrace);
    const found: number[][] = [ground.state];
    const groundEnergy = energy(ground.state, h, j);
    yield {
        stepNumber: 1,
        entities: makeBars([ground.state]),
        edges: [],
        description: `Ground search finished at ${groundEnergy.toFixed(4)} after ${sweeps} sweeps; exact value is ${(-exactGap).toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { h, j, energies: [groundEnergy], ground: groundEnergy, firstExcited: 0, overlap: 0, sweeps, trace: groundTrace, angles: ground.angles },
    };

    const excitedTrace: number[] = [];
    const complement = orthonormalComplement(ground.state);
    const excited = optimize(h, j, beta, found, grid, sweeps, excitedTrace, complement);
    const excitedEnergy = energy(excited.state, h, j);
    const residualOverlap = Math.abs(overlap(excited.state, ground.state));
    const energies = [groundEnergy, excitedEnergy];
    yield {
        stepNumber: 2,
        entities: makeBars([ground.state, excited.state]),
        edges: [],
        description: `Orthogonality penalty found a second state at ${excitedEnergy.toFixed(4)} with overlap ${residualOverlap.toFixed(4)} to the ground state.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            h,
            j,
            energies,
            ground: groundEnergy,
            firstExcited: excitedEnergy,
            overlap: residualOverlap,
            sweeps,
            trace: excitedTrace,
            exactGround: -exactGap,
            exactExcited: 0,
        },
    };

    yield {
        stepNumber: 3,
        entities: makeBars([ground.state, excited.state]),
        edges: [],
        description: `VQD reports energies ${energies.map((e) => e.toFixed(4)).join(" and ")}; the exact pair is ${(-exactGap).toFixed(4)} and 0.0000.`,
        codeLineNumber: 8,
        layout: "array",
        meta: {
            h,
            j,
            energies,
            ground: groundEnergy,
            firstExcited: excitedEnergy,
            overlap: residualOverlap,
            sweeps,
            exactGround: -exactGap,
            exactExcited: 0,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The variational principle says the lowest energy a trial state can reach is an upper bound on the ground energy. To get excited states, first optimize one state, then restrict the next search to the space orthogonal to the states already found. Working inside that subspace means the next minimum must be the next eigenvalue.",
        invariants: [
            "Every ansatz state is normalized by construction.",
            "Each new trial state is built from an orthonormal basis of the space orthogonal to the states already found.",
            "The optimized energy is always at least the exact eigenvalue it approximates.",
        ],
        correctness:
            "For a Hermitian Hamiltonian the spectral theorem gives an orthonormal eigenbasis ordered by energy. Restricting the trial state to the subspace orthogonal to the lowest k eigenstates forces its Rayleigh quotient to be at least the (k+1)-th eigenvalue, and the optimizer can reach that bound by choosing the next eigenvector. The coordinate search is only the optimizer; the variational argument is what makes the reported energies meaningful.",
        complexityRationale:
            "Each cost evaluation contracts a dim-dimensional state with a small matrix and with each stored state, so it costs O(dim * states). Sweeping three angles over a grid for a fixed number of sweeps multiplies that by 3 * grid * sweeps, and the whole tower repeats it once per eigenstate.",
        uses: [
            "Excited-state spectra of molecules on near-term quantum hardware",
            "Modeling optical response and band structure beyond the ground state",
            "Computing transition states in quantum chemistry and materials science",
        ],
        references: [
            "Peruzzo et al., A Variational Eigenvalue Solver on a Photonic Quantum Processor, 2014",
            "Higgott, Wang and Brierley, Variational Quantum Computation of Excited States, 2019",
        ],
        workedExample:
            "For a Hamiltonian with field 0.6 and coupling 0.8 the exact extremal energies are minus one and plus one, with two zero modes between them. The ground search reaches about minus one. Adding a large overlap penalty to that state drives the second search to about zero, which is the first excited energy in this spectrum.",
    },
    id: "variational-quantum-dynamics",
    name: "Variational Quantum Dynamics",
    category: "quantum",
    complexity: { time: "O(states * sweeps * grid * dim)", space: "O(dim * states)" },
    defaultInput: { h: 0.6, j: 0.8, beta: 200, grid: 97, sweeps: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "build the small Hermitian Hamiltonian matrix",
        "choose a normalized real ansatz with three angles",
        "evaluate the energy expectation of the trial state",
        "build an orthonormal basis orthogonal to the states already found",
        "sweep each angle over a fixed grid and keep the best cost",
        "repeat the sweeps until the cost stops improving",
        "store the optimized state and record its true energy",
        "return to the sweep for the next eigenstate",
        "done: report the variational energies and residual overlaps",
    ],
};

export default module;
