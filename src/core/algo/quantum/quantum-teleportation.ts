/**
 * quantum-teleportation.ts - Quantum Teleportation of One Qubit (Toy Simulator)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quantum teleportation transfers the state of one qubit to a distant qubit
 * using a shared Bell pair and two classical bits. Alice entangles her half of
 * the pair with the input qubit, measures both of her qubits, and sends the two
 * bits to Bob. Bob applies a conditional X and Z gate to his qubit and obtains
 * the original state. This module simulates a three-qubit state vector with
 * exact real arithmetic; it is a small instructional model, not a physical
 * quantum device or a fault-tolerant implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) gates on an 8-amplitude state vector
 *   Space: O(8) amplitudes for the three qubits
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Eight bars show the amplitudes of the three-qubit computational basis.
 *   - Alice's operations are yellow, the collapse is red, Bob's fix is green.
 *   - Measurement bits and the recovered qubit are reported in the metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const INV_SQRT2 = Math.SQRT1_2;

/** Build eight amplitude bars, one per three-qubit basis state. */
function makeBars(state: number[], active: EntityState = "idle"): VisualEntity[] {
    return state.map((amplitude, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: index.toString(2).padStart(3, "0"),
        value: amplitude,
        state: amplitude !== 0 ? active : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, basis: index.toString(2).padStart(3, "0") },
    }));
}

/** Apply a single-qubit Hadamard gate to a real state vector. */
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

/** Apply a controlled-NOT gate with the given control and target qubits. */
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

/** Apply a Pauli-Z gate to a qubit. */
function pauliZ(state: number[], target: number): number[] {
    const bit = 1 << target;
    return state.map((value, i) => ((i & bit) !== 0 ? -value : value));
}

/** Collapse qubits zero and one onto the chosen outcome and renormalize. */
function measure(state: number[], outcome: number): { state: number[]; probability: number } {
    const kept = [0, 1].map((q2) => state[(q2 << 2) | outcome] ?? 0);
    const probability = kept.reduce((sum, a) => sum + a * a, 0);
    const scale = probability > 0 ? 1 / Math.sqrt(probability) : 0;
    const collapsed = new Array<number>(8).fill(0);
    collapsed[outcome] = (kept[0] ?? 0) * scale;
    collapsed[(1 << 2) | outcome] = (kept[1] ?? 0) * scale;
    return { state: collapsed, probability };
}

/** The teleportation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { alpha?: number; beta?: number; measure?: number } | null) ?? {};
    let alpha = typeof task.alpha === "number" ? task.alpha : INV_SQRT2;
    let beta = typeof task.beta === "number" ? task.beta : INV_SQRT2;
    const norm = Math.hypot(alpha, beta);
    if (norm === 0 || !Number.isFinite(norm)) {
        alpha = INV_SQRT2;
        beta = INV_SQRT2;
    } else {
        alpha /= norm;
        beta /= norm;
    }

    let state = new Array<number>(8).fill(0);
    state[0] = alpha;
    state[1] = beta;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(state, "comparing"),
        edges: [],
        description: `Qubit zero holds alpha|0> + beta|1> with amplitudes ${alpha.toFixed(4)} and ${beta.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { amplitudes: [...state], gateCount: 0, measured: -1 },
    };
    step += 1;

    state = hadamard(state, 1);
    state = cnot(state, 1, 2);
    yield {
        stepNumber: step,
        entities: makeBars(state, "comparing"),
        edges: [],
        description: "A Hadamard and a controlled-NOT entangle qubits one and two into a Bell pair.",
        codeLineNumber: 2,
        layout: "array",
        meta: { amplitudes: [...state], gateCount: 2, measured: -1 },
    };
    step += 1;

    state = cnot(state, 0, 1);
    state = hadamard(state, 0);
    yield {
        stepNumber: step,
        entities: makeBars(state, "comparing"),
        edges: [],
        description: "Alice entangles the input qubit with her Bell qubit and spreads the phase into her first qubit.",
        codeLineNumber: 3,
        layout: "array",
        meta: { amplitudes: [...state], gateCount: 4, measured: -1 },
    };
    step += 1;

    const probabilities = [0, 1, 2, 3].map((outcome) =>
        [0, 1].reduce((sum, q2) => {
            const amplitude = state[(q2 << 2) | outcome] ?? 0;
            return sum + amplitude * amplitude;
        }, 0),
    );
    const forced =
        typeof task.measure === "number" && task.measure >= 0 && task.measure <= 3
            ? Math.floor(task.measure)
            : -1;
    let best = 0;
    for (let i = 1; i < 4; i += 1) {
        if ((probabilities[i] ?? 0) > (probabilities[best] ?? 0)) {
            best = i;
        }
    }
    const outcome = forced >= 0 ? forced : best;
    const result = measure(state, outcome);
    state = result.state;
    const m0 = outcome & 1;
    const m1 = (outcome >> 1) & 1;
    yield {
        stepNumber: step,
        entities: makeBars(state, "error"),
        edges: [],
        description: `Alice measures bits m0=${m0}, m1=${m1} and collapses her two qubits; the pattern has probability ${(probabilities[outcome] ?? 0).toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { amplitudes: [...state], gateCount: 4, measured: outcome, probabilities },
    };
    step += 1;

    if (m1 === 1) {
        state = pauliX(state, 2);
    }
    yield {
        stepNumber: step,
        entities: makeBars(state, "comparing"),
        edges: [],
        description: m1 === 1 ? "The second classical bit is one, so Bob applies X to his qubit." : "The second classical bit is zero, so Bob skips the X correction.",
        codeLineNumber: 6,
        layout: "array",
        meta: { amplitudes: [...state], gateCount: m1 === 1 ? 5 : 4, measured: outcome },
    };
    step += 1;

    if (m0 === 1) {
        state = pauliZ(state, 2);
    }
    const recovered = [state[outcome] ?? 0, state[(1 << 2) | outcome] ?? 0];
    yield {
        stepNumber: step,
        entities: makeBars(state, "sorted"),
        edges: [],
        description: `Bob applies the Z correction and his qubit now matches the original state: ${recovered[0].toFixed(4)}|0> + ${recovered[1].toFixed(4)}|1>.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { amplitudes: [...state], gateCount: 6, measured: outcome, recovered },
    };
}

/** The quantum teleportation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "An unknown qubit cannot be copied, but its state can be moved. Alice and Bob first share an entangled pair. Alice mixes the input qubit with her half of that pair and measures both of her qubits, producing two ordinary bits. Those bits tell Bob which of four simple corrections to apply to his qubit, which then becomes the original state.",
        invariants: [
            "The three-qubit state vector always has unit norm after each gate and after measurement collapse.",
            "Bob's qubit is corrected only by the two classical bits Alice sends, never by further quantum communication.",
            "For every one of the four measurement outcomes the same corrections recover the input state.",
        ],
        correctness:
            "Expanding Alice's CNOT and Hadamard shows the three-qubit state is an equal superposition of four branches, each carrying the input state up to an X and Z error on Bob's qubit. Measuring Alice's qubits selects one branch. Applying X raised to the second bit and Z raised to the first bit cancels exactly that branch's error, leaving Bob's qubit equal to the input. The classical bits alone carry no information about the amplitudes.",
        complexityRationale:
            "The circuit uses a constant number of one- and two-qubit gates. Simulating it stores eight real amplitudes and each gate combines a constant number of them, so time and space are O(1) for this fixed three-qubit toy model; a general n-qubit simulator costs O(2^n).",
        uses: [
            "Moving quantum states between registers in a quantum computer",
            "Quantum repeaters and long-distance quantum networks",
            "A teaching example of entanglement plus classical communication",
        ],
        references: [
            "Bennett et al., Teleporting an Unknown Quantum State, 1993",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 2",
        ],
        workedExample:
            "Teleporting the plus state with amplitudes (0.7071, 0.7071) and measurement bits m0=1, m1=0 leaves Bob's qubit in (0.7071, -0.7071). The first bit requests a Z gate, which flips the minus sign and restores (0.7071, 0.7071), the original state.",
    },
    id: "quantum-teleportation",
    name: "Quantum Teleportation (Toy Simulator)",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(8)" },
    defaultInput: { alpha: Math.SQRT1_2, beta: Math.SQRT1_2 },
    visualType: "array",
    run,
    pseudocode: [
        "prepare the input qubit alpha zero plus beta one on qubit zero",
        "apply Hadamard to qubit one and controlled-NOT from one to two",
        "apply controlled-NOT from zero to one, then Hadamard to zero",
        "measure qubits zero and one into classical bits m0 and m1",
        "collapse the state onto the measured outcome",
        "apply X to qubit two when m1 is one",
        "apply Z to qubit two when m0 is one",
        "done: qubit two equals the original input state",
    ],
};

export default module;
