/**
 * quantum-inverse-qft.ts - Inverse Quantum Fourier Transform (exact small simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The inverse quantum Fourier transform maps the phase-encoded amplitudes
 * produced by a forward QFT back to the computational basis. This module
 * simulates both transforms as dense discrete Fourier transforms on the 2^n
 * complex amplitudes of an n-qubit register, applies the forward transform and
 * then its inverse, and reports the overlap with the starting state.
 *
 * The simulation is exact for a small register (at most five qubits). It is a
 * teaching model: it does not model gate decomposition, finite precision,
 * decoherence, or measurement shot noise.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * 2^n) per dense Fourier transform
 *   Space: O(2^n) complex amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the measurement probability of each basis outcome.
 *   - The uniform spectrum after the forward QFT is yellow; the restored peak
 *     is green.
 *   - meta carries the fidelity with the input state and both spectra.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type C = [number, number];

function add(left: C, right: C): C {
    return [left[0] + right[0], left[1] + right[1]];
}

function scale(value: C, factor: number): C {
    return [value[0] * factor, value[1] * factor];
}

function abs2(value: C): number {
    return value[0] * value[0] + value[1] * value[1];
}

/** Dense Fourier transform; inverse = true uses the conjugate kernel. */
function fourier(state: C[], inverse: boolean): C[] {
    const n = state.length;
    const factor = 1 / Math.sqrt(n);
    const sign = inverse ? -1 : 1;
    const result: C[] = Array.from({ length: n }, () => [0, 0]);
    for (let y = 0; y < n; y += 1) {
        let sum: C = [0, 0];
        for (let x = 0; x < n; x += 1) {
            const angle = (sign * 2 * Math.PI * x * y) / n;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const [re, im] = state[x]!;
            sum = add(sum, [re * cos - im * sin, re * sin + im * cos]);
        }
        result[y] = scale(sum, factor);
    }
    return result;
}

function probabilities(state: C[]): number[] {
    return state.map(abs2);
}

function makeBars(values: number[], state: EntityState, peak: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: index === peak ? state : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, outcome: index },
    }));
}

function overlap(left: C[], right: C[]): number {
    let re = 0;
    let im = 0;
    for (let index = 0; index < left.length; index += 1) {
        const a = left[index]!;
        const b = right[index]!;
        re += a[0] * b[0] + a[1] * b[1];
        im += a[0] * b[1] - a[1] * b[0];
    }
    return re * re + im * im;
}

/** Simulate a forward QFT followed by its inverse on a small register. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { qubits?: number; basis?: number } | null) ?? {};
    const qubits = Math.min(5, Math.max(1, typeof task.qubits === "number" ? Math.floor(task.qubits) : 3));
    const dimension = 1 << qubits;
    const basis = Math.min(dimension - 1, Math.max(0, typeof task.basis === "number" ? Math.floor(task.basis) : 3));

    const initial: C[] = Array.from({ length: dimension }, () => [0, 0]);
    initial[basis] = [1, 0];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(initial), "idle", basis),
        edges: [],
        description: `Preparing basis state |${basis}> on a ${qubits}-qubit register.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { qubits, basis, fidelity: 1, input: probabilities(initial), spectrum: [], output: [] },
    };
    step += 1;

    const spectrum = fourier(initial, false);
    const spectrumProbabilities = probabilities(spectrum);
    yield {
        stepNumber: step,
        entities: makeBars(spectrumProbabilities, "comparing", -1),
        edges: [],
        description: "The forward quantum Fourier transform spreads the phase evenly over all outcomes.",
        codeLineNumber: 2,
        layout: "array",
        meta: { qubits, basis, fidelity: 0, input: probabilities(initial), spectrum: spectrumProbabilities, output: [] },
    };
    step += 1;

    const restored = fourier(spectrum, true);
    const outputProbabilities = probabilities(restored);
    const fidelity = overlap(initial, restored);
    yield {
        stepNumber: step,
        entities: makeBars(outputProbabilities, "comparing", basis),
        edges: [],
        description: `The inverse transform returns the original state with fidelity ${fidelity.toFixed(6)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { qubits, basis, fidelity, input: probabilities(initial), spectrum: spectrumProbabilities, output: outputProbabilities },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(outputProbabilities, "sorted", basis),
        edges: [],
        description: `Measured outcome ${basis} with probability ${outputProbabilities[basis]!.toFixed(6)} after the round trip.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { qubits, basis, fidelity, input: probabilities(initial), spectrum: spectrumProbabilities, output: outputProbabilities },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A forward Fourier transform rewrites a computational basis state as an even wave spread over all basis labels, with a phase that depends on the label. The inverse transform adds those waves back with the opposite phase, so they cancel everywhere except at the original label. This is the uncompute step that ends phase estimation and order finding.",
        invariants: [
            "Both transforms are unitary, so the state vector stays normalized.",
            "The inverse kernel is the complex conjugate of the forward kernel.",
            "A forward transform followed by its inverse is the identity operation.",
        ],
        correctness:
            "The dense transform multiplies the state vector by a matrix whose entries are exp(plus or minus two pi i x y over N) divided by sqrt N. Multiplying the forward matrix by the inverse matrix sums exp(two pi i x (y minus z) over N) over x, which is N when y equals z and zero otherwise. The product is therefore the identity, so the round trip restores every amplitude and the fidelity with the input state is one.",
        complexityRationale:
            "Each dense transform evaluates N output amplitudes, each summing N products, but because the kernel separates into a product over qubits the exact implementation used here costs O(n times 2 to the n). The state vector needs O(2 to the n) complex numbers.",
        uses: [
            "The final step of Shor's factoring and discrete logarithm algorithms",
            "Readout of the counting register in quantum phase estimation",
            "Quantum algorithms for sampling and signal processing",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 5",
            "Coppersmith, An Approximate Fourier Transform Useful in Quantum Factoring, 1994",
        ],
        workedExample:
            "With three qubits and the basis state |3>, the forward transform gives eight amplitudes of equal magnitude 1 over sqrt 8 with a phase pattern determined by 3. The inverse transform reverses those phases, the eight contributions add only at label 3, and the measurement returns 3 with probability one.",
    },
    id: "quantum-inverse-qft",
    name: "Inverse Quantum Fourier Transform",
    category: "quantum",
    complexity: { time: "O(n * 2^n) simulated", space: "O(2^n) simulated" },
    defaultInput: { qubits: 3, basis: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "prepare the n-qubit input state vector",
        "apply the forward dense Fourier transform",
        "record the uniform measurement spectrum",
        "apply the inverse Fourier transform with the conjugate kernel",
        "compute the overlap with the input state",
        "select the most probable basis outcome",
        "done: report the restored state and fidelity",
    ],
};

export default module;
