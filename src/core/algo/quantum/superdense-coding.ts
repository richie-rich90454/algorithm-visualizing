/**
 * superdense-coding.ts - Superdense Coding Protocol
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Superdense coding sends two classical bits using one qubit, provided the
 * sender and receiver share an entangled Bell pair in advance. Alice and Bob
 * share (|00> + |11>) / square root of two. Alice applies one of four single
 * qubit operations to her half to encode 00, 01, 10, or 11: identity, X, Z,
 * or X followed by Z. She sends her one qubit to Bob, who applies a controlled
 * NOT and a Hadamard to undo the entanglement. Measuring both qubits then
 * returns exactly the two bits Alice chose.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) gates on a four-amplitude state vector
 *   Space: O(1) for the fixed two-qubit state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the probabilities of the four basis states |00> through |11>.
 *   - The shared entangled state is highlighted after preparation.
 *   - The final frame is green and reports the decoded two-bit message.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const S = Math.SQRT1_2;

interface CodingInput {
    bits?: string;
}

/** Apply X (bit flip) to the first of two qubits. */
function xFirst(state: number[]): number[] {
    return [state[2] ?? 0, state[3] ?? 0, state[0] ?? 0, state[1] ?? 0];
}

/** Apply Z (phase flip) to the first of two qubits. */
function zFirst(state: number[]): number[] {
    return [state[0] ?? 0, state[1] ?? 0, -(state[2] ?? 0), -(state[3] ?? 0)];
}

/** Apply controlled NOT with the first qubit as control. */
function cnot(state: number[]): number[] {
    return [state[0] ?? 0, state[1] ?? 0, state[3] ?? 0, state[2] ?? 0];
}

/** Apply Hadamard to the first qubit. */
function hadamardFirst(state: number[]): number[] {
    const a0 = state[0] ?? 0;
    const a2 = state[2] ?? 0;
    const a1 = state[1] ?? 0;
    const a3 = state[3] ?? 0;
    return [
        (a0 + a2) * S,
        (a1 + a3) * S,
        (a0 - a2) * S,
        (a1 - a3) * S,
    ];
}

function makeBars(state: number[], highlight: EntityState = "idle"): VisualEntity[] {
    const labels = ["00", "01", "10", "11"];
    return state.map((amplitude, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `|${labels[index]}> ${(amplitude * amplitude).toFixed(3)}`,
        value: amplitude * amplitude,
        state: highlight,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, basis: labels[index] ?? String(index), amplitude },
    }));
}

/** The superdense coding generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CodingInput | null) ?? {};
    const raw = typeof task.bits === "string" ? task.bits : "10";
    const bits = /^[01]{2}$/.test(raw) ? raw : "10";
    const meta = (stage: string, state: number[], decoded: string, done: boolean) => ({
        bits,
        stage,
        amplitudes: [...state],
        probabilities: state.map((a) => a * a),
        norm: state.reduce((sum, a) => sum + a * a, 0),
        decoded,
        done,
    });

    let state = [S, 0, 0, S];

    yield {
        stepNumber: 0,
        entities: makeBars(state, "comparing"),
        edges: [],
        description: `Alice and Bob share the Bell pair (|00> + |11>)/sqrt(2); Alice will encode ${bits}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta("shared", state, "", false),
    };

    if (bits === "01") {
        state = xFirst(state);
    } else if (bits === "10") {
        state = zFirst(state);
    } else if (bits === "11") {
        state = zFirst(xFirst(state));
    }
    yield {
        stepNumber: 1,
        entities: makeBars(state, "active"),
        edges: [],
        description: `Alice applies the encoding for ${bits} to her qubit and sends it to Bob.`,
        codeLineNumber: 2,
        layout: "array",
        meta: meta("encoded", state, "", false),
    };

    state = cnot(state);
    yield {
        stepNumber: 2,
        entities: makeBars(state, "comparing"),
        edges: [],
        description: "Bob applies controlled NOT with Alice's qubit as control, splitting the Bell correlation.",
        codeLineNumber: 4,
        layout: "array",
        meta: meta("cnot", state, "", false),
    };

    state = hadamardFirst(state);
    yield {
        stepNumber: 3,
        entities: makeBars(state, "active"),
        edges: [],
        description: "Bob applies Hadamard to Alice's qubit, leaving a single computational basis state.",
        codeLineNumber: 5,
        layout: "array",
        meta: meta("hadamard", state, "", false),
    };

    const decoded = state.findIndex((a) => Math.abs(a) > 0.5).toString(2).padStart(2, "0");
    yield {
        stepNumber: 4,
        entities: makeBars(state, "sorted"),
        edges: [],
        description: `Bob measures and decodes the message ${decoded}, matching the two bits Alice encoded.`,
        codeLineNumber: 6,
        layout: "array",
        meta: meta("measured", state, decoded, true),
    };
}

/** The superdense coding module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Entanglement acts like a shared resource that doubles the classical capacity of a single qubit. Alice never sends two qubits; she changes only her half of a Bell pair in one of four ways and ships that one qubit. Because Bob already holds the other half, the joint state after Alice's operation is one of four orthogonal Bell states, which Bob can tell apart perfectly after undoing the entanglement.",
        invariants: [
            "The shared state starts as the Phi plus Bell state with exactly two nonzero amplitudes of magnitude 1/sqrt(2).",
            "The four encoding operations map it to four mutually orthogonal Bell states.",
            "Every gate preserves the total probability, which stays equal to one.",
        ],
        correctness:
            "Starting from (|00> + |11>)/sqrt(2), identity leaves Phi plus, X gives Psi plus, Z gives Phi minus, and X then Z gives minus Psi minus. These four states form an orthonormal basis of the two-qubit Hilbert space, so no information is lost. Bob's controlled NOT followed by Hadamard on the first qubit is the inverse Bell-preparation circuit: it maps Phi plus, Psi plus, Phi minus, and Psi minus to |00>, |01>, |10>, and |11> respectively. Measuring therefore recovers Alice's two bits with certainty.",
        complexityRationale:
            "The state vector has four amplitudes. Each gate touches a constant number of them and there are at most four gates, so time and space are both O(1). In general n Bell pairs would encode 2n classical bits with an exponential state description.",
        uses: [
            "Demonstrating entanglement as a communication resource",
            "Dense coding channels in quantum information theory",
            "A teaching bridge to quantum teleportation and quantum networks",
        ],
        references: [
            "Bennett and Wiesner, Communication via One- and Two-Particle Operators on Einstein-Podolsky-Rosen States, 1992",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 2",
        ],
        workedExample:
            "To send 10, Alice applies Z to her half of (|00> + |11>)/sqrt(2), producing (|00> - |11>)/sqrt(2). Bob's controlled NOT makes it (|00> - |10>)/sqrt(2); his Hadamard turns it into |10>. Measuring yields 10, exactly the encoded pair.",
    },
    id: "superdense-coding",
    name: "Superdense Coding",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { bits: "10" },
    visualType: "array",
    run,
    pseudocode: [
        "share a Bell pair between Alice and Bob",
        "Alice applies identity, X, Z, or XZ for bits 00, 01, 10, or 11",
        "Alice sends her single qubit to Bob",
        "Bob applies controlled NOT from Alice's qubit to his own",
        "Bob applies Hadamard to Alice's qubit",
        "measure both qubits in the computational basis",
        "done: report the two decoded classical bits",
    ],
};

export default module;
