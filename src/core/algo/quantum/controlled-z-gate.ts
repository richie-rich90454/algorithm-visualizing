/**
 * controlled-z-gate.ts - Controlled-Z Gate on a Two-Qubit State
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The controlled-Z gate applies a phase of minus one to the |11> component
 * and leaves the other three computational basis states unchanged. Its matrix
 * is diagonal with entries (1, 1, 1, -1). Because it only adds a conditional
 * phase, it is symmetric in its two qubits and, together with single-qubit
 * rotations, it forms a universal entangling gate set.
 *
 * This is an exact small state-vector simulation on two qubits. Amplitudes are
 * complex pairs so arbitrary input states are handled; the module does not
 * model hardware noise, gate duration, or fault-tolerant implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for a two-qubit state
 *   Space: O(1) for the four complex amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four bars show the probability of each computational basis state.
 *   - The |11> bar is yellow while the conditional phase is applied.
 *   - The final frame reports the phase-flipped amplitudes in its metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GateInput {
    amplitudes?: Array<[number, number]>;
}

type Complex = [number, number];

const LABELS = ["00", "01", "10", "11"];

function cMulScalar(z: Complex, s: number): Complex {
    return [z[0] * s, z[1] * s];
}

/** Apply the diagonal CZ matrix: negate only the |11> amplitude. */
function applyCZ(state: Complex[]): Complex[] {
    return state.map((z, index) => (index === 3 ? cMulScalar(z, -1) : [z[0], z[1]]));
}

function makeBars(state: Complex[], highlight: number, stateFlag: EntityState): VisualEntity[] {
    return state.map((z, index) => {
        const probability = z[0] * z[0] + z[1] * z[1];
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${LABELS[index] ?? String(index)}: ${z[0].toFixed(3)}${z[1] < 0 ? "-" : "+"}${Math.abs(z[1]).toFixed(3)}i`,
            value: probability,
            state: index === highlight ? stateFlag : "idle",
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, basis: LABELS[index] ?? String(index), re: z[0], im: z[1], probability },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GateInput | null) ?? {};
    const raw = Array.isArray(task.amplitudes) && task.amplitudes.length === 4
        ? task.amplitudes.map((z) => [Number(z?.[0] ?? 0), Number(z?.[1] ?? 0)] as Complex)
        : [[0, 0], [0, 0], [0, 0], [1, 0]] as Complex[];
    const norm = Math.sqrt(raw.reduce((sum, z) => sum + z[0] * z[0] + z[1] * z[1], 0)) || 1;
    const start = raw.map((z) => cMulScalar(z, 1 / norm));
    const after = applyCZ(start);

    yield {
        stepNumber: 0,
        entities: makeBars(start, -1, "idle"),
        edges: [],
        description: `Prepared a normalized two-qubit state with four complex amplitudes.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { amplitudes: start.flatMap((z) => [z[0], z[1]]), gateCount: 0 },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(start, 3, "comparing"),
        edges: [],
        description: "Controlled-Z acts only on |11>; the other three amplitudes will not change.",
        codeLineNumber: 1,
        layout: "array",
        meta: { amplitudes: start.flatMap((z) => [z[0], z[1]]), gateCount: 0 },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(after, 3, "comparing"),
        edges: [],
        description: "The |11> amplitude is multiplied by minus one, adding a conditional phase of pi.",
        codeLineNumber: 2,
        layout: "array",
        meta: { amplitudes: after.flatMap((z) => [z[0], z[1]]), gateCount: 1 },
    };

    yield {
        stepNumber: 3,
        entities: makeBars(after, -1, "sorted"),
        edges: [],
        description: "Applying the gate twice restores the input because the diagonal entries square to one.",
        codeLineNumber: 3,
        layout: "array",
        meta: {
            amplitudes: after.flatMap((z) => [z[0], z[1]]),
            probabilities: after.map((z) => z[0] * z[0] + z[1] * z[1]),
            gateCount: 1,
            selfInverse: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of a switch that does not flip a bit but instead attaches a minus sign to one branch of the wavefunction. Only the |11> branch is tagged. A global phase would not matter, but a phase applied to just one branch changes how branches interfere later, which is what makes the gate useful.",
        invariants: [
            "The three amplitudes |00>, |01>, and |10> are unchanged.",
            "The |11> amplitude changes sign but keeps the same magnitude.",
            "Total probability stays one because the matrix is diagonal with unit-modulus entries.",
        ],
        correctness:
            "The matrix diag(1, 1, 1, -1) is unitary because each diagonal entry has modulus one, so it preserves the norm. Its square is the identity, so CZ is self-inverse. Conjugating CNOT by a Hadamard on the target gives the same matrix, which is why CZ is equivalent to a controlled-NOT in a rotated basis and is universal with single-qubit gates.",
        complexityRationale:
            "Only one of the four amplitudes is touched, so the gate costs constant time and constant space for two qubits; the general n-qubit form still costs O(2^n) amplitudes.",
        uses: [
            "Entangling layer of parameterized quantum circuits",
            "Logical operations in surface-code quantum error correction",
            "Measurement-based quantum computing graph-state construction",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 4",
            "Barenco et al., Elementary Gates for Quantum Computation, 1995",
        ],
        workedExample:
            "From the plus-plus state all four amplitudes are 0.5. CZ negates only the |11> entry, giving (0.5, 0.5, 0.5, -0.5). Every outcome is still equally likely, but the relative minus sign is now available for interference.",
    },
    id: "controlled-z-gate",
    name: "Controlled-Z Gate",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { amplitudes: [[0.5, 0], [0.5, 0], [0.5, 0], [0.5, 0]] },
    visualType: "array",
    run,
    pseudocode: [
        "normalize the four input amplitudes",
        "identify the |11> amplitude as the phase target",
        "leave the other three amplitudes unchanged",
        "multiply the |11> amplitude by minus one",
        "report the resulting amplitudes and probabilities",
        "done: gate is self-inverse and norm preserving",
    ],
};

export default module;
