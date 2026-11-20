/**
 * quantum-hadamard-transform.ts - The n-Qubit Walsh-Hadamard Transform
 *
 * Applies H tensor n to a register of n qubits, one qubit layer at a time.
 * Unlike the single-qubit Hadamard gate module, this builds the full 2^n-entry
 * transform and shows how a basis state becomes a uniform superposition with
 * signs given by the bitwise dot product. The model is an exact pure-state
 * simulation with real amplitudes for n between 2 and 4; it does not model
 * noise, gate duration, or fault-tolerant decomposition.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface TransformInput {
    qubits?: number;
    basis?: number;
}

const INV_SQRT2 = Math.SQRT1_2;

function makeBars(amps: Complex[], highlight: number, final: boolean): VisualEntity[] {
    return amps.map((z, index) => {
        const probability = z[0] * z[0] + z[1] * z[1];
        return {
            id: `amp-${index}`,
            type: "bar" as const,
            label: `${index.toString(2).padStart(3, "0")}: ${z[0].toFixed(4)}${z[1] < 0 ? "-" : "+"}${Math.abs(z[1]).toFixed(4)}i`,
            value: z[0],
            state: final ? "sorted" : index === highlight ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, re: z[0], im: z[1], probability },
        };
    });
}

/** Apply Hadamard to one qubit of a complex state vector. */
function layer(state: Complex[], qubit: number): Complex[] {
    const stride = 2 ** qubit;
    const next = state.map((z) => [...z] as Complex);
    for (let base = 0; base < next.length; base += 2 * stride) {
        for (let offset = 0; offset < stride; offset += 1) {
            const a = state[base + offset]!;
            const b = state[base + offset + stride]!;
            next[base + offset] = [(a[0] + b[0]) * INV_SQRT2, (a[1] + b[1]) * INV_SQRT2];
            next[base + offset + stride] = [(a[0] - b[0]) * INV_SQRT2, (a[1] - b[1]) * INV_SQRT2];
        }
    }
    return next;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TransformInput | null) ?? {};
    const qubits = Math.max(2, Math.min(4, typeof task.qubits === "number" ? Math.round(task.qubits) : 3));
    const size = 2 ** qubits;
    const basis = Math.max(0, Math.min(size - 1, typeof task.basis === "number" ? Math.floor(task.basis) : 0));
    const flat = (amps: Complex[]): number[] => amps.flatMap((z) => [z[0], z[1]]);
    const metaFor = (amps: Complex[], applied: number, done: boolean) => ({
        qubits,
        basis,
        size,
        amplitudes: flat(amps),
        probabilities: amps.map((z) => z[0] * z[0] + z[1] * z[1]),
        layersApplied: applied,
        norm: amps.reduce((sum, z) => sum + z[0] * z[0] + z[1] * z[1], 0),
        done,
    });

    let state: Complex[] = Array.from({ length: size }, (_, i) => [i === basis ? 1 : 0, 0] as Complex);
    yield {
        stepNumber: 0,
        entities: makeBars(state, basis, false),
        edges: [],
        description: `Prepared basis state |${basis.toString(2).padStart(qubits, "0")}> on ${qubits} qubits (${size} amplitudes).`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(state, 0, false),
    };

    for (let q = 0; q < qubits; q += 1) {
        state = layer(state, q);
        yield {
            stepNumber: q + 1,
            entities: makeBars(state, -1, false),
            edges: [],
            description: `Applied Hadamard to qubit ${q}: each pair of amplitudes is now added and subtracted with a factor of one over the square root of two.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { ...metaFor(state, q + 1, false), activeQubit: q },
        };
    }

    const sign = (index: number): number => {
        let bits = 0;
        let value = index & basis;
        while (value > 0) {
            bits += value & 1;
            value >>= 1;
        }
        return bits % 2 === 0 ? 1 : -1;
    };
    yield {
        stepNumber: qubits + 1,
        entities: makeBars(state, -1, true),
        edges: [],
        description: `The Walsh-Hadamard transform is complete: every outcome has probability ${(1 / size).toFixed(4)} and signs follow the bitwise dot product with the input.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...metaFor(state, qubits, true), signs: state.map((_z, i) => sign(i)) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Applying a Hadamard gate to every qubit at once is the quantum version of the Walsh-Hadamard transform. It takes a definite bit string and spreads it uniformly over all possible strings, attaching a plus or minus sign that depends on the parity of the bitwise overlap. That uniform superposition is the starting point of most quantum algorithms, and the same transform undoes itself.",
        invariants: [
            "Each qubit layer is unitary, so the total probability stays one after every layer.",
            "Starting from a basis state, the final magnitude of every amplitude is exactly one over the square root of 2^n.",
            "The final sign of amplitude x is (-1) raised to the bitwise dot product of x and the input string.",
        ],
        correctness:
            "The n-qubit operator is the tensor product H tensor n, whose matrix entries are (-1) raised to the bitwise dot product of the row and column indices, divided by the square root of 2^n. The butterfly loop applies exactly this tensor product one factor at a time, so the product of the n layers is the transform matrix. Since H is Hermitian and H squared is the identity, applying the transform twice returns the original state.",
        complexityRationale:
            "Each of the n layers touches all 2^n amplitudes once and does constant work per amplitude, giving O(n 2^n) time. The state vector itself uses O(2^n) memory. This is the fastest known structure for the transform and matches the gate count of the quantum circuit.",
        uses: [
            "Initializing uniform superpositions in Grover and Shor style algorithms",
            "The inverse step of quantum phase estimation",
            "Fast Walsh-Hadamard transforms and syndrome extraction in stabilizer codes",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 5",
            "Walsh, A Closed Set of Normal Orthogonal Functions, 1923",
        ],
        workedExample:
            "For two qubits starting at |01>, layer zero pairs amplitudes at indices 0 and 1 and at 2 and 3, then layer one pairs indices separated by two. The result is (0.5, 0.5, -0.5, -0.5): each probability is one quarter and the minus signs match the parity of the bitwise overlap with 01.",
    },
    id: "quantum-hadamard-transform",
    name: "Quantum Hadamard Transform (n Qubits)",
    category: "quantum",
    complexity: { time: "O(n 2^n)", space: "O(2^n)" },
    defaultInput: { qubits: 3, basis: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "choose n and the input basis index, then size the state vector to 2^n",
        "set a single amplitude to one at the input index",
        "for each qubit q from zero to n-1",
        "pair amplitudes whose indices differ in bit q",
        "replace each pair by its sum and difference over the square root of two",
        "record the amplitudes after the layer",
        "done: report the uniform magnitudes and parity signs",
    ],
};

export default module;
