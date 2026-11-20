/**
 * unitary-coupled-cluster.ts - Unitary Coupled Cluster State Preparation (exact small model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Unitary coupled cluster prepares a correlated quantum state by applying the
 * exponential of an anti-Hermitian excitation generator to a reference state.
 * A single excitation between two orbitals rotates the pair of occupations
 * |10> and |01> by an angle equal to the cluster amplitude, leaving all other
 * determinants untouched. Because the generator is anti-Hermitian, the
 * exponential is exactly unitary and preserves the norm of the state.
 *
 * This module simulates disjoint single excitations on at most six qubits by
 * the closed-form two-dimensional rotation of each excitation. It is a teaching
 * model: it omits double excitations, fermionic sign strings, and hardware
 * noise, and assumes the chosen excitation pairs act on disjoint qubits.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(excitations * 2^n) for the rotations on an n-qubit register
 *   Space: O(2^n) for the state vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the probability of each occupation determinant.
 *   - The reference determinant is yellow; the correlated result is green.
 *   - meta carries the amplitudes, cluster angles, norm, and energy expectation.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(probabilities: number[], state: EntityState, peak: number): VisualEntity[] {
    return probabilities.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: index === peak ? state : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** Apply exp(theta (sigma+_i sigma-_j - sigma-_i sigma+_j)) to a real state. */
function applyExcitation(state: number[], qubits: number, i: number, j: number, theta: number): void {
    const dimension = 1 << qubits;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const bitI = 1 << i;
    const bitJ = 1 << j;
    const handled = new Set<number>();
    for (let index = 0; index < dimension; index += 1) {
        const bitAtI = ((index & bitI) !== 0 ? 1 : 0);
        const bitAtJ = ((index & bitJ) !== 0 ? 1 : 0);
        if (bitAtI === bitAtJ || handled.has(index)) continue;
        const partner = index ^ bitI ^ bitJ;
        const a = state[index] ?? 0;
        const b = state[partner] ?? 0;
        if (bitAtI === 1) {
            state[index] = cos * a + sin * b;
            state[partner] = -sin * a + cos * b;
        } else {
            state[partner] = cos * b + sin * a;
            state[index] = -sin * b + cos * a;
        }
        handled.add(index);
        handled.add(partner);
    }
}

/** Expectation of sum 0.5 Z_i plus sum 0.5 X_i X_j over the excitation pairs. */
function energy(state: number[], qubits: number, excitations: number[][]): number {
    const dimension = 1 << qubits;
    let total = 0;
    for (let index = 0; index < dimension; index += 1) {
        const amplitude = state[index] ?? 0;
        for (let qubit = 0; qubit < qubits; qubit += 1) {
            const sign = ((index >> qubit) & 1) === 0 ? 1 : -1;
            total += 0.5 * sign * amplitude * amplitude;
        }
    }
    for (const excitation of excitations) {
        const i = excitation[0] ?? 0;
        const j = excitation[1] ?? 0;
        for (let index = 0; index < dimension; index += 1) {
            const a = state[index] ?? 0;
            const b = state[index ^ (1 << i) ^ (1 << j)] ?? 0;
            total += 0.5 * a * b;
        }
    }
    return total;
}

/** Prepare a unitary coupled cluster state from a single Slater determinant. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { qubits?: number; reference?: string; excitations?: number[][]; thetas?: number[] } | null
    ) ?? {};
    const qubits = Math.min(6, Math.max(2, typeof task.qubits === "number" ? Math.floor(task.qubits) : 2));
    const reference = typeof task.reference === "string" && task.reference.length === qubits ? task.reference : "10";
    const excitations: number[][] = Array.isArray(task.excitations) && task.excitations.length > 0
        ? task.excitations.map((pair) => [Number(pair?.[0]) || 0, Number(pair?.[1]) || 0])
        : [[0, 1]];
    const thetas: number[] = Array.isArray(task.thetas) && task.thetas.length === excitations.length
        ? task.thetas.map((value) => Number(value) || 0)
        : excitations.map((_, index) => (index === 0 ? 0.7 : 0.4));

    const dimension = 1 << qubits;
    const state: number[] = Array.from({ length: dimension }, () => 0);
    let referenceIndex = 0;
    for (let qubit = 0; qubit < qubits; qubit += 1) {
        if (reference[qubit] === "1") referenceIndex |= 1 << qubit;
    }
    state[referenceIndex] = 1;
    const probabilities = (): number[] => state.map((value) => value * value);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(), "comparing", referenceIndex),
        edges: [],
        description: `Preparing the Hartree-Fock reference determinant |${reference}>.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { qubits, reference, applied: 0, norm: 1, clusterEnergy: energy(state, qubits, excitations), thetas, amplitudes: [...state] },
    };
    step += 1;

    for (let index = 0; index < excitations.length; index += 1) {
        const excitation = excitations[index]!;
        applyExcitation(state, qubits, excitation[0] ?? 0, excitation[1] ?? 0, thetas[index] ?? 0);
        const norm = Math.sqrt(state.reduce((sum, value) => sum + value * value, 0));
        yield {
            stepNumber: step,
            entities: makeBars(probabilities(), "comparing", -1),
            edges: [],
            description: `Applied excitation ${index + 1} on orbitals ${excitation[0]} and ${excitation[1]} with amplitude ${(thetas[index] ?? 0).toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { qubits, reference, applied: index + 1, norm, clusterEnergy: energy(state, qubits, excitations), thetas, amplitudes: [...state] },
        };
        step += 1;
    }

    const norm = Math.sqrt(state.reduce((sum, value) => sum + value * value, 0));
    let peak = 0;
    for (let index = 1; index < dimension; index += 1) {
        if ((state[index] ?? 0) > (state[peak] ?? 0)) peak = index;
    }
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(), "sorted", peak),
        edges: [],
        description: `Correlated state normalized to ${norm.toFixed(8)} with cluster energy ${energy(state, qubits, excitations).toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { qubits, reference, applied: excitations.length, norm, clusterEnergy: energy(state, qubits, excitations), thetas, amplitudes: [...state] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single reference determinant misses electron correlation. Coupled cluster dresses it by applying the exponential of an excitation operator that promotes occupied orbitals into virtual ones. Making the operator anti-Hermitian turns the exponential into a rotation, so the result is always a valid normalized quantum state and can be prepared on a quantum processor.",
        invariants: [
            "The excitation generator is anti-Hermitian, so its exponential is unitary.",
            "A single excitation only mixes determinants that differ by that pair of occupations.",
            "The state vector stays normalized after every excitation.",
        ],
        correctness:
            "For a single excitation the generator acts only on the two-dimensional span of the determinants |10> and |01> as the real skew-symmetric matrix with off-diagonal entries minus one plus one. Its matrix exponential is the rotation by the cluster amplitude, which the module applies directly. Because disjoint excitations commute, applying their rotations in sequence equals the exponential of the sum, and each rotation preserves the Euclidean norm. The reported energy is the expectation value of the chosen model Hamiltonian in that normalized state.",
        complexityRationale:
            "Each excitation visits the 2 to the n determinants once, costing O(excitations times 2 to the n) time. The state vector and the amplitude list use O(2 to the n) space.",
        uses: [
            "Preparing trial states for the variational quantum eigensolver",
            "Quantum chemistry simulations of molecular ground states",
            "A benchmark for fermionic excitation circuits on quantum hardware",
        ],
        references: [
            "Peruzzo et al., A Variational Eigenvalue Solver on a Quantum Processor, 2014",
            "Lee and Huggins, Unitary Coupled Cluster Methods, 2019",
        ],
        workedExample:
            "On two qubits with reference |10> and cluster amplitude theta, the state becomes cos theta times |10> minus sin theta times |01>. At theta equal to pi over two it is exactly minus |01>, showing the excitation has fully swapped the occupation. The norm stays one throughout.",
    },
    id: "unitary-coupled-cluster",
    name: "Unitary Coupled Cluster State Preparation",
    category: "quantum",
    complexity: { time: "O(excitations * 2^n) simulated", space: "O(2^n) simulated" },
    defaultInput: { qubits: 2, reference: "10", excitations: [[0, 1]], thetas: [0.7] },
    visualType: "array",
    run,
    pseudocode: [
        "prepare the reference Slater determinant with unit amplitude",
        "for each single excitation build its anti-Hermitian generator",
        "restrict the generator to the pair of determinants it mixes",
        "apply the closed-form rotation by the cluster amplitude",
        "renormalize and accumulate the energy expectation",
        "select the determinant with the largest probability",
        "done: report the correlated state, norm, and energy",
    ],
};

export default module;
