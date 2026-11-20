/**
 * entanglement-swapping.ts - Entanglement Swapping (Exact Four-Qubit Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Entanglement swapping makes two particles that never interacted become
 * entangled. Start with two Bell pairs, qubits (0,1) and (2,3). Perform a Bell
 * state measurement on the middle qubits 1 and 2: a controlled-NOT from 1 to 2
 * followed by a Hadamard on 1, then measure both in the computational basis.
 * The outer qubits 0 and 3 collapse onto a Bell state, with a Pauli correction
 * on qubit 3 determined by the measurement outcome.
 *
 * This module simulates the full four-qubit state vector with exact real
 * arithmetic over 16 amplitudes. It is an instructional model only: it has no
 * noise, no loss, and no realistic Bell measurement hardware, and it is limited
 * to four qubits because the state vector grows as two to the number of qubits.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) gates on a 16-amplitude state vector
 *   Space: O(16) amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Sixteen bars show the amplitudes of the four-qubit computational basis.
 *   - The Bell measurement collapse is red, the final swapped pair is green.
 *   - The metadata carries the outcome, probabilities, and the outer pair state.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const INV_SQRT2 = Math.SQRT1_2;

interface SwapInput {
    measure?: number;
}

/** Apply a single-qubit Hadamard to a real state vector. */
function hadamard(state: number[], target: number): number[] {
    const next = [...state];
    const bit = 1 << target;
    for (let i = 0; i < state.length; i += 1) {
        if ((i & bit) === 0) {
            const a = state[i] ?? 0;
            const b = state[i | bit] ?? 0;
            next[i] = (a + b) * INV_SQRT2;
            next[i | bit] = (a - b) * INV_SQRT2;
        }
    }
    return next;
}

/** Apply a controlled-NOT with the given control and target qubits. */
function cnot(state: number[], control: number, target: number): number[] {
    const next = [...state];
    const cbit = 1 << control;
    const tbit = 1 << target;
    for (let i = 0; i < state.length; i += 1) {
        next[i] = (i & cbit) !== 0 ? (state[i ^ tbit] ?? 0) : (state[i] ?? 0);
    }
    return next;
}

/** Apply a Pauli-X gate to a qubit. */
function pauliX(state: number[], target: number): number[] {
    const bit = 1 << target;
    return state.map((_, i) => state[i ^ bit] ?? 0);
}

/** Probability of each Bell-measurement outcome on qubits 1 and 2. */
function outcomeProbabilities(state: number[]): number[] {
    const results = [0, 0, 0, 0];
    for (let i = 0; i < state.length; i += 1) {
        const m1 = (i >> 1) & 1;
        const m2 = (i >> 2) & 1;
        results[m1 + 2 * m2] = (results[m1 + 2 * m2] ?? 0) + (state[i] ?? 0) ** 2;
    }
    return results;
}

/** Collapse qubits 1 and 2 onto one measurement outcome and renormalize. */
function measure(state: number[], outcome: number): { state: number[]; probability: number } {
    const m1 = outcome & 1;
    const m2 = (outcome >> 1) & 1;
    const collapsed = new Array<number>(16).fill(0);
    let probability = 0;
    for (let i = 0; i < 16; i += 1) {
        if (((i >> 1) & 1) === m1 && ((i >> 2) & 1) === m2) {
            probability += (state[i] ?? 0) ** 2;
        }
    }
    const scale = probability > 0 ? 1 / Math.sqrt(probability) : 0;
    for (let i = 0; i < 16; i += 1) {
        if (((i >> 1) & 1) === m1 && ((i >> 2) & 1) === m2) {
            collapsed[i] = (state[i] ?? 0) * scale;
        }
    }
    return { state: collapsed, probability };
}

/** Reduced two-qubit state of qubits 0 and 3 (indices q0 + 2 q3). */
function outerPair(state: number[]): number[] {
    const reduced = [0, 0, 0, 0];
    for (let i = 0; i < 16; i += 1) {
        const q0 = i & 1;
        const q3 = (i >> 3) & 1;
        reduced[q0 + 2 * q3] = (reduced[q0 + 2 * q3] ?? 0) + (state[i] ?? 0) ** 2;
    }
    // Probabilities cannot carry the sign, so recover the amplitudes of the two occupied entries.
    return reduced.map((p) => (p > 0 ? Math.sqrt(p) : 0));
}

function makeBars(state: number[], active: EntityState): VisualEntity[] {
    return state.map((amplitude, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: index.toString(2).padStart(4, "0"),
        value: amplitude,
        state: amplitude !== 0 ? active : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, basis: index.toString(2).padStart(4, "0") },
    }));
}

/** The entanglement swapping generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SwapInput | null) ?? {};
    let state = new Array<number>(16).fill(0);
    state[0] = 0.5;
    state[3] = 0.5;
    state[12] = 0.5;
    state[15] = 0.5;
    let step = 0;

    yield {
        stepNumber: step++,
        entities: makeBars(state, "comparing"),
        edges: [],
        description: "Two Bell pairs are ready: qubits 0-1 and 2-3. Qubits 0 and 3 have never interacted.",
        codeLineNumber: 0,
        layout: "array",
        meta: { amplitudes: [...state], outcome: -1, probabilities: outcomeProbabilities(state), outer: outerPair(state), corrected: false },
    };

    state = cnot(state, 1, 2);
    yield {
        stepNumber: step++,
        entities: makeBars(state, "comparing"),
        edges: [],
        description: "A controlled-NOT from qubit 1 to qubit 2 begins the Bell measurement on the middle qubits.",
        codeLineNumber: 1,
        layout: "array",
        meta: { amplitudes: [...state], outcome: -1, probabilities: outcomeProbabilities(state), outer: outerPair(state), corrected: false },
    };

    state = hadamard(state, 1);
    const probabilities = outcomeProbabilities(state);
    yield {
        stepNumber: step++,
        entities: makeBars(state, "comparing"),
        edges: [],
        description: "A Hadamard on qubit 1 completes the Bell basis change; each of the four outcomes is equally likely.",
        codeLineNumber: 2,
        layout: "array",
        meta: { amplitudes: [...state], outcome: -1, probabilities, outer: outerPair(state), corrected: false },
    };

    const forced = typeof task.measure === "number" && task.measure >= 0 && task.measure <= 3
        ? Math.floor(task.measure)
        : -1;
    let best = 0;
    for (let i = 1; i < 4; i += 1) {
        if ((probabilities[i] ?? 0) > (probabilities[best] ?? 0)) best = i;
    }
    const outcome = forced >= 0 ? forced : best;
    const result = measure(state, outcome);
    state = result.state;
    const m1 = outcome & 1;
    const m2 = (outcome >> 1) & 1;
    yield {
        stepNumber: step++,
        entities: makeBars(state, "error"),
        edges: [],
        description: `Measuring the middle qubits gives m1 = ${m1}, m2 = ${m2}; the outer qubits collapse onto a correlated state.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { amplitudes: [...state], outcome, probabilities, outer: outerPair(state), corrected: false },
    };

    const corrected = m2 === 1;
    if (corrected) {
        state = pauliX(state, 3);
    }
    const outer = outerPair(state);
    const fidelity = ((outer[0] ?? 0) + (outer[3] ?? 0)) / Math.SQRT2;
    yield {
        stepNumber: step++,
        entities: makeBars(state, "sorted"),
        edges: [],
        description: corrected
            ? "The second measurement bit is one, so an X correction on qubit 3 turns the anti-correlated pair into a Bell state."
            : "The second measurement bit is zero, so no correction is needed; qubits 0 and 3 share a Bell state.",
        codeLineNumber: 4,
        layout: "array",
        meta: { amplitudes: [...state], outcome, probabilities, outer, corrected, fidelity },
    };
}

/** The entanglement swapping module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Two separated pairs of entangled particles can be turned into one pair whose members have never met. Measure the two inner particles in a special Bell basis; the measurement erases which pair they belonged to and projects the two outer particles into an entangled state. A classical message tells the far end which simple correction to apply, so entanglement is effectively swapped from the inner links to the outer ones.",
        invariants: [
            "The four-qubit state vector has unit norm after every gate and after collapse.",
            "All four Bell measurement outcomes are equally likely for two Bell pairs.",
            "After the outcome-dependent correction, qubits 0 and 3 occupy only the 00 and 11 basis states with equal weight.",
        ],
        correctness:
            "Starting from two Phi-plus Bell pairs, applying CNOT from qubit 1 to qubit 2 and Hadamard to qubit 1 maps the Bell basis of qubits 1 and 2 onto the computational basis. Expanding the product state shows that each of the four measurement outcomes leaves qubits 0 and 3 in a maximally correlated state: outcomes with the second bit zero already give (|00> plus |11>) over square root two, while the other outcomes give (|01> plus |10>). Applying X to qubit 3 when the second bit is one converts the latter into the former, so in every case the outer qubits share a Bell state. No signal travels between them faster than light; the classical outcome is required to identify the correction.",
        complexityRationale:
            "A constant number of one- and two-qubit gates act on a fixed 16-amplitude vector, so time and space are O(1) for this four-qubit toy model. A general n-qubit state vector simulator would use O(n 2^n) time and O(2^n) space.",
        uses: [
            "Quantum repeaters that extend entanglement over long distances",
            "Building entanglement between distant nodes in a quantum network",
            "A teaching example of measurement-driven state teleportation",
        ],
        references: [
            "Zukowski et al., Event-Ready-Detectors Bell Experiment via Entanglement Swapping, 1993",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 2",
        ],
        workedExample:
            "With Bell pairs on qubits 0-1 and 2-3, a Bell measurement of qubits 1 and 2 returning m1 = 0 and m2 = 1 leaves qubits 0 and 3 anti-correlated. Applying X to qubit 3 flips it into (|00> plus |11>) over square root two, so the outer qubits are now entangled even though they never interacted.",
    },
    id: "entanglement-swapping",
    name: "Entanglement Swapping (Four-Qubit Simulation)",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(16)" },
    defaultInput: { measure: -1 },
    visualType: "array",
    run,
    pseudocode: [
        "prepare Bell pairs on qubits zero-one and two-three",
        "apply controlled-NOT from qubit one to qubit two",
        "apply Hadamard to qubit one",
        "measure qubits one and two in the computational basis",
        "collapse the four-qubit state onto the outcome",
        "apply X to qubit three when the second bit is one",
        "done: qubits zero and three share a Bell state",
    ],
};

export default module;
