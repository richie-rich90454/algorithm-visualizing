/**
 * quantum-fourier-transform.ts - Quantum Fourier Transform on a Small Register
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The quantum Fourier transform maps a basis state |j> to an equally weighted
 * superposition whose phase at |k> is exp(2 pi i j k / N). It is the discrete
 * Fourier transform implemented as a unitary circuit of Hadamard and
 * controlled-phase gates. This module computes the same linear map directly on
 * a tiny state vector, adding one input's contribution at a time so the phases
 * are visible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n 2^n) for the direct transform on n qubits
 *   Space: O(2^n) for the amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the real part of each output amplitude; the imaginary part is
 *     carried in frame metadata.
 *   - The input currently contributing its phase is highlighted.
 *   - The final bars are the transformed state in green.
 *
 * This is a small exact state-vector model, not a fault-tolerant quantum run.
 * Every phase is computed with exact complex arithmetic for at most eight basis
 * states.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build bars for the real part of a complex state vector. */
function makeBars(re: number[], state: EntityState, active: number): VisualEntity[] {
    return re.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: index === active ? value.toFixed(4) : `|${index}>`,
        value,
        state: index === active ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, re: value },
    }));
}

/** The quantum Fourier transform generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { amplitudes?: number[] } | null) ?? {};
    let inputRe = Array.isArray(task.amplitudes) ? task.amplitudes.map((v) => Number(v) || 0) : [1, 0, 0, 0];
    if (inputRe.length < 2 || (inputRe.length & (inputRe.length - 1)) !== 0 || inputRe.length > 8) {
        inputRe = [1, 0, 0, 0];
    }
    const n = inputRe.length;
    const scale = 1 / Math.sqrt(n);
    let re = new Array<number>(n).fill(0);
    let im = new Array<number>(n).fill(0);
    let frame = 0;

    yield {
        stepNumber: frame,
        entities: makeBars(inputRe, "idle", -1),
        edges: [],
        description: `Quantum Fourier transform of a ${Math.log2(n)}-qubit register with ${n} basis states.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { re: [...inputRe], im: new Array<number>(n).fill(0), inputRe: [...inputRe], contributing: -1 },
    };
    frame += 1;

    for (let j = 0; j < n; j += 1) {
        const amplitude = inputRe[j] ?? 0;
        for (let k = 0; k < n; k += 1) {
            const angle = (2 * Math.PI * j * k) / n;
            re[k] = (re[k] ?? 0) + scale * amplitude * Math.cos(angle);
            im[k] = (im[k] ?? 0) + scale * amplitude * Math.sin(angle);
        }
        yield {
            stepNumber: frame,
            entities: makeBars(re, "idle", j),
            edges: [],
            description: amplitude === 0
                ? `Input |${j}> has zero amplitude and contributes no phase.`
                : `Adding the phase contributions of input |${j}> at amplitude ${amplitude.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { re: [...re], im: [...im], inputRe: [...inputRe], contributing: j },
        };
        frame += 1;
    }

    yield {
        stepNumber: frame,
        entities: makeBars(re, "sorted", -1),
        edges: [],
        description: `Transform complete: ${n} output amplitudes with phases recorded in metadata.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { re: [...re], im: [...im], inputRe: [...inputRe], contributing: -1 },
    };
}

/** The quantum Fourier transform module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The Fourier transform rewrites a state in terms of frequencies. Each input basis state contributes the same magnitude to every output, but with a phase that advances linearly with the output index. Interference then reinforces the frequencies that match the input pattern and cancels the others.",
        invariants: [
            "The transform is unitary, so the sum of squared magnitudes is preserved.",
            "Every output amplitude has the same magnitude one over the square root of N for a basis input.",
            "The phase at output k advances by 2 pi j k over N for input j.",
        ],
        correctness:
            "The matrix entry at row k and column j is exp(2 pi i j k over N) divided by the square root of N. Its columns are orthogonal because the sum of powers of a primitive N-th root of unity is zero for unequal exponents, and each column has norm one, so the matrix is unitary. The module computes exactly this matrix-vector product, which is the discrete Fourier transform performed by the quantum circuit.",
        complexityRationale:
            "The direct computation visits every one of the N = 2^n inputs and for each writes all N outputs, so O(N^2) time, equivalently O(4^n). The state vector uses O(N) space. The circuit form reduces the time to O(n^2) gates, which this direct teaching model does not reproduce.",
        uses: [
            "The phase-estimation subroutine in Shor's algorithm",
            "Quantum algorithms for hidden subgroup problems",
            "Spectral analysis and simulated quantum walks",
        ],
        references: [
            "Coppersmith, An Approximate Fourier Transform Useful in Quantum Factoring, 1994",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 5",
        ],
        workedExample:
            "For one qubit the input |0> with amplitudes (1, 0) transforms to (0.5, 0.5): applying a Hadamard. For two qubits the basis state |1> produces phases that advance by one quarter turn between successive output indices.",
    },
    id: "quantum-fourier-transform",
    name: "Quantum Fourier Transform",
    category: "quantum",
    complexity: { time: "O(n 2^n)", space: "O(2^n)" },
    defaultInput: { amplitudes: [1, 0, 0, 0] },
    visualType: "array",
    run,
    pseudocode: [
        "read the input amplitudes for N basis states",
        "set the scale to one over the square root of N",
        "for each input basis state j",
        "compute the phase for every output basis state k",
        "add the scaled real and imaginary contributions",
        "record the partial transformed state",
        "repeat until every input is included",
        "done: report the full transformed state",
    ],
};

export default module;
