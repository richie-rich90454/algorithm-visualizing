/**
 * quantum-swap-test.ts - The SWAP Test for State Overlap
 *
 * An exact three-qubit simulation of the SWAP test: an ancilla in the plus
 * state controls a swap of two data qubits, and a final Hadamard makes the
 * ancilla measurement probability encode the squared overlap of the two data
 * states. The model is exact for pure single-qubit data states with real or
 * complex amplitudes; it reports ideal probabilities rather than shot-noise
 * estimates and does not model gate errors or decoherence.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface SwapTestInput {
    alpha?: number;
    theta?: number;
    phi?: number;
}

const INV_SQRT2 = Math.SQRT1_2;

function makeBars(amps: Complex[], highlight: number[], final: boolean): VisualEntity[] {
    return amps.map((z, index) => {
        const probability = z[0] * z[0] + z[1] * z[1];
        return {
            id: `basis-${index}`,
            type: "bar" as const,
            label: `|${Math.floor(index / 4)}${Math.floor(index / 2) % 2}${index % 2}>: ${probability.toFixed(4)}`,
            value: probability,
            state: final ? "sorted" : highlight.includes(index) ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, ancilla: Math.floor(index / 4), probability },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SwapTestInput | null) ?? {};
    const clamp = (value: unknown, low: number, high: number, fallback: number): number =>
        typeof value === "number" && Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback;
    const alpha = clamp(task.alpha, 0, Math.PI, 0);
    const theta = clamp(task.theta, 0, Math.PI, Math.PI / 4);
    const phi = clamp(task.phi, -Math.PI, Math.PI, 0);
    const psi: Complex[] = [[Math.cos(alpha), 0], [Math.sin(alpha), 0]];
    const other: Complex[] = [[Math.cos(theta), 0], [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi)]];
    const overlapReal = psi[0]![0] * other[0]![0] + psi[1]![0] * other[1]![0];
    const overlapImag = psi[1]![0] * other[1]![1];
    const overlapSquared = overlapReal * overlapReal + overlapImag * overlapImag;
    const flat = (amps: Complex[]): number[] => amps.flatMap((z) => [z[0], z[1]]);
    const metaFor = (amps: Complex[], measured: boolean, done: boolean) => {
        const probabilities = amps.map((z) => z[0] * z[0] + z[1] * z[1]);
        const p0 = (probabilities[0] ?? 0) + (probabilities[1] ?? 0) + (probabilities[2] ?? 0) + (probabilities[3] ?? 0);
        return {
            alpha,
            theta,
            phi,
            amplitudes: flat(amps),
            probabilities,
            ancillaZeroProb: p0,
            overlapSquared,
            fidelity: measured ? 2 * p0 - 1 : 0,
            norm: probabilities.reduce((sum, p) => sum + p, 0),
            done,
        };
    };

    let state: Complex[] = Array.from({ length: 8 }, () => [0, 0] as Complex);
    for (let b1 = 0; b1 < 2; b1 += 1) {
        for (let b2 = 0; b2 < 2; b2 += 1) {
            const a = psi[b1]!;
            const b = other[b2]!;
            state[2 * b1 + b2] = [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
        }
    }
    yield {
        stepNumber: 0,
        entities: makeBars(state, [0, 1, 2, 3], false),
        edges: [],
        description: "Prepared the two single-qubit data states with the ancilla still in |0>.",
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(state, false, false),
    };

    const firstHadamard = state.map((z) => [...z] as Complex);
    for (let i = 0; i < 4; i += 1) {
        const a = state[i]!;
        firstHadamard[i] = [a[0] * INV_SQRT2, a[1] * INV_SQRT2];
        firstHadamard[i + 4] = [a[0] * INV_SQRT2, a[1] * INV_SQRT2];
    }
    state = firstHadamard;
    yield {
        stepNumber: 1,
        entities: makeBars(state, [0, 4], false),
        edges: [],
        description: "A Hadamard on the ancilla creates an equal superposition of controlling and not controlling the swap.",
        codeLineNumber: 1,
        layout: "array",
        meta: metaFor(state, false, false),
    };

    const swapped = state.map((z) => [...z] as Complex);
    for (const b1 of [0, 1]) {
        for (const b2 of [0, 1]) {
            if (b1 === b2) continue;
            const from = 4 + 2 * b1 + b2;
            const to = 4 + 2 * b2 + b1;
            swapped[from] = state[to]!;
            swapped[to] = state[from]!;
        }
    }
    state = swapped;
    yield {
        stepNumber: 2,
        entities: makeBars(state, [5, 6], false),
        edges: [],
        description: "Controlled-SWAP exchanges the data qubits only on the ancilla-one branch, encoding their symmetry into phases.",
        codeLineNumber: 2,
        layout: "array",
        meta: metaFor(state, false, false),
    };

    const final = state.map((z) => [...z] as Complex);
    for (let i = 0; i < 4; i += 1) {
        const a = state[i]!;
        const b = state[i + 4]!;
        final[i] = [(a[0] + b[0]) * INV_SQRT2, (a[1] + b[1]) * INV_SQRT2];
        final[i + 4] = [(a[0] - b[0]) * INV_SQRT2, (a[1] - b[1]) * INV_SQRT2];
    }
    state = final;
    yield {
        stepNumber: 3,
        entities: makeBars(state, [0, 1, 2, 3], false),
        edges: [],
        description: "The final Hadamard interferes the two ancilla branches so the zero outcome probability reveals the overlap.",
        codeLineNumber: 3,
        layout: "array",
        meta: metaFor(state, true, false),
    };

    yield {
        stepNumber: 4,
        entities: makeBars(state, [], true),
        edges: [],
        description: `Measured ancilla-zero probability ${metaFor(state, true, true).ancillaZeroProb.toFixed(4)} gives squared overlap ${metaFor(state, true, true).overlapSquared.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: metaFor(state, true, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The SWAP test measures how alike two quantum states are without learning either state completely. A control qubit asks both branches to swap the data or leave it alone; if the two states are identical the swap does nothing and the branches interfere constructively. The more different the states are, the more likely the control is to read one, and the probability directly gives their squared inner product.",
        invariants: [
            "The data subsystem is always returned to a valid pure state; the ancilla carries the read-out information.",
            "Every gate is unitary, so the total probability stays one.",
            "The probability of measuring ancilla zero is one half times one plus the squared overlap.",
        ],
        correctness:
            "Write the joint data state as a product of the two input states. Controlled-SWAP maps the ancilla-plus branch to the swapped product and leaves the ancilla-minus branch unchanged. After the final Hadamard the amplitude for ancilla zero is proportional to the symmetric part of the product, whose squared norm is (1 plus the absolute inner product squared) over two. Solving for the inner product gives twice the zero probability minus one, exactly the fidelity of two pure states. Identical states give one; orthogonal states give zero.",
        complexityRationale:
            "The simulation evolves eight complex amplitudes through three constant-size gates, so it runs in constant time and memory for one pair of single-qubit states. On hardware the circuit uses one ancilla and a controlled-SWAP decomposed into three controlled-NOT gates, independent of the dimension of the data states.",
        uses: [
            "Estimating state fidelity and overlap on quantum processors",
            "Quantum kernel methods and support vector machines",
            "Comparing generated states in variational algorithms",
        ],
        references: [
            "Buhrman, Cleve, Watrous, and de Wolf, Quantum Fingerprinting, 2001",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 6",
        ],
        workedExample:
            "Comparing |0> with (|0> plus |1>) over the square root of two gives an overlapping amplitude of one over the square root of two and a squared overlap of one half. The ancilla-zero probability is three quarters, so twice that minus one recovers one half.",
    },
    id: "quantum-swap-test",
    name: "Quantum SWAP Test",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { alpha: 0, theta: 0.7853981633974483, phi: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "prepare two data qubits in the states to compare",
        "place the ancilla qubit in the plus state",
        "apply a controlled swap of the two data qubits",
        "apply a Hadamard gate to the ancilla",
        "measure the probability that the ancilla reads zero",
        "set the squared overlap to twice that probability minus one",
        "done: report the estimated fidelity of the two states",
    ],
};

export default module;
