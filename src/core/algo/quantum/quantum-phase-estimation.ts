/**
 * quantum-phase-estimation.ts - Quantum Phase Estimation (exact small toy model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quantum phase estimation recovers the phase theta of an eigenvalue
 * exp(2 pi i theta) of a unitary. A t-qubit counting register is put in a
 * uniform superposition, controlled powers of the unitary write the phase
 * into the amplitudes, and an inverse quantum Fourier transform converts the
 * phase into a computational-basis outcome k, giving theta about k over 2^t.
 *
 * This simulation fixes the eigenstate to |1> of a single phase qubit and
 * exactly evolves t counting qubits for small t (up to 6). It is a teaching
 * model, not a physical quantum computer or a fault-tolerant implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(t * 2^t) for the simulated Fourier transform
 *   Space: O(2^t) for the complex amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the measurement probability of each t-bit outcome.
 *   - The most likely outcome is yellow; the final one is green.
 *   - The metadata reports the phase, the estimated phase, and success probability.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

function add(left: Complex, right: Complex): Complex {
    return [left[0] + right[0], left[1] + right[1]];
}

function scale(value: Complex, factor: number): Complex {
    return [value[0] * factor, value[1] * factor];
}

function magnitudeSquared(value: Complex): number {
    return value[0] * value[0] + value[1] * value[1];
}

/** Apply a Hadamard gate to one qubit of a complex state vector. */
function applyHadamard(state: Complex[], qubit: number): void {
    const step = 1 << qubit;
    const inverse = Math.SQRT1_2;
    for (let base = 0; base < state.length; base += step * 2) {
        for (let offset = 0; offset < step; offset += 1) {
            const a = base + offset;
            const b = a + step;
            const va = state[a]!;
            const vb = state[b]!;
            state[a] = [inverse * (va[0] + vb[0]), inverse * (va[1] + vb[1])];
            state[b] = [inverse * (va[0] - vb[0]), inverse * (va[1] - vb[1])];
        }
    }
}

/** Apply the controlled phase kickback for qubit j and phase theta. */
function applyControlledPhase(state: Complex[], t: number, theta: number): void {
    for (let x = 0; x < state.length; x += 1) {
        if ((x & (1 << t)) === 0) continue;
        const angle = 2 * Math.PI * theta * (1 << t);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const [re, im] = state[x]!;
        state[x] = [re * cos - im * sin, re * sin + im * cos];
    }
}

/** Exact inverse quantum Fourier transform as a discrete Fourier transform. */
function inverseQft(state: Complex[]): Complex[] {
    const n = state.length;
    const inv = 1 / Math.sqrt(n);
    const result: Complex[] = Array.from({ length: n }, () => [0, 0]);
    for (let y = 0; y < n; y += 1) {
        let sum: Complex = [0, 0];
        for (let x = 0; x < n; x += 1) {
            const angle = (-2 * Math.PI * x * y) / n;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const [re, im] = state[x]!;
            sum = add(sum, [re * cos - im * sin, re * sin + im * cos]);
        }
        result[y] = scale(sum, inv);
    }
    return result;
}

function makeBars(probabilities: number[], highlighted: number, state: "pending" | "done"): VisualEntity[] {
    return probabilities.map((probability, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: probability.toFixed(3),
        value: probability,
        state: index === highlighted ? (state === "done" ? "sorted" : "comparing") : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, outcome: index },
    }));
}

/** The quantum phase estimation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { t?: number; k?: number } | null) ?? {};
    const t = Math.min(6, Math.max(1, typeof task.t === "number" ? Math.floor(task.t) : 3));
    const dimension = 1 << t;
    const k = Math.min(dimension - 1, Math.max(0, typeof task.k === "number" ? Math.floor(task.k) : 3));
    const theta = k / dimension;

    const state: Complex[] = Array.from({ length: dimension }, () => [0, 0]);
    state[0] = [1, 0];

    const probabilitiesOf = (vector: Complex[]): number[] => vector.map(magnitudeSquared);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(probabilitiesOf(state), -1, "pending"),
        edges: [],
        description: `Estimating the eigenphase theta = ${k}/${dimension} with a ${t}-qubit counting register.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { t, k, phase: theta, estimate: 0, probability: 0, outcomes: probabilitiesOf(state) },
    };
    step += 1;

    for (let qubit = 0; qubit < t; qubit += 1) applyHadamard(state, qubit);
    yield {
        stepNumber: step,
        entities: makeBars(probabilitiesOf(state), -1, "pending"),
        edges: [],
        description: "Hadamard gates create a uniform superposition over all counting outcomes.",
        codeLineNumber: 1,
        layout: "array",
        meta: { t, k, phase: theta, estimate: 0, probability: 0, outcomes: probabilitiesOf(state) },
    };
    step += 1;

    for (let qubit = 0; qubit < t; qubit += 1) applyControlledPhase(state, qubit, theta);
    yield {
        stepNumber: step,
        entities: makeBars(probabilitiesOf(state), -1, "pending"),
        edges: [],
        description: "Controlled powers of the unitary write the phase into the amplitudes.",
        codeLineNumber: 2,
        layout: "array",
        meta: { t, k, phase: theta, estimate: 0, probability: 0, outcomes: probabilitiesOf(state) },
    };
    step += 1;

    const transformed = inverseQft(state);
    const probabilities = probabilitiesOf(transformed);
    let measured = 0;
    for (let index = 1; index < dimension; index += 1) {
        if ((probabilities[index] ?? 0) > (probabilities[measured] ?? 0)) measured = index;
    }
    yield {
        stepNumber: step,
        entities: makeBars(probabilities, measured, "pending"),
        edges: [],
        description: `The inverse quantum Fourier transform concentrates probability on outcome ${measured}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { t, k, phase: theta, estimate: measured / dimension, probability: probabilities[measured]!, outcomes: probabilities },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, measured, "done"),
        edges: [],
        description: `Measured ${measured}, giving the phase estimate ${(measured / dimension).toFixed(6)} with probability ${probabilities[measured]!.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { t, k, phase: theta, estimate: measured / dimension, probability: probabilities[measured]!, outcomes: probabilities },
    };
}

/** The quantum phase estimation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "If a unitary multiplies an eigenvector by exp(2 pi i theta), repeated applications turn theta into larger and larger phase rotations. Applying those rotations conditionally on counting qubits and then running a Fourier transform backwards converts the pattern of phases into an ordinary binary number k, which is theta times 2 to the t.",
        invariants: [
            "The state vector stays normalized because every gate applied is unitary.",
            "When theta equals k over 2 to the t, outcome k has probability one.",
            "The estimate is the measured integer divided by 2 to the t.",
        ],
        correctness:
            "The uniform superposition plus controlled powers gives amplitude exp(2 pi i theta x) on basis state x. The inverse Fourier transform computes the inverse discrete transform of those amplitudes, producing a peak where theta matches y over 2 to the t. When theta is exactly representable the peak has all the probability, so k over 2 to the t equals theta exactly.",
        complexityRationale:
            "A physical implementation uses O(t) gates and an O(t squared) Fourier transform. The exact classical simulation stores 2 to the t complex amplitudes and computes a dense Fourier transform in O(t * 2 to the t) time.",
        uses: [
            "The phase-estimation core of Shor's factoring algorithm",
            "Estimating energy eigenvalues in quantum chemistry",
            "Quantum algorithms for solving linear systems",
        ],
        references: [
            "Kitaev, Quantum Measurements and the Abelian Stabilizer Problem, 1995",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 5",
        ],
        workedExample:
            "With three counting qubits and theta = 3/8, the controlled phases build the pattern for the binary outcome 011. The inverse Fourier transform puts probability one on outcome 3, so the estimate 3/8 recovers the phase exactly.",
    },
    id: "quantum-phase-estimation",
    name: "Quantum Phase Estimation",
    category: "quantum",
    complexity: { time: "O(t * 2^t) simulated", space: "O(2^t) simulated" },
    defaultInput: { t: 3, k: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "prepare a uniform superposition on t counting qubits",
        "apply controlled powers of the unitary",
        "accumulate the eigenphase into the amplitudes",
        "apply the inverse quantum Fourier transform",
        "measure the counting register as an integer k",
        "set the phase estimate to k over 2 to the t",
        "done: report the estimate and success probability",
    ],
};

export default module;
