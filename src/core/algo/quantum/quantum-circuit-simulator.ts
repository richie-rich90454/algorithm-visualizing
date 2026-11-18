/**
 * quantum-circuit-simulator.ts - Small Exact State-Vector Circuit Simulator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a small teaching simulator for up to five qubits. It stores the full
 * 2^n complex state vector and applies each gate by an exact matrix update, so
 * every mathematical step is faithful even though the circuit model is toy sized.
 * Supported gates are H, X, Y, Z, S, T, and CNOT.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(g * 2^n) for g gates on n qubits
 *   Space: O(2^n) for the state vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per computational basis state shows its measurement probability.
 *   - The bar affected by the latest gate is highlighted yellow; the finished
 *     distribution is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];
type Scalar = number | Complex;
type Matrix2 = [[Scalar, Scalar], [Scalar, Scalar]];
type GateName = "H" | "X" | "Y" | "Z" | "S" | "T" | "CNOT";

interface Gate {
    gate: GateName;
    target: number;
    control?: number;
}

const S = Math.SQRT1_2;
const T_COS = Math.cos(Math.PI / 4);
const T_SIN = Math.sin(Math.PI / 4);

const GATES: Record<string, Matrix2> = {
    H: [
        [S, S],
        [S, -S],
    ],
    X: [
        [0, 1],
        [1, 0],
    ],
    Y: [
        [0, [0, -1]],
        [[0, 1], 0],
    ],
    Z: [
        [1, 0],
        [0, -1],
    ],
    S: [
        [1, 0],
        [0, [0, 1]],
    ],
    T: [
        [1, 0],
        [0, [T_COS, T_SIN]],
    ],
};

function toComplex(value: Scalar): Complex {
    return typeof value === "number" ? [value, 0] : value;
}

function cmul(a: Scalar, b: Scalar): Complex {
    const x = toComplex(a);
    const y = toComplex(b);
    return [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]];
}

function cadd(a: Scalar, b: Scalar): Complex {
    const x = toComplex(a);
    const y = toComplex(b);
    return [x[0] + y[0], x[1] + y[1]];
}

/** Format an index as a big-endian bit string of length n. */
function basisLabel(index: number, n: number): string {
    let text = "";
    for (let q = 0; q < n; q += 1) {
        text += (index >> (n - 1 - q)) & 1;
    }
    return text;
}

/** Apply a single-qubit matrix to target qubit t (qubit 0 is the most significant bit). */
function applySingle(state: Complex[], n: number, target: number, m: Matrix2): void {
    const bit = n - 1 - target;
    const mask = 1 << bit;
    for (let i = 0; i < state.length; i += 1) {
        if ((i & mask) !== 0) {
            continue;
        }
        const j = i | mask;
        const si = state[i] ?? [0, 0];
        const sj = state[j] ?? [0, 0];
        state[i] = cadd(cmul(m[0]![0]!, si), cmul(m[0]![1]!, sj));
        state[j] = cadd(cmul(m[1]![0]!, si), cmul(m[1]![1]!, sj));
    }
}

/** Apply a controlled NOT with the given control and target qubits. */
function applyCnot(state: Complex[], n: number, control: number, target: number): void {
    const cbit = 1 << (n - 1 - control);
    const tbit = 1 << (n - 1 - target);
    for (let i = 0; i < state.length; i += 1) {
        if ((i & cbit) !== 0 && (i & tbit) === 0) {
            const j = i | tbit;
            const si = state[i]!;
            state[i] = state[j]!;
            state[j] = si;
        }
    }
}

/** Build probability bars for a state vector. */
function makeBars(state: Complex[], n: number, state_: EntityState): VisualEntity[] {
    return state.map((amp, index) => {
        const probability = amp[0] * amp[0] + amp[1] * amp[1];
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `|${basisLabel(index, n)}> ${probability.toFixed(3)}`,
            value: probability,
            state: state_,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, basis: basisLabel(index, n), probability },
        };
    });
}

/** Snapshot the simulation statistics into frame metadata. */
function snapshot(state: Complex[], gateCount: number) {
    return {
        gateCount,
        reals: state.map((a) => a[0]),
        imags: state.map((a) => a[1]),
        probabilities: state.map((a) => a[0] * a[0] + a[1] * a[1]),
        norm: state.reduce((sum, a) => sum + a[0] * a[0] + a[1] * a[1], 0),
    };
}

/** The small exact circuit simulator generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { qubits?: number; gates?: Gate[] } | null) ?? {};
    const n = Math.min(5, Math.max(1, Math.floor(task.qubits ?? 2)));
    const gates: Gate[] = Array.isArray(task.gates)
        ? task.gates
        : [
              { gate: "H", target: 0 },
              { gate: "CNOT", target: 1, control: 0 },
          ];
    const size = 2 ** n;
    const state: Complex[] = Array.from({ length: size }, () => [0, 0]);
    state[0] = [1, 0];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(state, n, "idle"),
        edges: [],
        description: `Starting in basis state |${basisLabel(0, n)}> on ${n} qubit(s), ${size} amplitudes.`,
        codeLineNumber: 0,
        layout: "array",
        meta: snapshot(state, 0),
    };
    step += 1;

    for (let g = 0; g < gates.length; g += 1) {
        const instruction = gates[g]!;
        const name = instruction.gate;
        if (name === "CNOT") {
            const control = Math.max(0, Math.min(n - 1, instruction.control ?? 0));
            const target = Math.max(0, Math.min(n - 1, instruction.target));
            applyCnot(state, n, control, target);
        } else {
            const matrix = GATES[name];
            if (matrix) {
                applySingle(state, n, Math.max(0, Math.min(n - 1, instruction.target)), matrix);
            }
        }
        yield {
            stepNumber: step,
            entities: makeBars(state, n, "comparing"),
            edges: [],
            description: `Applied ${name}${name === "CNOT" ? ` (control ${instruction.control}, target ${instruction.target})` : ` to qubit ${instruction.target}`}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: snapshot(state, g + 1),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(state, n, "sorted"),
        edges: [],
        description: `Circuit complete: ${gates.length} gate(s), total probability ${snapshot(state, gates.length).norm.toFixed(6)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...snapshot(state, gates.length), done: true },
    };
}

/** The quantum circuit simulator module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A qubit state is a list of complex amplitudes, one for each classical bit string. A gate replaces pairs of amplitudes by exact two-by-two matrix products, and measurement turns the squared magnitude of an amplitude into a probability. This simulator keeps the whole vector, so the math is exact even though only a few qubits are shown.",
        invariants: [
            "The sum of the squared magnitudes of all amplitudes stays equal to one.",
            "Every gate is unitary, so it preserves that total probability.",
            "Qubit zero is stored as the most significant bit of the basis index.",
        ],
        correctness:
            "A single-qubit gate touches exactly the pairs of amplitudes whose target bit differs, and applying the two-by-two matrix to each pair is the definition of tensoring that gate with the identity on the other qubits. A controlled NOT swaps the pair where the control bit is set and the target bit is clear, which is its matrix action. Therefore the stored vector after every gate equals the true product of the gate matrices applied to the initial state.",
        complexityRationale:
            "Each single-qubit gate updates half of the 2^n amplitudes and a controlled NOT swaps a subset of them, so a circuit of g gates costs O(g times 2^n) time. Holding the amplitude vector uses O(2^n) space, which is why the model is limited to a handful of qubits.",
        uses: [
            "Teaching how quantum gates transform amplitudes",
            "Checking small circuits before running them on hardware",
            "Prototyping the math behind Bell states and measurement",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 4",
            "Mermin, Quantum Computer Science, Chapter 3",
        ],
        workedExample:
            "On two qubits the default circuit applies H to qubit zero, giving amplitudes (0.7071, 0.7071, 0, 0), then a controlled NOT swaps the last two entries into place. The final amplitudes are (0.7071, 0, 0, 0.7071), so measuring yields 00 or 11 with equal chance and never 01 or 10.",
    },
    id: "quantum-circuit-simulator",
    name: "Quantum Circuit Simulator",
    category: "quantum",
    complexity: { time: "O(g * 2^n)", space: "O(2^n)" },
    defaultInput: {
        qubits: 2,
        gates: [
            { gate: "H", target: 0 },
            { gate: "CNOT", target: 1, control: 0 },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "allocate 2 to the n complex amplitudes and set the zero state to one",
        "read the next gate from the circuit description",
        "for a single-qubit gate multiply each amplitude pair by the gate matrix",
        "for a controlled NOT swap the pair where control is one and target is zero",
        "record the probability of every basis state",
        "repeat until all gates are applied",
        "done: report the final amplitudes and measurement probabilities",
    ],
};

export default module;
