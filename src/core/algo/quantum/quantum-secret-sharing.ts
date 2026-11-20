/**
 * quantum-secret-sharing.ts - GHZ-Based Quantum Secret Sharing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In the Hillery-Buzek-Berthiaume protocol a dealer encodes a continuous
 * secret as a relative phase on a three-qubit GHZ state. Measuring all three
 * qubits in the Hadamard basis gives outcomes whose parity reveals the phase:
 * even parity occurs with probability cosine squared of half the secret and
 * odd parity with the complementary probability. Any single party holds a
 * maximally mixed qubit and learns nothing, while any two parties who pool
 * their results can recover the shared secret.
 *
 * This is an exact small state-vector simulation of the phase encoding and the
 * three-party Hadamard measurement. It assumes a noiseless channel and ideal
 * measurements, and it does not model eavesdropping detection, finite shots,
 * or the classical communication needed to reconstruct the phase.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(3 * 2^3) for three Hadamards on eight amplitudes
 *   Space: O(2^3) for the three-qubit state vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Eight bars show the amplitude or probability of each three-bit outcome.
 *   - Bars in the currently measured basis are yellow.
 *   - The final frame is green and reports the even and odd parity totals.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SharingInput {
    theta?: number;
}

type Complex = [number, number];

const INV_SQRT2 = Math.SQRT1_2;

function cAdd(a: Complex, b: Complex): Complex {
    return [a[0] + b[0], a[1] + b[1]];
}

function cSub(a: Complex, b: Complex): Complex {
    return [a[0] - b[0], a[1] - b[1]];
}

function cScale(a: Complex, s: number): Complex {
    return [a[0] * s, a[1] * s];
}

/** Apply a Hadamard gate to physical qubit q of an eight-amplitude state. */
function hadamardOn(state: Complex[], q: number): Complex[] {
    const mask = 1 << (2 - q);
    const next = [...state];
    for (let i = 0; i < 8; i += 1) {
        if ((i & mask) !== 0) continue;
        const j = i | mask;
        const a = state[i] ?? [0, 0];
        const b = state[j] ?? [0, 0];
        next[i] = cScale(cAdd(a, b), INV_SQRT2);
        next[j] = cScale(cSub(a, b), INV_SQRT2);
    }
    return next;
}

function label(index: number): string {
    return index.toString(2).padStart(3, "0");
}

function parity(index: number): number {
    let bits = index;
    let result = 0;
    while (bits !== 0) {
        result ^= bits & 1;
        bits >>= 1;
    }
    return result;
}

function makeBars(state: Complex[], values: number[], phase: string): VisualEntity[] {
    return state.map((amplitude, index) => {
        const magnitude = Math.hypot(amplitude[0], amplitude[1]);
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${label(index)}: ${values[index]?.toFixed(4) ?? "0.0000"}`,
            value: values[index] ?? 0,
            state: phase === "done" ? "sorted" : phase === "measure" ? "comparing" : "idle",
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, basis: label(index), amplitude: magnitude, probability: values[index] ?? 0 },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SharingInput | null) ?? {};
    const theta = Number(task.theta ?? Math.PI / 3);
    const zeros = new Array<Complex>(8).fill([0, 0]);
    const ghz = [...zeros];
    ghz[0] = [INV_SQRT2, 0];
    ghz[7] = [INV_SQRT2, 0];

    const encoded = [...zeros];
    encoded[0] = [INV_SQRT2, 0];
    encoded[7] = [Math.cos(theta) * INV_SQRT2, Math.sin(theta) * INV_SQRT2];

    let measured = encoded;
    for (let q = 0; q < 3; q += 1) measured = hadamardOn(measured, q);
    const probabilities = measured.map((amplitude) => amplitude[0] ** 2 + amplitude[1] ** 2);
    let even = 0;
    let odd = 0;
    for (let i = 0; i < 8; i += 1) {
        if (parity(i) === 0) even += probabilities[i] ?? 0;
        else odd += probabilities[i] ?? 0;
    }

    const metaBase = {
        theta,
        evenParityProbability: even,
        oddParityProbability: odd,
        singleQubitDensity: [0.5, 0, 0, 0.5],
    };

    yield {
        stepNumber: 0,
        entities: makeBars(ghz, ghz.map((z) => z[0] ** 2 + z[1] ** 2), "idle"),
        edges: [],
        description: "The dealer prepares a three-qubit GHZ state shared among the parties.",
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaBase, amplitudes: ghz.flatMap((z) => [z[0], z[1]]) },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(encoded, encoded.map((z) => z[0] ** 2 + z[1] ** 2), "idle"),
        edges: [],
        description: `The dealer applies a relative phase of ${theta.toFixed(3)} to the |111> branch, hiding the secret.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...metaBase, amplitudes: encoded.flatMap((z) => [z[0], z[1]]) },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(measured, measured.map((z) => z[0] ** 2 + z[1] ** 2), "measure"),
        edges: [],
        description: "Each party applies a Hadamard gate to their qubit before measuring in the computational basis.",
        codeLineNumber: 2,
        layout: "array",
        meta: { ...metaBase, amplitudes: measured.flatMap((z) => [z[0], z[1]]) },
    };

    yield {
        stepNumber: 3,
        entities: makeBars(measured, probabilities, "measure"),
        edges: [],
        description: `Outcome probabilities ${probabilities.map((value) => value.toFixed(4)).join(", ")} depend on the secret through the parity.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...metaBase, amplitudes: measured.flatMap((z) => [z[0], z[1]]), probabilities: [...probabilities] },
    };

    yield {
        stepNumber: 4,
        entities: makeBars(measured, probabilities, "done"),
        edges: [],
        description: `Even parity occurs with probability ${even.toFixed(4)}, odd parity with ${odd.toFixed(4)}; each single qubit is maximally mixed.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...metaBase, amplitudes: measured.flatMap((z) => [z[0], z[1]]), probabilities: [...probabilities], done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Hide a number in the relative phase of a shared three-qubit state. Each person receives one qubit, and no one qubit by itself carries any information about the phase. When the parties combine their measurement results, the parity pattern reveals the phase, so at least two of them are needed to read the secret.",
        invariants: [
            "The GHZ state has support only on |000> and |111> before measurement.",
            "Encoding changes only the relative phase of the |111> branch.",
            "The reduced state of any single qubit is maximally mixed, so one party learns nothing.",
        ],
        correctness:
            "Applying a Hadamard to all three qubits sends the encoded state to a superposition whose amplitude for outcome x is (1 plus exp(i theta) times minus one to the parity of x) divided by four. Squaring gives probability (1 plus parity times cosine theta) over eight, so summing over the four even outcomes gives cosine squared of theta over two and the odd outcomes give sine squared of theta over two. Because the two branches of the GHZ state are orthogonal on any single qubit, tracing out the other two leaves the identity over two, which proves one party alone has no information.",
        complexityRationale:
            "Three Hadamard gates each touch four pairs of the eight amplitudes, so preparation and measurement cost O(3 times 2^3) time and O(2^3) space.",
        uses: [
            "Splitting a secret among several parties",
            "Quantum key distribution with a trusted dealer",
            "A teaching example of multipartite entanglement",
        ],
        references: [
            "Hillery, Buzek, and Berthiaume, Quantum Secret Sharing, 1999",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 12",
        ],
        workedExample:
            "For theta equal to pi over three, even outcomes together carry probability cosine squared of pi over six, which is three quarters, and odd outcomes carry one quarter. A single party measuring alone sees zero and one with equal chance, independent of theta.",
    },
    id: "quantum-secret-sharing",
    name: "Quantum Secret Sharing (GHZ Protocol)",
    category: "quantum",
    complexity: { time: "O(3 * 2^3)", space: "O(2^3)" },
    defaultInput: { theta: 1.0471975511965976 },
    visualType: "array",
    run,
    pseudocode: [
        "prepare the three-qubit GHZ state",
        "encode the secret as a phase on the |111> branch",
        "apply a Hadamard gate on each party qubit",
        "compute the eight outcome probabilities",
        "sum probabilities by outcome parity",
        "verify each single qubit is maximally mixed",
        "done: report even and odd parity probabilities",
    ],
};

export default module;
