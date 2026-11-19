/**
 * t-gate.ts - The Single-Qubit T (Pi over Eight) Phase Gate
 *
 * A phase gate changes the relative phase between the two amplitudes of a
 * qubit without changing either probability. The T gate multiplies the |1>
 * amplitude by exp(i*pi/4), a rotation of 45 degrees about the z axis of the
 * Bloch sphere. It is a non-Clifford gate: together with Hadamard it generates
 * dense single-qubit rotations, and it supplies the magic states that universal
 * fault-tolerant quantum computation consumes. Applying T eight times returns
 * the state to itself up to a global phase of one full turn.
 *
 * Time O(1) for one qubit; space O(1) for the two complex amplitudes.
 *
 * Visualization: four bars hold the real and imaginary parts of each amplitude.
 * The |1> pair turns yellow on a T application; the final frame is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

const COS = Math.SQRT1_2;
const SIN = Math.SQRT1_2;

/** Multiply two complex numbers stored as [real, imaginary] pairs. */
function mul(a: Complex, b: Complex): Complex {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

/** Build the four amplitude bars for a two-element complex state vector. */
function makeBars(state: Complex[], highlight: boolean, final: boolean): VisualEntity[] {
    const parts: Array<{ id: string; basis: number; component: string; value: number }> = [
        { id: "re-0", basis: 0, component: "real", value: state[0]?.[0] ?? 0 },
        { id: "im-0", basis: 0, component: "imaginary", value: state[0]?.[1] ?? 0 },
        { id: "re-1", basis: 1, component: "real", value: state[1]?.[0] ?? 0 },
        { id: "im-1", basis: 1, component: "imaginary", value: state[1]?.[1] ?? 0 },
    ];
    return parts.map((part) => ({
        id: part.id,
        type: "bar" as const,
        label: part.value.toFixed(4),
        value: part.value,
        state: (final ? "sorted" : highlight && part.basis === 1 ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: part.basis * 2 + (part.component === "imaginary" ? 1 : 0), basis: part.basis, component: part.component },
    }));
}

/** Probabilities are squared magnitudes and are never changed by a phase gate. */
function probabilities(state: Complex[]): number[] {
    return state.map(([re, im]) => re * re + im * im);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { basis?: number; superposed?: boolean; repeats?: number } | null) ?? {};
    const superposed = task.superposed === true;
    const basis = superposed ? 0 : task.basis === 1 ? 1 : 0;
    const repeats = Math.max(0, Math.min(8, Math.floor(Number(task.repeats ?? 1)) || 0));
    let state: Complex[] = superposed
        ? [[Math.SQRT1_2, 0], [Math.SQRT1_2, 0]]
        : basis === 0
            ? [[1, 0], [0, 0]]
            : [[0, 0], [1, 0]];

    yield {
        stepNumber: 0,
        entities: makeBars(state, false, false),
        edges: [],
        description: superposed
            ? "Starting from the equal superposition of zero and one."
            : `Starting from the computational basis state ${basis}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { gateCount: 0, phase: 0, probabilities: probabilities(state), basis, superposed },
    };

    const phaseFactor: Complex = [COS, SIN];
    for (let k = 1; k <= repeats; k += 1) {
        const one = state[1] ?? [0, 0];
        state = [state[0] ?? [0, 0], mul(one, phaseFactor)];
        yield {
            stepNumber: k,
            entities: makeBars(state, true, false),
            edges: [],
            description: `T application ${k}: the |1> amplitude has advanced by ${(k * 45).toFixed(0)} degrees; probabilities are unchanged.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { gateCount: k, phase: (k * Math.PI) / 4, probabilities: probabilities(state), basis, superposed },
        };
    }

    yield {
        stepNumber: repeats + 1,
        entities: makeBars(state, false, true),
        edges: [],
        description: `After ${repeats} T gate(s) the |1> phase is ${((repeats * 45) % 360).toFixed(0)} degrees; eight applications complete a full turn.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { gateCount: repeats, phase: (repeats * Math.PI) / 4, probabilities: probabilities(state), basis, superposed },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A qubit is described by two complex amplitudes. The T gate leaves the zero amplitude alone and attaches a 45 degree phase to the one amplitude, so a measurement sees exactly the same probabilities as before. Only the relative phase moves; that hidden phase is what later interference gates can turn into a measurable difference.",
        invariants: [
            "The squared magnitudes of both amplitudes stay constant at every application.",
            "Each T application multiplies the |1> amplitude by exp(i*pi/4).",
            "The gate is diagonal, so a basis state is an eigenstate up to a phase.",
        ],
        correctness:
            "The matrix diag(1, exp(i*pi/4)) has two complex entries of modulus one, so it is unitary and preserves the norm of any state. Its eighth power is diag(1, exp(i*2*pi)) which equals the identity; its square is diag(1, i), the S gate. Because the operation is linear, applying it k times multiplies the |1> amplitude by exp(i*k*pi/4), exactly the behavior the frames report.",
        complexityRationale:
            "One qubit has two amplitudes, so a single gate application is a constant amount of arithmetic and the simulator stores only a fixed number of numbers: O(1) time and O(1) space per application.",
        uses: [
            "Completing a universal gate set together with Hadamard and CNOT",
            "Distilling magic states for fault-tolerant quantum computation",
            "Building the phase oracle inside arithmetic circuits for Shor's algorithm",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 4",
            "Aharonov and Ben-Or, Fault-Tolerant Quantum Computation with Constant Error Rate, 1997",
        ],
        workedExample:
            "Start from the equal superposition (|0> + |1>)/sqrt(2). One T gate gives (|0> + exp(i*pi/4)|1>)/sqrt(2), so both probabilities remain one half while the relative phase becomes 45 degrees. Four applications give (|0> - |1>)/sqrt(2), and eight return to the starting state.",
    },
    id: "t-gate",
    name: "T Gate",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { basis: 1, superposed: false, repeats: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "start from a basis state or an equal superposition",
        "set the phase factor to cos(pi/4) plus i sin(pi/4)",
        "for each requested application multiply the one amplitude by the phase factor",
        "leave the zero amplitude exactly as it was",
        "recompute probabilities from the squared magnitudes",
        "remember that eight applications complete a full turn",
        "done: report phases, amplitudes, and probabilities",
    ],
};

export default module;
