/**
 * bell-state-measurement.ts - Bell Basis Measurement
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Bell measurement asks which of the four maximally entangled two-qubit
 * states a pair is in, without measuring the qubits individually. The circuit
 * applies a controlled-NOT from the first qubit to the second and then a
 * Hadamard to the first qubit. That maps the Bell basis onto the computational
 * basis, so reading the two bits identifies the original Bell state: 00 is Phi
 * plus, 01 is Psi plus, 10 is Phi minus, and 11 is Psi minus. The simulation is
 * exact over the four-dimensional state space and uses one input state at a time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(4) for two gates on a two-qubit state vector
 *   Space: O(4) for the four amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four bars show the amplitudes of 00, 01, 10, and 11 at each stage.
 *   - The superposition after controlled-NOT is yellow.
 *   - The single certain outcome after the Hadamard is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type BellState = "phi-plus" | "psi-plus" | "phi-minus" | "psi-minus";
const STATES: BellState[] = ["phi-plus", "psi-plus", "phi-minus", "psi-minus"];
const LABELS = ["00", "01", "10", "11"];
const OUTCOMES: Record<BellState, number> = {
    "phi-plus": 0,
    "psi-plus": 1,
    "phi-minus": 2,
    "psi-minus": 3,
};
const INV_SQRT2 = Math.SQRT1_2;

function initialState(name: BellState): number[] {
    switch (name) {
        case "phi-plus":
            return [INV_SQRT2, 0, 0, INV_SQRT2];
        case "psi-plus":
            return [0, INV_SQRT2, INV_SQRT2, 0];
        case "phi-minus":
            return [INV_SQRT2, 0, 0, -INV_SQRT2];
        case "psi-minus":
            return [0, INV_SQRT2, -INV_SQRT2, 0];
    }
}

/** Controlled-NOT with the first qubit as control and the second as target. */
function cnot(state: number[]): number[] {
    return [state[0] ?? 0, state[1] ?? 0, state[3] ?? 0, state[2] ?? 0];
}

/** Hadamard on the first, most significant qubit. */
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

function makeBars(amplitudes: number[], stage: number, outcome: number): VisualEntity[] {
    return amplitudes.map((amplitude, index) => {
        const state: EntityState = stage < 3 ? (stage === 0 ? "idle" : "comparing") : index === outcome ? "sorted" : "idle";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: LABELS[index] ?? String(index),
            value: amplitude,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, basis: LABELS[index] ?? String(index), stage },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { bell?: string } | null) ?? {};
    const bell: BellState = STATES.includes(task.bell as BellState) ? (task.bell as BellState) : "phi-plus";
    const expected = OUTCOMES[bell];
    let state = initialState(bell);
    const probabilities = () => state.map((a) => a * a);

    function* emit(stage: number, step: number, line: number, description: string, outcome: number): Generator<VisualFrame, void, unknown> {
        const probs = probabilities();
        const peak = probs.indexOf(Math.max(...probs));
        yield {
            stepNumber: step,
            entities: makeBars(state, stage, outcome),
            edges: [],
            description,
            codeLineNumber: line,
            layout: "array",
            meta: {
                bell,
                stage,
                amplitudes: [...state],
                probabilities: probs,
                outcome: stage === 3 ? peak : -1,
                outcomeBits: stage === 3 ? (LABELS[peak] ?? "") : "",
                expected,
                matched: stage === 3 ? peak === expected : false,
                norm: probs.reduce((sum, value) => sum + value, 0),
                gateCount: stage,
            },
        };
    }

    yield* emit(0, 0, 0, `Starting from the ${bell} Bell state with four amplitudes.`, -1);
    state = cnot(state);
    yield* emit(1, 1, 2, "Controlled-NOT maps the Bell pair onto an intermediate superposition.", -1);
    state = hadamardFirst(state);
    yield* emit(2, 2, 4, "Hadamard on the first qubit completes the change to the computational basis.", -1);
    yield* emit(3, 3, 6, `Measurement outcome ${LABELS[OUTCOMES[bell]]} identifies the ${bell} state.`, OUTCOMES[bell]);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The four Bell states form a basis of the two-qubit space, just as horizontal and vertical form a basis for a single qubit. A circuit made of one controlled-NOT and one Hadamard rotates that entangled basis into the ordinary 00, 01, 10, 11 basis. Measuring then tells which Bell state was present without ever learning the individual qubit values.",
        invariants: [
            "The four squared amplitudes always sum to one before measurement.",
            "The two gates are unitary, so no probability is gained or lost during the basis change.",
            "Each Bell state maps to a single computational basis state with probability one.",
        ],
        correctness:
            "Controlled-NOT sends Phi plus to (00 plus 10) over square root two, then the Hadamard on the first qubit produces 00. Phi minus picks up a minus sign that the Hadamard turns into 10. Psi plus becomes 01 and Psi minus becomes 11. Because the map sends the four orthonormal Bell vectors to the four orthonormal computational vectors, it is exactly the required basis change and a measurement identifies the input unambiguously.",
        complexityRationale:
            "Two gates act on four amplitudes with constant work, so time and space are both O(1) for this fixed two-qubit example. A general n-qubit state vector would use O(2^n) space.",
        uses: [
            "Bell state measurements in quantum teleportation",
            "Entanglement swapping and quantum repeaters",
            "Basis rotation in entanglement distillation and superdense coding",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, chapter on entanglement",
            "Bell, On the Einstein Podolsky Rosen Paradox, 1964",
        ],
        workedExample:
            "The Phi plus state has amplitudes (0.7071, 0, 0, 0.7071). Controlled-NOT gives (0.7071, 0, 0.7071, 0) and the Hadamard gives (1, 0, 0, 0), so the measurement reads 00. Repeating with Psi minus gives 11, confirming the four Bell states have four different outcomes.",
    },
    id: "bell-state-measurement",
    name: "Bell Basis Measurement",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { bell: "phi-plus" },
    visualType: "array",
    run,
    pseudocode: [
        "prepare one of the four Bell states as a four-amplitude vector",
        "apply controlled-NOT from the first qubit to the second",
        "swap the amplitudes of states 10 and 11",
        "apply Hadamard to the first qubit",
        "combine amplitude pairs that differ in the first bit",
        "measure both qubits in the computational basis",
        "done: map the two outcome bits to the Bell state label",
    ],
};

export default module;
