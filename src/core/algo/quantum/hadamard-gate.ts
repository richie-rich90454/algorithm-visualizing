/**
 * hadamard-gate.ts - The Single-Qubit Hadamard Gate
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Hadamard gate maps a basis state into an equal superposition and maps a
 * superposition back into a basis state. Its matrix is (1 over square root of
 * two) times [[1, 1], [1, -1]], so applying it twice returns the original
 * state. It is the standard way to create quantum parallelism.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for one qubit
 *   Space: O(1) for the two amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The two real amplitudes of the qubit are shown as bars.
 *   - The superposition bar is yellow; the final state is green.
 *   - Probabilities are reported in the frame metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const INV_SQRT2 = Math.SQRT1_2;

/** Build amplitude bars from a two-element state vector. */
function makeBars(
    amplitudes: number[],
    state: EntityState = "idle",
): VisualEntity[] {
    return amplitudes.map((amplitude, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: amplitude.toFixed(4),
        value: amplitude,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, basis: index === 0 ? "0" : "1" },
    }));
}

/** Apply the Hadamard matrix to a two-element real state vector. */
function hadamard(state: number[]): number[] {
    return [
        (state[0]! + state[1]!) * INV_SQRT2,
        (state[0]! - state[1]!) * INV_SQRT2,
    ];
}

/** The Hadamard gate generator: apply the gate twice to show it is self-inverse. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { bit?: number } | null) ?? {};
    const bit = task.bit === 1 ? 1 : 0;
    const initial = bit === 0 ? [1, 0] : [0, 1];
    let state = [...initial];

    yield {
        stepNumber: 0,
        entities: makeBars(state),
        edges: [],
        description: `Starting in the basis state |${bit}>.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { amplitudes: [...state], probabilities: state.map((a) => a * a), gateCount: 0 },
    };

    state = hadamard(state);
    yield {
        stepNumber: 1,
        entities: makeBars(state, "comparing"),
        edges: [],
        description: `After one Hadamard gate the amplitudes are ${state[0]!.toFixed(4)} and ${state[1]!.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { amplitudes: [...state], probabilities: state.map((a) => a * a), gateCount: 1 },
    };

    state = hadamard(state);
    yield {
        stepNumber: 2,
        entities: makeBars(state, "sorted"),
        edges: [],
        description: `A second Hadamard gate returns to |${bit}>, proving the gate is its own inverse.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { amplitudes: [...state], probabilities: state.map((a) => a * a), gateCount: 2 },
    };
}

/** The Hadamard gate module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The Hadamard gate splits a definite basis state into two equally likely paths. Its second row subtracts instead of adding, which puts a minus sign on one branch. Because the rows are orthonormal, doing it a second time cancels the split and restores the input.",
        invariants: [
            "The sum of the squares of the two amplitudes stays equal to one.",
            "A Hadamard gate is Hermitian and unitary, so it preserves the norm.",
            "Applying the gate twice gives the identity matrix.",
        ],
        correctness:
            "The matrix rows are orthogonal unit vectors, so the matrix is unitary and preserves total probability. Direct multiplication gives H times H equal to the identity because the off-diagonal terms cancel and the diagonal terms sum to one. Therefore H squared acting on any qubit returns that qubit unchanged.",
        complexityRationale:
            "A single gate combines two amplitudes with a constant number of arithmetic operations, so both time and space are O(1).",
        uses: [
            "Creating superpositions at the start of quantum algorithms",
            "Building the interference step in Grover search",
            "Preparing Bell states together with a controlled-NOT gate",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 4",
            "Walsh, A Closed Set of Normal Orthogonal Functions, 1923",
        ],
        workedExample:
            "Starting at |0> with amplitudes (1, 0), one Hadamard gives (0.7071, 0.7071), meaning a 50 percent chance of measuring either outcome. A second gate gives (1, 0) again.",
    },
    id: "hadamard-gate",
    name: "Hadamard Gate",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { bit: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "set the amplitudes from the chosen basis state",
        "compute the symmetric combination of the amplitudes",
        "compute the antisymmetric combination of the amplitudes",
        "scale both results by one over the square root of two",
        "apply the same gate a second time to show it is self-inverse",
        "done: report the amplitudes and probabilities",
    ],
};

export default module;
