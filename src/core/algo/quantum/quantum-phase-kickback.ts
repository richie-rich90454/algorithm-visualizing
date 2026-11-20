/**
 * quantum-phase-kickback.ts - Phase Kickback from a Controlled Phase Gate
 *
 * A two-qubit exact simulation of the primitive behind phase estimation: the
 * control is placed in an equal superposition, the target is prepared in an
 * eigenstate of the phase gate P(theta) with eigenvalue exp(i theta), and the
 * controlled operation transfers that eigenvalue into a relative phase of the
 * control qubit. Applying a Hadamard to the control converts the hidden phase
 * into a measurable probability. This ideal pure-state model covers theta in
 * [0, pi] with exact complex amplitudes; it does not include decoherence,
 * imperfect gates, or shot noise.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface KickbackInput {
    theta?: number;
}

const INV_SQRT2 = Math.SQRT1_2;

function makeBars(amps: Complex[], highlight: number[], final: boolean): VisualEntity[] {
    return amps.map((z, index) => {
        const probability = z[0] * z[0] + z[1] * z[1];
        const control = Math.floor(index / 2);
        return {
            id: `basis-${index}`,
            type: "bar" as const,
            label: `|${control}${index % 2}>: ${probability.toFixed(4)}`,
            value: probability,
            state: final ? "sorted" : highlight.includes(index) ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, control, target: index % 2, probability, re: z[0], im: z[1] },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as KickbackInput | null) ?? {};
    const theta = typeof task.theta === "number" && Number.isFinite(task.theta)
        ? Math.max(0, Math.min(Math.PI, task.theta))
        : 1.2;
    const ctheta = Math.cos(theta);
    const stheta = Math.sin(theta);
    const flat = (amps: Complex[]): number[] => amps.flatMap((z) => [z[0], z[1]]);
    const metaFor = (amps: Complex[], phaseApplied: boolean, measured: boolean, done: boolean) => {
        const probabilities = amps.map((z) => z[0] * z[0] + z[1] * z[1]);
        const p0 = (probabilities[0] ?? 0) + (probabilities[1] ?? 0);
        const p1 = (probabilities[2] ?? 0) + (probabilities[3] ?? 0);
        return {
            theta,
            amplitudes: flat(amps),
            probabilities,
            controlProb0: p0,
            controlProb1: p1,
            targetProb1: (probabilities[1] ?? 0) + (probabilities[3] ?? 0),
            eigenphase: phaseApplied ? theta : 0,
            thetaRecovered: measured ? Math.acos(Math.max(-1, Math.min(1, 1 - 2 * p1))) : 0,
            norm: probabilities.reduce((sum, p) => sum + p, 0),
            done,
        };
    };

    let state: Complex[] = [[0, 0], [INV_SQRT2, 0], [0, 0], [INV_SQRT2, 0]];
    yield {
        stepNumber: 0,
        entities: makeBars(state, [1, 3], false),
        edges: [],
        description: `Prepared the control in the plus state and the target in |1>, an eigenstate of P(theta) with eigenvalue exp(i ${theta.toFixed(3)}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(state, false, false, false),
    };

    yield {
        stepNumber: 1,
        entities: makeBars(state, [1, 3], false),
        edges: [],
        description: "The target eigenvalue is a global phase on the target alone; nothing is visible until the control is entangled with it.",
        codeLineNumber: 1,
        layout: "array",
        meta: { ...metaFor(state, false, false, false), eigenvalue: [ctheta, stheta] },
    };

    state = [state[0]!, state[1]!, state[2]!, [state[3]![0] * ctheta - state[3]![1] * stheta, state[3]![0] * stheta + state[3]![1] * ctheta]];
    yield {
        stepNumber: 2,
        entities: makeBars(state, [3], false),
        edges: [],
        description: "The controlled phase multiplies the |11> amplitude by exp(i theta), placing the target eigenvalue onto the control branch.",
        codeLineNumber: 3,
        layout: "array",
        meta: metaFor(state, true, false, false),
    };

    const next: Complex[] = state.map((z) => [...z] as Complex);
    for (const offset of [0, 1]) {
        const a = state[offset]!;
        const b = state[offset + 2]!;
        next[offset] = [(a[0] + b[0]) * INV_SQRT2, (a[1] + b[1]) * INV_SQRT2];
        next[offset + 2] = [(a[0] - b[0]) * INV_SQRT2, (a[1] - b[1]) * INV_SQRT2];
    }
    state = next;
    yield {
        stepNumber: 3,
        entities: makeBars(state, [1, 3], false),
        edges: [],
        description: "A Hadamard on the control converts the relative phase into different probabilities for measuring control zero or one.",
        codeLineNumber: 4,
        layout: "array",
        meta: metaFor(state, true, true, false),
    };

    yield {
        stepNumber: 4,
        entities: makeBars(state, [], true),
        edges: [],
        description: `Control-zero probability is ${((1 + ctheta) / 2).toFixed(4)}; the kickback angle is recovered from it exactly.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...metaFor(state, true, true, true), expectedControlProb0: (1 + ctheta) / 2 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If a target qubit sits in an eigenstate of a gate, applying that gate only multiplies the target by a phase. A controlled version does nothing when the control is zero and applies the phase when the control is one, so the phase stops being global and becomes a relative phase between the two control branches. This is called phase kickback because the property of the target shows up on the control.",
        invariants: [
            "The target remains in its original eigenstate throughout; only the control's relative phase changes.",
            "Both controlled operations are unitary, so total probability stays one.",
            "The control-zero probability after the final Hadamard equals (1 plus cos theta) over two.",
        ],
        correctness:
            "Writing the initial state as (|0> plus |1>) tensor |u> over the square root of two, where U|u> equals exp(i theta)|u>, the controlled-U gives (|0> plus exp(i theta)|1>) tensor |u> over the square root of two. The target is unchanged as a tensor factor, and the phase has moved to the control. A Hadamard maps that control state to amplitudes (1 plus exp(i theta)) over two and (1 minus exp(i theta)) over two, whose squared magnitudes are (1 plus cos theta) over two and (1 minus cos theta) over two. Inverting the first formula recovers theta.",
        complexityRationale:
            "One controlled phase and one Hadamard act on a four-element state vector, so the simulation uses constant time and constant memory. In an actual circuit the same two gates are constant depth, which is why kickback is a cheap primitive inside phase estimation.",
        uses: [
            "Phase estimation and quantum counting",
            "The oracle step of Grover search",
            "Reading eigenvalues in variational and Hamiltonian simulation circuits",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 5",
            "Cleve and Watrous, Fast Parallel Circuits for the Quantum Fourier Transform, 2000",
        ],
        workedExample:
            "With theta equal to pi over two, the controlled phase turns (|01> plus |11>) over the square root of two into (|01> plus i|11>) over the square root of two. The final Hadamard gives control-zero probability one half, and the control-one amplitude is real negative i over the square root of two, encoding the quarter-turn phase.",
    },
    id: "quantum-phase-kickback",
    name: "Quantum Phase Kickback",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { theta: 1.2 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the eigenphase theta of the target phase gate",
        "prepare the control in the plus state and the target in |1>",
        "apply the controlled phase gate to the two-qubit state",
        "observe that the target factor is unchanged and the control carries the phase",
        "apply a Hadamard gate to the control qubit",
        "compute the control measurement probability and invert it for theta",
        "done: report the recovered kickback angle",
    ],
};

export default module;
