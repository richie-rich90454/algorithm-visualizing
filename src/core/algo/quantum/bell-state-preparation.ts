/**
 * bell-state-preparation.ts - Bell State Preparation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Bell state is a two-qubit entangled state that cannot be written as a
 * product of independent qubits. The standard circuit applies a Hadamard gate
 * to the first qubit and then a controlled-NOT with the first qubit as control
 * and the second as target. Starting from |00> this produces (|00> + |11>) /
 * square root of two, the Phi plus Bell state.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^n) for an n-qubit state vector; O(1) gates here
 *   Space: O(2^n) for the amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four bars show the amplitudes of |00>, |01>, |10>, and |11>.
 *   - The superposition after the Hadamard is yellow.
 *   - The entangled final state is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const INV_SQRT2 = Math.SQRT1_2;

/** Build amplitude bars for the four computational basis states. */
function makeBars(amplitudes: number[], state: EntityState = "idle"): VisualEntity[] {
    const labels = ["00", "01", "10", "11"];
    return amplitudes.map((amplitude, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: labels[index] ?? String(index),
        value: amplitude,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, basis: labels[index] ?? String(index) },
    }));
}

/** Apply Hadamard to the most significant qubit of a two-qubit state. */
function hadamardFirst(state: number[]): number[] {
    const next = [...state];
    for (let i = 0; i < 2; i += 1) {
        const a = state[i] ?? 0;
        const b = state[i + 2] ?? 0;
        next[i] = (a + b) * INV_SQRT2;
        next[i + 2] = (a - b) * INV_SQRT2;
    }
    return next;
}

/** Apply controlled-NOT with the first qubit as control and the second as target. */
function cnot(state: number[]): number[] {
    const next = [...state];
    for (let i = 2; i < 4; i += 1) {
        next[i] = state[i ^ 1] ?? 0;
    }
    next[0] = state[0] ?? 0;
    next[1] = state[1] ?? 0;
    return next;
}

/** The Bell state preparation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { initial?: string } | null) ?? {};
    const raw = typeof task.initial === "string" ? task.initial : "00";
    const bits = /^[01]{2}$/.test(raw) ? raw : "00";
    const index = Number.parseInt(bits, 2);
    const amplitudes = [0, 0, 0, 0];
    amplitudes[index] = 1;
    let state = [...amplitudes];

    yield {
        stepNumber: 0,
        entities: makeBars(state),
        edges: [],
        description: `Starting from the product state |${bits}>.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { amplitudes: [...state], probabilities: state.map((a) => a * a), gateCount: 0 },
    };

    state = hadamardFirst(state);
    yield {
        stepNumber: 1,
        entities: makeBars(state, "comparing"),
        edges: [],
        description: "Hadamard on the first qubit creates a superposition over both control values.",
        codeLineNumber: 2,
        layout: "array",
        meta: { amplitudes: [...state], probabilities: state.map((a) => a * a), gateCount: 1 },
    };

    state = cnot(state);
    yield {
        stepNumber: 2,
        entities: makeBars(state, "sorted"),
        edges: [],
        description: "Controlled-NOT flips the second qubit only when the first is one, producing a Bell state.",
        codeLineNumber: 4,
        layout: "array",
        meta: {
            amplitudes: [...state],
            probabilities: state.map((a) => a * a),
            gateCount: 2,
            entangled: true,
        },
    };
}

/** The Bell state preparation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Put the first qubit into an equal superposition, then make the second qubit flip only when the first is one. The two qubits are now linked: measuring one immediately determines the other, and the pair cannot be described by two independent states.",
        invariants: [
            "The sum of the four squared amplitudes is always one.",
            "The Hadamard gate acts only on the first qubit; controlled-NOT acts only when that qubit is one.",
            "The final state has support on either two matching basis states or two opposite ones.",
        ],
        correctness:
            "Starting from |00>, Hadamard gives (|00> plus |10>) over square root of two. Controlled-NOT leaves |00> alone and maps |10> to |11>, giving (|00> plus |11>) over square root of two. The resulting vector cannot be factored into a state of the first qubit times a state of the second, so it is entangled.",
        complexityRationale:
            "A state vector of two qubits has four amplitudes and each gate touches a constant number of them, giving O(1) time and O(1) space for this fixed example; the general n-qubit case is O(2^n).",
        uses: [
            "Quantum teleportation protocols",
            "Superdense coding",
            "Entanglement benchmarks and Bell inequality tests",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 2",
            "Bell, On the Einstein Podolsky Rosen Paradox, 1964",
        ],
        workedExample:
            "From |00> the amplitudes are (1, 0, 0, 0). After Hadamard on the first qubit they are (0.7071, 0, 0.7071, 0). Controlled-NOT swaps the last two entries, leaving (0.7071, 0, 0, 0.7071), the Phi plus Bell state.",
    },
    id: "bell-state-preparation",
    name: "Bell State Preparation",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { initial: "00" },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the two-qubit state vector from the input bits",
        "apply Hadamard to the first qubit",
        "combine amplitudes of matching target values",
        "apply controlled-NOT with the first qubit as control",
        "flip the target amplitude where the control is one",
        "done: report the entangled state and probabilities",
    ],
};

export default module;
