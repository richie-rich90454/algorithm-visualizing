/**
 * repetition-code.ts - Three-Qubit Bit-Flip Repetition Code
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The repetition code protects one logical qubit by copying its basis
 * components three times: a|0> + b|1> becomes a|000> + b|111>. Two parity
 * checks, Z0 Z1 and Z1 Z2, locate a single bit-flip error. Majority vote then
 * identifies the flipped physical qubit and applying X again restores the
 * encoded state.
 *
 * This is an exact small state-vector simulation on three qubits. It assumes
 * independent X errors on at most one physical qubit, perfect parity
 * measurements, and no Z errors, measurement noise, or fault-tolerant gadgets.
 * It is a teaching model of the simplest quantum error-correcting code.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^3) to update and check eight amplitudes
 *   Space: O(2^3) for the three-qubit state vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Eight bars show the amplitudes of the three-qubit basis states.
 *   - A red bar marks the erroneous component; a yellow check is violated.
 *   - The final frame is green when the original encoding is restored.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CodeInput {
    a?: number;
    b?: number;
    error?: number;
}

const LABELS = ["000", "001", "010", "011", "100", "101", "110", "111"];

/** Bit position of physical qubit q when qubit 0 is the most significant bit. */
function bitMask(q: number): number {
    return 1 << (2 - q);
}

/** Encode a real logical amplitude pair into the repetition-code subspace. */
function encode(a: number, b: number): number[] {
    const state = new Array<number>(8).fill(0);
    state[0] = a;
    state[7] = b;
    return state;
}

/** Apply an X error on one physical qubit of a three-qubit state vector. */
function flipQubit(state: number[], q: number): number[] {
    if (q < 0) {
        return [...state];
    }
    const mask = bitMask(q);
    const next = new Array<number>(8).fill(0);
    for (let i = 0; i < 8; i += 1) {
        next[i ^ mask] = state[i] ?? 0;
    }
    return next;
}

/** Parity checks Z0 Z1 and Z1 Z2 of a basis index. */
function syndromeOf(index: number): [number, number] {
    const b0 = (index >> 2) & 1;
    const b1 = (index >> 1) & 1;
    const b2 = index & 1;
    return [b0 ^ b1, b1 ^ b2];
}

/** Majority vote: map a two-bit syndrome to the qubit that must be flipped. */
function correctionFor(s0: number, s1: number): number {
    if (s0 === 1 && s1 === 0) {
        return 0;
    }
    if (s0 === 1 && s1 === 1) {
        return 1;
    }
    if (s0 === 0 && s1 === 1) {
        return 2;
    }
    return -1;
}

function makeBars(amplitudes: number[], state: EntityState, highlight: number): VisualEntity[] {
    return amplitudes.map((amplitude, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: LABELS[index] ?? String(index),
        value: amplitude,
        state: index === highlight ? state : "idle",
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, basis: LABELS[index] ?? String(index), amplitude },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CodeInput | null) ?? {};
    let a = Number(task.a ?? 1);
    let b = Number(task.b ?? 0);
    const norm = Math.hypot(a, b) || 1;
    a /= norm;
    b /= norm;
    const error = Math.min(2, Math.max(-1, Math.floor(Number(task.error ?? 0)) || 0));

    const encoded = encode(a, b);
    const errored = flipQubit(encoded, error);
    const support = errored.findIndex((amplitude) => Math.abs(amplitude) > 1e-12);
    const [s0, s1] = syndromeOf(support < 0 ? 0 : support);
    const correction = correctionFor(s0, s1);
    const corrected = flipQubit(errored, correction);
    let overlap = 0;
    for (let i = 0; i < 8; i += 1) {
        overlap += (encoded[i] ?? 0) * (corrected[i] ?? 0);
    }
    const fidelity = overlap * overlap;

    const baseMeta = {
        syndrome: [s0, s1],
        correctionQubit: correction,
        fidelity,
        errorQubit: error,
    };

    yield {
        stepNumber: 0,
        entities: makeBars(encode(1, 0), "idle", -1),
        edges: [],
        description: `Preparing logical amplitudes (${a.toFixed(3)}, ${b.toFixed(3)}) for the three-qubit repetition code.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...baseMeta, amplitudes: encode(1, 0), phase: "setup" },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(encoded, "sorted", 0),
        edges: [],
        description: "Encoding maps a|0> + b|1> to a|000> + b|111>, a distance-one repetition of each branch.",
        codeLineNumber: 1,
        layout: "array",
        meta: { ...baseMeta, amplitudes: [...encoded], phase: "encode" },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(errored, "error", error < 0 ? -1 : (support < 0 ? 0 : support)),
        edges: [],
        description: error < 0
            ? "No error was injected; both parity checks still read zero."
            : `A bit-flip error is injected on physical qubit ${error}, moving amplitude to the erroneous basis states.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...baseMeta, amplitudes: [...errored], phase: "error" },
    };

    yield {
        stepNumber: 3,
        entities: makeBars(errored, "comparing", -1),
        edges: [],
        description: `The parity checks Z0 Z1 and Z1 Z2 report ${s0}${s1}, locating the flipped qubit by majority vote.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...baseMeta, amplitudes: [...errored], phase: "syndrome" },
    };

    yield {
        stepNumber: 4,
        entities: makeBars(corrected, "comparing", correction < 0 ? -1 : 0),
        edges: [],
        description: correction < 0
            ? "The zero syndrome needs no correction."
            : `Applying X again on qubit ${correction} cancels the injected flip.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...baseMeta, amplitudes: [...corrected], phase: "correct" },
    };

    yield {
        stepNumber: 5,
        entities: makeBars(corrected, "sorted", -1),
        edges: [],
        description: `Decoding succeeds with fidelity ${fidelity.toFixed(4)}; exact for a single X error on up to three qubits.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...baseMeta, amplitudes: [...corrected], phase: "done", probabilities: corrected.map((x) => x * x) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Copy the two branches of a logical qubit across three physical qubits. If one qubit flips, the other two still agree, and comparing neighboring pairs tells you which qubit disagrees. Flip that qubit again and the original encoding returns.",
        invariants: [
            "The encoded state has support only on |000> and |111> before any error.",
            "A single X error changes exactly one of the two parity-check bits.",
            "The correction has the same syndrome as the error, so applying it clears the syndrome.",
        ],
        correctness:
            "Parity checks are linear over bit flips: the syndrome of an XOR of error patterns is the XOR of their syndromes. A single flip on qubit 0, 1, or 2 gives syndromes 10, 11, or 01 respectively, which are distinct, so the map from syndrome to culprit is one-to-one. Applying X to that qubit XORs the error pattern with itself on the affected bit, returning the encoded state exactly.",
        complexityRationale:
            "Updating or checking the state touches all eight amplitudes of a three-qubit register, so both time and space are O(8), written as O(2^n) for n physical qubits in the general repetition code.",
        uses: [
            "A first example of a quantum error-correcting code",
            "Explaining syndrome measurement and majority-vote recovery",
            "A model for protecting classical bits in noisy channels",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 10",
            "Shor, Scheme for Reducing Decoherence in Quantum Computer Memory, 1995",
        ],
        workedExample:
            "Encode a|0> + b|1> as a|000> + b|111>. An X error on the first qubit produces a|100> + b|011>. The checks read 10, so the decoder flips qubit 0 back, restoring a|000> + b|111> with fidelity one.",
    },
    id: "repetition-code",
    name: "Three-Qubit Repetition Code",
    category: "quantum",
    complexity: { time: "O(2^n)", space: "O(2^n)" },
    defaultInput: { a: 0.6, b: 0.8, error: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "normalize the logical amplitudes a and b",
        "encode as a|000> plus b|111>",
        "inject at most one bit-flip error on a physical qubit",
        "measure parity checks Z0 Z1 and Z1 Z2",
        "map the two-bit syndrome to the culprit qubit",
        "apply X on that qubit to cancel the error",
        "decode and report the recovery fidelity",
    ],
};

export default module;
