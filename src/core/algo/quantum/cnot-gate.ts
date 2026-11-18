/**
 * cnot-gate.ts - Controlled-NOT Gate on a Two-Qubit State
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The controlled-NOT gate flips the target qubit when and only when the
 * control qubit is one. On the four computational basis states it swaps the
 * amplitudes of |10> and |11> and leaves |00> and |01> unchanged. It is the
 * basic entangling gate: applied after a Hadamard it creates a Bell state.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for a two-qubit state
 *   Space: O(1) for the four amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four bars show the amplitudes of |00>, |01>, |10>, and |11>.
 *   - The two amplitudes where the control is one turn yellow.
 *   - The final state is green and reports measurement probabilities.
 *
 * This is a small exact state-vector simulator, not a fault-tolerant quantum
 * execution. The four amplitudes are updated by the exact CNOT permutation.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const BASIS = ["00", "01", "10", "11"];

/** Build amplitude bars for the four basis states. */
function makeBars(amplitudes: number[], state: EntityState, active: Set<number>): VisualEntity[] {
    return amplitudes.map((amplitude, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: BASIS[index] ?? String(index),
        value: amplitude,
        state: active.has(index) ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, basis: BASIS[index] ?? String(index) },
    }));
}

/** Apply the CNOT permutation to a two-qubit real state vector. */
function cnot(state: number[]): number[] {
    const next = [...state];
    next[2] = state[3] ?? 0;
    next[3] = state[2] ?? 0;
    next[0] = state[0] ?? 0;
    next[1] = state[1] ?? 0;
    return next;
}

/** The controlled-NOT generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { initial?: string } | null) ?? {};
    const raw = typeof task.initial === "string" ? task.initial : "10";
    const bits = /^[01]{2}$/.test(raw) ? raw : "10";
    const index = Number.parseInt(bits, 2);
    const start = [0, 0, 0, 0];
    start[index] = 1;
    const after = cnot(start);

    yield {
        stepNumber: 0,
        entities: makeBars(start, "idle", new Set()),
        edges: [],
        description: `Starting from the basis state |${bits}> with the control as the first qubit.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { amplitudes: [...start], probabilities: start.map((a) => a * a), gateCount: 0 },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(start, "idle", new Set([2, 3])),
        edges: [],
        description: "The control qubit is one, so the amplitudes of |10> and |11> will be swapped.",
        codeLineNumber: 2,
        layout: "array",
        meta: { amplitudes: [...start], probabilities: start.map((a) => a * a), gateCount: 0 },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(after, "comparing", new Set([2, 3])),
        edges: [],
        description: "Controlled-NOT swaps those two amplitudes; the other two are unchanged.",
        codeLineNumber: 4,
        layout: "array",
        meta: { amplitudes: [...after], probabilities: after.map((a) => a * a), gateCount: 1 },
    };

    yield {
        stepNumber: 3,
        entities: makeBars(after, "sorted", new Set()),
        edges: [],
        description: `Final state has support on |${BASIS[after.findIndex((a) => a === 1)] ?? bits}>.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { amplitudes: [...after], probabilities: after.map((a) => a * a), gateCount: 1 },
    };
}

/** The controlled-NOT gate module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Treat one qubit as a switch. When the control reads one, flip the target; when it reads zero, leave the target alone. In the basis this just swaps two pairs of amplitudes. If the control is in a superposition, the gate conditionally flips only part of the state, which is how it creates entanglement.",
        invariants: [
            "The sum of squared amplitudes stays equal to one.",
            "The amplitudes of |00> and |01> are unchanged.",
            "The amplitudes of |10> and |11> are exchanged.",
        ],
        correctness:
            "The CNOT matrix is a permutation matrix: it sends |00> to |00>, |01> to |01>, |10> to |11>, and |11> to |10>. A permutation matrix is unitary, so it preserves the norm and total probability. Direct multiplication on any state vector swaps the last two entries and fixes the first two, which is exactly the controlled-flip rule.",
        complexityRationale:
            "The gate touches only two of the four amplitudes, so it uses a constant number of operations and a constant amount of memory. For a general n-qubit state vector the same gate still touches half the amplitudes, costing O(2^n).",
        uses: [
            "Creating Bell states and other entangled pairs",
            "Building reversible classical circuits inside quantum algorithms",
            "The entangling layer of error-correction codes",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 4",
            "Feynman, Quantum Mechanical Computers, 1985",
        ],
        workedExample:
            "Starting from |10> the amplitudes are (0, 0, 1, 0). CNOT swaps the last two entries to give (0, 0, 0, 1), which is |11>: the control was one, so the target flipped from zero to one.",
    },
    id: "cnot-gate",
    name: "CNOT Gate",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { initial: "10" },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the two-qubit state from the input bits",
        "identify the amplitudes where the control is one",
        "leave the other amplitudes unchanged",
        "swap the amplitudes of the two target cases",
        "report the resulting amplitudes",
        "done: report measurement probabilities",
    ],
};

export default module;
