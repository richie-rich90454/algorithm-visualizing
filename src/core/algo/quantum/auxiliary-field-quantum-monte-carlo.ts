/**
 * auxiliary-field-quantum-monte-carlo.ts - Auxiliary-Field Quantum Monte Carlo
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Auxiliary-field quantum Monte Carlo projects out a ground state by evolving
 * a trial state in imaginary time. A Trotter step splits the evolution into
 * one-body parts and a two-body part; the two-body exponential is rewritten
 * with a Hubbard-Stratonovich identity as an average over discrete auxiliary
 * fields, each of which turns the remaining evolution into a one-body problem.
 * Sampling those fields and averaging the projected energy estimates the ground
 * state energy.
 *
 * This is an exact small simulation for a two-qubit attractive Ising model with
 * a transverse field. It enumerates every auxiliary-field configuration for a
 * few time slices using real arithmetic, so the average is exact for that
 * Trotter grid. It does not model a fault-tolerant quantum processor, random
 * sampling error beyond the enumerated grid, or a general lattice model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^slices * slices * dim) for dim equal to four
 *   Space: O(dim) for a single projected state vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the state vector after each auxiliary-field configuration.
 *   - The final bars show the energy estimate contributed by each path.
 *   - meta carries the fields, energies, and the averaged estimate.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AfqmcInput {
    transverseField?: number;
    interaction?: number;
    dt?: number;
    slices?: number;
}

type State = number[];

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        const state: EntityState = done ? "sorted" : index === active ? "active" : "visited";
        return {
            id: `value-${index}`,
            type: "bar" as const,
            label: value.toFixed(4),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value },
        };
    });
}

/** Apply exp(-a X) to the qubit whose bit position is `shift`. */
function applyX(state: State, shift: number, a: number): State {
    const next = [...state];
    const c = Math.cosh(a);
    const s = Math.sinh(a);
    for (let index = 0; index < state.length; index += 1) {
        if (((index >> shift) & 1) !== 0) {
            continue;
        }
        const partner = index | (1 << shift);
        const left = state[index] ?? 0;
        const right = state[partner] ?? 0;
        next[index] = c * left - s * right;
        next[partner] = c * right - s * left;
    }
    return next;
}

/** Apply the diagonal one-body Hubbard-Stratonovich factor for field sign. */
function applyField(state: State, sign: number, gamma: number): State {
    return state.map((value, index) => {
        const z0 = ((index >> 1) & 1) === 0 ? 1 : -1;
        const z1 = (index & 1) === 0 ? 1 : -1;
        return value * Math.exp(gamma * sign * (z0 + z1));
    });
}

/** Expectation of H = h(X0 + X1) - U Z0 Z1 in a real state. */
function energyOf(state: State, h: number, u: number): number {
    let numerator = 0;
    let norm = 0;
    for (let index = 0; index < state.length; index += 1) {
        const value = state[index] ?? 0;
        norm += value * value;
        const z0 = ((index >> 1) & 1) === 0 ? 1 : -1;
        const z1 = (index & 1) === 0 ? 1 : -1;
        numerator += -u * z0 * z1 * value * value;
        for (const shift of [0, 1]) {
            const partner = index ^ (1 << shift);
            if (partner > index) {
                numerator += 2 * h * value * (state[partner] ?? 0);
            }
        }
    }
    return norm > 1e-14 ? numerator / norm : 0;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AfqmcInput | null) ?? {};
    const h = Math.max(0.05, Number(task.transverseField ?? 1) || 1);
    const u = Math.max(0.05, Number(task.interaction ?? 0.5) || 0.5);
    const dt = Math.max(0.001, Math.min(0.2, Number(task.dt ?? 0.05) || 0.05));
    const slices = Math.min(4, Math.max(1, Math.floor(Number(task.slices ?? 2)) || 2));
    const configurations = 2 ** slices;
    const initial: State = [0.5, 0.5, 0.5, 0.5];
    const gamma = Math.acosh(Math.exp(2 * dt * u)) / 2;
    const constant = Math.exp(-dt * u) / 2;
    const energies: number[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(initial, -1, false),
        edges: [],
        description: `Projecting the ground state of a two-qubit transverse-field Ising model with ${slices} imaginary-time slice(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { h, u, dt, slices, configurations, gamma, energies: [], averageEnergy: 0, done: false },
    };
    step += 1;

    for (let configuration = 0; configuration < configurations; configuration += 1) {
        let state: State = [...initial];
        const fields: number[] = [];
        for (let slice = 0; slice < slices; slice += 1) {
            const sign = ((configuration >> slice) & 1) === 0 ? 1 : -1;
            fields.push(sign);
            state = applyX(state, 0, dt * h);
            state = applyX(state, 1, dt * h);
            state = applyField(state, sign, gamma).map((value) => value * constant);
        }
        const projectedEnergy = energyOf(state, h, u);
        energies.push(projectedEnergy);
        yield {
            stepNumber: step,
            entities: makeBars(state, -1, false),
            edges: [],
            description: `Field path [${fields.join(", ")}] gives a projected energy of ${projectedEnergy.toFixed(6)}.`,
            codeLineNumber: fields.length === 1 ? 3 : 4,
            layout: "array",
            meta: { h, u, dt, slices, configurations, gamma, fields, energies: [...energies], averageEnergy: energies.reduce((a, b) => a + b, 0) / energies.length, done: false },
        };
        step += 1;
    }

    const averageEnergy = energies.reduce((sum, value) => sum + value, 0) / energies.length;
    yield {
        stepNumber: step,
        entities: makeBars(energies, -1, true),
        edges: [],
        description: `Averaged ${configurations} auxiliary-field paths: ground-state energy estimate ${averageEnergy.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { h, u, dt, slices, configurations, gamma, energies, averageEnergy, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imaginary-time evolution damps excited states and leaves the ground state, but the two-body part of the Hamiltonian couples qubits and is awkward to apply. The Hubbard-Stratonovich trick replaces that coupling by an average over simple one-body problems, each labeled by an auxiliary field. Evolving the trial state along each field path and averaging the energies gives the ground-state energy without storing the full many-body operator.",
        invariants: [
            "The Trotter step is a product of one-body exponentials and one diagonal field factor.",
            "Every auxiliary-field path is a valid one-body evolution of the trial state.",
            "The final estimate is the average of the Rayleigh quotient over all enumerated paths.",
        ],
        correctness:
            "For the attractive two-qubit Ising coupling, the Hubbard-Stratonovich identity rewrites the diagonal two-body exponential as an average over discrete fields with real coefficients, which is exact because the two-body operator is diagonal with only two eigenvalues. Strang-free first-order Trotter splitting introduces an error of order dt per step, and enumerating every field configuration removes sampling variance entirely. The Rayleigh quotient of any evolved state is at least the true ground energy, and as the time grid is refined the averaged estimate converges to it.",
        complexityRationale:
            "There are two to the power slices field paths, each applying a constant number of four-component state updates per slice, so the run is O(2^slices times slices times dim) with dim four. Only one state vector and the list of path energies are stored, giving O(dim) working space.",
        uses: [
            "Ground-state energy estimation for interacting lattice models",
            "Electronic structure and condensed-matter simulation",
            "A teaching model for auxiliary-field and determinant Monte Carlo methods",
        ],
        references: [
            "Blankenbecler, Scalapino and Sugar, Monte Carlo Calculations of Coupled Boson-Fermion Systems, 1981",
            "Foulkes et al., Quantum Monte Carlo Methods for Systems of Interacting Electrons, 2001",
        ],
        workedExample:
            "With transverse field 1, attractive coupling 0.5, dt 0.05 and two slices, there are four field paths. Each path applies the transverse-field rotations followed by a diagonal field update, and the four projected energies are averaged. The result approaches the lowest eigenvalue of the four by four Hamiltonian as dt is reduced.",
    },
    id: "auxiliary-field-quantum-monte-carlo",
    name: "Auxiliary-Field Quantum Monte Carlo",
    category: "quantum",
    complexity: { time: "O(2^slices * slices * dim)", space: "O(dim)" },
    defaultInput: {
        transverseField: 1,
        interaction: 0.5,
        dt: 0.05,
        slices: 2,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the trial state and the time step",
        "compute the Hubbard-Stratonovich field strength",
        "for every auxiliary-field path",
        "apply the one-body imaginary-time exponentials",
        "apply the diagonal factor for the sampled field",
        "record the projected energy of the evolved state",
        "average all path energies to estimate the ground state",
        "done: report the estimate and its convergence grid",
    ],
};

export default module;
