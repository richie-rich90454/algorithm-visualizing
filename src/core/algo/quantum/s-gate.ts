/**
 * s-gate.ts - The Single-Qubit S (Phase) Gate
 *
 * The S gate multiplies the |1> amplitude by i, a quarter turn about the z axis
 * of the Bloch sphere. It is the square root of the Pauli Z gate: applying it
 * twice maps |+> to |->, and applying it four times is the identity. Unlike the
 * T gate it is a Clifford gate, so it can be simulated efficiently by a
 * stabilizer tableau and it appears in every Clifford circuit decomposition.
 *
 * Time O(1) for one qubit; space O(1) for the two complex amplitudes.
 *
 * Visualization: four bars hold the real and imaginary parts of each amplitude.
 * The |1> pair turns yellow on an S application; the final frame is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

/** Multiply by i: a rotation of 90 degrees about the z axis of the Bloch sphere. */
function multiplyByI(a: Complex): Complex {
    return [-a[1], a[0]];
}

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

function probabilities(state: Complex[]): number[] {
    return state.map(([re, im]) => re * re + im * im);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { basis?: number; superposed?: boolean; repeats?: number } | null) ?? {};
    const superposed = task.superposed === true;
    const basis = superposed ? 0 : task.basis === 1 ? 1 : 0;
    const repeats = Math.max(0, Math.min(4, Math.floor(Number(task.repeats ?? 2)) || 0));
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
            ? "Starting from the plus state, an equal superposition of zero and one."
            : `Starting from the computational basis state ${basis}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { gateCount: 0, phase: 0, probabilities: probabilities(state), basis, superposed },
    };

    for (let k = 1; k <= repeats; k += 1) {
        state = [state[0] ?? [0, 0], multiplyByI(state[1] ?? [0, 0])];
        yield {
            stepNumber: k,
            entities: makeBars(state, true, false),
            edges: [],
            description: `S application ${k}: the |1> amplitude has rotated ${(k * 90).toFixed(0)} degrees; the two probabilities stay fixed.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { gateCount: k, phase: (k * Math.PI) / 2, probabilities: probabilities(state), basis, superposed },
        };
    }

    const afterTwo = repeats >= 2;
    yield {
        stepNumber: repeats + 1,
        entities: makeBars(state, false, true),
        edges: [],
        description: afterTwo
            ? `After ${repeats} S gate(s) the phase is ${((repeats * 90) % 360).toFixed(0)} degrees; two applications equal Pauli Z.`
            : `After ${repeats} S gate(s) the phase is ${((repeats * 90) % 360).toFixed(0)} degrees; four applications return to the start.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { gateCount: repeats, phase: (repeats * Math.PI) / 2, probabilities: probabilities(state), basis, superposed },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The S gate is the square root of the Pauli Z gate. Where Z flips the sign of the one amplitude in a single step, S reaches that flip in two smaller steps by rotating through i on the way. The population of each basis state never changes; only the phase of the one amplitude advances by a quarter turn.",
        invariants: [
            "The zero amplitude is left untouched by every application.",
            "One application multiplies the one amplitude by i.",
            "Measurement probabilities equal squared magnitudes and never change under a phase gate.",
        ],
        correctness:
            "The matrix diag(1, i) is unitary because both diagonal entries have modulus one, so the state norm is preserved. Its square is diag(1, -1), which is Pauli Z, and its fourth power is the identity. For an input |+> the two applications produce (|0> - |1>)/sqrt(2), the minus state, which is exactly the Z eigenstate with eigenvalue negative one.",
        complexityRationale:
            "There are only two amplitudes to update, so each application costs a fixed number of multiplications and the simulator holds a constant amount of data: O(1) time and O(1) space.",
        uses: [
            "Clifford circuit synthesis and stabilizer circuit simulation",
            "Constructing the B gate, the square root of S, in metaplectic circuits",
            "Introducing relative phases in quantum Fourier transform networks",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 4",
            "Aaronson and Gottesman, Improved Simulation of Stabilizer Circuits, 2004",
        ],
        workedExample:
            "Take the plus state (|0> + |1>)/sqrt(2). One S gate gives (|0> + i|1>)/sqrt(2). A second S gate multiplies i by i to give (|0> - |1>)/sqrt(2), the minus state. Two more gates recover the original plus state after a full turn of 360 degrees.",
    },
    id: "s-gate",
    name: "S Gate",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { basis: 0, superposed: true, repeats: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "start from a basis state or the plus state",
        "set the phase factor to the imaginary unit i",
        "for each requested application multiply the one amplitude by i",
        "keep the zero amplitude unchanged",
        "recompute probabilities from squared magnitudes",
        "note that two applications equal the Pauli Z gate",
        "note that four applications equal the identity",
        "done: report phases, amplitudes, and probabilities",
    ],
};

export default module;
