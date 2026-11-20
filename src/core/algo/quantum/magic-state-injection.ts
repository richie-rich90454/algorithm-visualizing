/**
 * magic-state-injection.ts - T Gate by Magic-State Injection
 *
 * A non-Clifford T gate cannot be applied by Clifford gates alone, but it can
 * be teleported in using a pre-distilled magic state. The data qubit controls a
 * CNOT into the magic ancilla, the ancilla is measured in the computational
 * basis, and a Clifford S correction is applied when the outcome is one. Both
 * branches leave the data qubit in the state T times its input, up to a global
 * phase.
 *
 * This is an exact state-vector simulation of two qubits, limited to the ideal
 * circuit: perfect magic states, noiseless Clifford gates, and projective
 * measurements. It does not model distillation cost, faulty ancillas, or the
 * Pauli frame tracking used on real hardware.
 *
 * Time:  O(1) for the four-amplitude state vector
 * Space: O(1) for the joint and branch states
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

type Amplitude = [Complex, Complex];

interface InjectionInput {
    data?: [[number, number], [number, number]] | number[];
}

function cMul(a: Complex, b: Complex): Complex {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function cAbs(a: Complex): number {
    return Math.hypot(a[0], a[1]);
}

function normalize(state: Amplitude): Amplitude {
    const norm = Math.sqrt(cAbs(state[0]) ** 2 + cAbs(state[1]) ** 2);
    if (norm < 1e-14) {
        return [[1, 0], [0, 0]];
    }
    return [
        [state[0][0] / norm, state[0][1] / norm],
        [state[1][0] / norm, state[1][1] / norm],
    ];
}

function makeBars(state: Complex[], highlight: number, final: boolean): VisualEntity[] {
    const probs = state.map((amp) => cAbs(amp) ** 2);
    const labels = ["data 0, anc 0", "data 0, anc 1", "data 1, anc 0", "data 1, anc 1"];
    return [0, 1, 2, 3].map((index) => {
        const amp = state[index] ?? [0, 0];
        const probability = probs[index] ?? 0;
        return {
            id: `amp-${index}`,
            type: "bar" as const,
            label: `${labels[index]}: ${probability.toFixed(3)}`,
            value: probability,
            state: final ? "sorted" : index === highlight ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, basis: labels[index] ?? "", re: amp[0] ?? 0, im: amp[1] ?? 0 },
        };
    });
}

function jointState(data: Amplitude): Complex[] {
    const magic0: Complex = [1 / Math.SQRT2, 0];
    const magic1: Complex = [Math.cos(Math.PI / 4) / Math.SQRT2, Math.sin(Math.PI / 4) / Math.SQRT2];
    return [
        cMul(data[0], magic0),
        cMul(data[0], magic1),
        cMul(data[1], magic0),
        cMul(data[1], magic1),
    ];
}

function branch(joint: Complex[], outcome: number): Amplitude {
    return normalize([
        joint[outcome] ?? [0, 0],
        joint[outcome + 2] ?? [0, 0],
    ]);
}

function applyS(state: Amplitude): Amplitude {
    return [state[0], [-state[1][1], state[1][0]]];
}

function idealT(data: Amplitude): Amplitude {
    return normalize([data[0], cMul(data[1], [Math.cos(Math.PI / 4), Math.sin(Math.PI / 4)])]);
}

function overlap(a: Amplitude, b: Amplitude): number {
    let re = 0;
    let im = 0;
    for (let i = 0; i < 2; i += 1) {
        const x = a[i] ?? [0, 0];
        const y = b[i] ?? [0, 0];
        re += x[0] * y[0] + x[1] * y[1];
        im += x[0] * y[1] - x[1] * y[0];
    }
    return Math.hypot(re, im);
}

function toBars(data: Amplitude, highlight: number, final: boolean): VisualEntity[] {
    return data.map((amp, index) => ({
        id: `qubit-${index}`,
        type: "bar" as const,
        label: `${index}: ${cAbs(amp).toFixed(4)}`,
        value: cAbs(amp) ** 2,
        state: final ? "sorted" : index === highlight ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, re: amp[0], im: amp[1] },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as InjectionInput | null) ?? {};
    let data: Amplitude = [
        [1 / Math.SQRT2, 0],
        [1 / Math.SQRT2, 0],
    ];
    if (Array.isArray(task.data) && task.data.length === 2) {
        const first = task.data[0];
        const second = task.data[1];
        if (Array.isArray(first) && Array.isArray(second)) {
            data = normalize([
                [Number(first[0]) || 0, Number(first[1]) || 0],
                [Number(second[0]) || 0, Number(second[1]) || 0],
            ]);
        }
    }
    const joint = jointState(data);
    const beforeCnot = [...joint] as Complex[];
    const swapped = [...joint] as Complex[];
    const tmp = swapped[2];
    swapped[2] = swapped[3] ?? [0, 0];
    swapped[3] = tmp ?? [0, 0];

    const p0 = cAbs(swapped[0] ?? [0, 0]) ** 2 + cAbs(swapped[2] ?? [0, 0]) ** 2;
    const p1 = cAbs(swapped[1] ?? [0, 0]) ** 2 + cAbs(swapped[3] ?? [0, 0]) ** 2;
    const out0 = branch(swapped, 0);
    const out1 = branch(swapped, 1);
    const corrected1 = applyS(out1);
    const target = idealT(data);

    const metaFor = (outcome: number, correction: string, state: Amplitude, done: boolean) => ({
        outcome,
        correction,
        probability: outcome === 0 ? p0 : p1,
        amplitudes: state.map((amp) => [amp[0], amp[1]]),
        fidelity: overlap(state, target),
        ideal: target.map((amp) => [amp[0], amp[1]]),
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(beforeCnot, -1, false),
        edges: [],
        description: "Prepare the data qubit and the magic state T plus, then entangle them with CNOT.",
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(-1, "none", data, false),
    };

    yield {
        stepNumber: 1,
        entities: makeBars(swapped, -1, false),
        edges: [],
        description: `CNOT applied; measuring the ancilla gives zero with probability ${p0.toFixed(4)} and one with probability ${p1.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: metaFor(-1, "none", data, false),
    };

    yield {
        stepNumber: 2,
        entities: toBars(out0, 0, false),
        edges: [],
        description: "Outcome zero: the data qubit already holds T times the input, so no correction is needed.",
        codeLineNumber: 3,
        layout: "array",
        meta: metaFor(0, "none", out0, false),
    };

    yield {
        stepNumber: 3,
        entities: toBars(out1, 1, false),
        edges: [],
        description: "Outcome one: the data qubit holds T-dagger times the input up to a global phase.",
        codeLineNumber: 4,
        layout: "array",
        meta: metaFor(1, "pending", out1, false),
    };

    yield {
        stepNumber: 4,
        entities: toBars(corrected1, 1, false),
        edges: [],
        description: "Apply an S correction on outcome one to convert T-dagger into T.",
        codeLineNumber: 5,
        layout: "array",
        meta: metaFor(1, "S", corrected1, false),
    };

    yield {
        stepNumber: 5,
        entities: toBars(target, -1, true),
        edges: [],
        description: `Both branches now match the ideal T gate; branch fidelities ${overlap(out0, target).toFixed(5)} and ${overlap(corrected1, target).toFixed(5)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: metaFor(-1, "branch-dependent", target, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Clifford gates alone can only permute stabilizer states, so a universal quantum computer needs one extra gate such as T. Instead of applying T directly, consume a pre-made magic state with a circuit made only of Cliffords and a measurement. The CNOT transfers the phase of the magic state onto the data qubit; the measurement outcome decides whether a simple Clifford correction is needed. The fragile non-Clifford work is done once when the magic state is distilled, then injected cheaply whenever a T gate is required.",
        invariants: [
            "Both measurement branches are corrected to the same target state up to global phase.",
            "The CNOT is its own inverse, so the joint state before measurement stays normalized.",
            "The correction for outcome one is a Clifford S gate, which is fault-tolerantly implementable.",
        ],
        correctness:
            "Let the data be a times zero plus b times one and the magic state be zero plus exp(i pi/4) times one, both normalized. After the CNOT, measuring zero leaves a times zero plus b exp(i pi/4) times one, exactly T applied to the data. Measuring one leaves exp(i pi/4) times a times zero plus b times one, which is T-dagger up to global phase; multiplying the one amplitude by i, the S gate, converts T-dagger to T up to global phase. Both branches therefore implement the same logical gate.",
        complexityRationale:
            "The circuit has a fixed two-qubit state of four complex amplitudes and a constant number of gates, so both time and space are constant. The cost of preparing the magic state is accounted for by the distillation step, not by this injection circuit.",
        uses: [
            "Completing a universal fault-tolerant gate set with magic states",
            "Applying non-Clifford phases in surface-code quantum computers",
            "A teaching example of gate teleportation and measurement-based correction",
        ],
        references: [
            "Gottesman and Chuang, Demonstrating the Validity of Transferring Quantum States, 1999",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 10",
        ],
        workedExample:
            "For the input plus state, the magic state phase is transferred by the CNOT. An ancilla outcome of zero leaves the data at zero plus exp(i pi/4) times one, the T of plus. An outcome of one leaves the conjugate phase, and applying S restores the same T state; each branch occurs with probability one half.",
    },
    id: "magic-state-injection",
    name: "Magic State Injection",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: {
        data: [
            [0.7071067811865476, 0],
            [0.7071067811865476, 0],
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "prepare the data qubit in the desired input state",
        "prepare an ancilla in the T magic state",
        "apply a CNOT from data to ancilla",
        "measure the ancilla in the computational basis",
        "if the outcome is zero, keep the data unchanged",
        "if the outcome is one, apply an S gate to the data",
        "discard the ancilla and keep the corrected data",
        "done: the data now holds the T gate applied to its input",
    ],
};

export default module;
