/**
 * measurement-based-quantum-computing.ts - Measurement-Based Quantum Computing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In measurement-based quantum computing, computation is driven by measuring
 * qubits of a pre-entangled cluster state rather than by applying gates one
 * after another. This module implements the smallest complete example: a
 * three-qubit cluster chain that teleports an arbitrary one-qubit state from
 * the first site to the last. The two middle measurements in the X basis
 * produce random bits, and Pauli corrections based on those bits recover the
 * original state at the output, implementing the identity gate.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^3) = O(1) for the three-qubit cluster
 *   Space: O(2^3) = O(1) for the eight amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Eight bars show the probabilities of the three-qubit basis states.
 *   - The measured qubits are highlighted as the cluster is consumed.
 *   - Frame metadata carries the measurement outcomes, the corrections, and
 *     the input and output one-qubit states for direct verification.
 *
 * This is an exact three-qubit state-vector simulation. It models ideal
 * cluster preparation and projective measurements only; noise, finite
 * squeezing, and large cluster graphs are outside this small demonstration.
 * A seeded classical generator supplies the random measurement outcomes so the
 * visualization replays deterministically.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

const add = (a: Complex, b: Complex): Complex => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Complex, b: Complex): Complex => [a[0] - b[0], a[1] - b[1]];
const scale = (a: Complex, k: number): Complex => [a[0] * k, a[1] * k];
const norm2 = (a: Complex): number => a[0] * a[0] + a[1] * a[1];

function makeBars(state: Complex[], measuredQubit: number | null): VisualEntity[] {
    return state.map((amp, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `|${index.toString(2).padStart(3, "0")}> ${norm2(amp).toFixed(3)}`,
        value: norm2(amp),
        state: measuredQubit === null ? "idle" : "comparing",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability: norm2(amp) },
    }));
}

/** Measure one qubit in the X basis, projecting and renormalizing the state. */
function measureX(state: Complex[], qubit: number, uniform: () => number): number {
    const mask = 1 << (2 - qubit);
    let plusWeight = 0;
    for (let i = 0; i < state.length; i += 1) {
        if (i & mask) {
            continue;
        }
        const j = i | mask;
        plusWeight += norm2(scale(add(state[i] ?? [0, 0], state[j] ?? [0, 0]), 0.5));
    }
    plusWeight *= 2;
    const outcome = uniform() < plusWeight ? 0 : 1;
    let keptWeight = 0;
    const next: Complex[] = new Array(8).fill([0, 0]);
    for (let i = 0; i < state.length; i += 1) {
        if (i & mask) {
            continue;
        }
        const j = i | mask;
        const ai = state[i] ?? [0, 0];
        const aj = state[j] ?? [0, 0];
        const combined = scale(outcome === 0 ? add(ai, aj) : sub(ai, aj), 0.5);
        next[i] = combined;
        next[j] = outcome === 0 ? combined : scale(combined, -1);
        keptWeight += 2 * norm2(combined);
    }
    const factor = keptWeight > 0 ? 1 / Math.sqrt(keptWeight) : 0;
    for (let i = 0; i < state.length; i += 1) {
        state[i] = scale(next[i] ?? [0, 0], factor);
    }
    return outcome;
}

function flipQubit(state: Complex[], qubit: number): void {
    const mask = 1 << (2 - qubit);
    for (let i = 0; i < state.length; i += 1) {
        if (i & mask) {
            continue;
        }
        const j = i | mask;
        const tmp = state[i]!;
        state[i] = state[j]!;
        state[j] = tmp;
    }
}

function phaseQubit(state: Complex[], qubit: number): void {
    const mask = 1 << (2 - qubit);
    for (let i = 0; i < state.length; i += 1) {
        if (i & mask) {
            state[i] = scale(state[i]!, -1);
        }
    }
}

/** The measurement-based quantum computing generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { theta?: number; seed?: number } | null) ?? {};
    const theta = typeof task.theta === "number" ? task.theta : Math.PI / 3;
    const inputState: Complex[] = [[Math.cos(theta / 2), 0], [Math.sin(theta / 2), 0]];
    let seed = (typeof task.seed === "number" ? task.seed : 2026) >>> 0;
    const uniform = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };

    const state: Complex[] = new Array(8).fill([0, 0]);
    for (let a = 0; a < 2; a += 1) {
        for (let b = 0; b < 2; b += 1) {
            for (let c = 0; c < 2; c += 1) {
                state[a * 4 + b * 2 + c] = scale(inputState[a] ?? [0, 0], 0.5);
            }
        }
    }

    const meta = (extra: object) => ({
        inputAmplitudes: inputState.map((c) => c[0]),
        amplitudesRe: state.map((c) => c[0]),
        amplitudesIm: state.map((c) => c[1]),
        probabilities: state.map((c) => norm2(c)),
        ...extra,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(state, null),
        edges: [],
        description: `Preparing a three-qubit cluster with input amplitudes ${inputState[0]?.[0].toFixed(3)}, ${inputState[1]?.[0].toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta({ phase: "prepare" }),
    };
    step += 1;

    for (let i = 0; i < state.length; i += 1) {
        if ((i & 4) !== 0 && (i & 2) !== 0) {
            state[i] = scale(state[i]!, -1);
        }
    }
    yield {
        stepNumber: step,
        entities: makeBars(state, null),
        edges: [],
        description: "Controlled-Z between the input site and the middle site entangles the first pair.",
        codeLineNumber: 1,
        layout: "array",
        meta: meta({ phase: "cz-1" }),
    };
    step += 1;

    for (let i = 0; i < state.length; i += 1) {
        if ((i & 2) !== 0 && (i & 1) !== 0) {
            state[i] = scale(state[i]!, -1);
        }
    }
    yield {
        stepNumber: step,
        entities: makeBars(state, null),
        edges: [],
        description: "Controlled-Z between the middle and output sites completes the cluster chain.",
        codeLineNumber: 2,
        layout: "array",
        meta: meta({ phase: "cz-2" }),
    };
    step += 1;

    const middleOutcome = measureX(state, 1, uniform);
    yield {
        stepNumber: step,
        entities: makeBars(state, 1),
        edges: [],
        description: `Measuring the middle qubit in the X basis gives outcome ${middleOutcome}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: meta({ phase: "measure-middle", middleOutcome }),
    };
    step += 1;

    const inputOutcome = measureX(state, 0, uniform);
    yield {
        stepNumber: step,
        entities: makeBars(state, 0),
        edges: [],
        description: `Measuring the input qubit in the X basis gives outcome ${inputOutcome}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: meta({ phase: "measure-input", middleOutcome, inputOutcome }),
    };
    step += 1;

    if (middleOutcome === 1) {
        flipQubit(state, 2);
    }
    if (inputOutcome === 1) {
        phaseQubit(state, 2);
    }
    yield {
        stepNumber: step,
        entities: makeBars(state, null),
        edges: [],
        description: `Applying X to the output when the middle bit is 1 and Z when the input bit is 1 (${middleOutcome}, ${inputOutcome}).`,
        codeLineNumber: 5,
        layout: "array",
        meta: meta({ phase: "corrections", middleOutcome, inputOutcome }),
    };
    step += 1;

    const sign = (outcome: number, bit: number) => (outcome === 1 && bit === 1 ? -1 : 1) * Math.SQRT1_2;
    const weightA = [sign(inputOutcome, 0), sign(inputOutcome, 1)];
    const weightB = [sign(middleOutcome, 0), sign(middleOutcome, 1)];
    const out0: Complex = [0, 0];
    const out1: Complex = [0, 0];
    for (let a = 0; a < 2; a += 1) {
        for (let b = 0; b < 2; b += 1) {
            const w = (weightA[a] ?? 0) * (weightB[b] ?? 0);
            out0[0] = out0[0] + w * (state[a * 4 + b * 2]?.[0] ?? 0);
            out0[1] = out0[1] + w * (state[a * 4 + b * 2]?.[1] ?? 0);
            out1[0] = out1[0] + w * (state[a * 4 + b * 2 + 1]?.[0] ?? 0);
            out1[1] = out1[1] + w * (state[a * 4 + b * 2 + 1]?.[1] ?? 0);
        }
    }
    const magnitude = Math.hypot(out0[0], out0[1], out1[0], out1[1]) || 1;
    const outputState: Complex[] = [scale(out0, 1 / magnitude), scale(out1, 1 / magnitude)];
    yield {
        stepNumber: step,
        entities: makeBars(state, null),
        edges: [],
        description: `The output qubit holds the original state (up to an overall phase): ${outputState[0]?.[0].toFixed(3)}, ${outputState[1]?.[0].toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            ...meta({ phase: "done", middleOutcome, inputOutcome }),
            outputAmplitudes: outputState.map((c) => c[0]),
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of applying gates, prepare a tangled cluster of qubits and then measure them. The act of measurement, combined with corrections chosen from earlier outcomes, drives a computation forward. In the smallest chain, measuring the middle and input qubits in the X basis teleports an unknown one-qubit state to the far end, so the cluster behaves like an identity gate even though no gate was applied to the output.",
        invariants: [
            "Each measurement projects the state and the amplitudes are renormalized to norm one.",
            "The output corrections are classical bits derived from earlier measurements.",
            "After corrections the output qubit equals the input state up to a global phase.",
        ],
        correctness:
            "Writing the cluster in the computational basis, projecting the middle qubit onto an X eigenstate leaves the first and last qubits correlated. Projecting the input qubit onto an X eigenstate then leaves the last qubit in the original state up to Pauli X (from the middle outcome) and Z (from the input outcome) errors. Applying X when the middle bit is one and Z when the input bit is one removes those errors exactly, so the reduced state of the output qubit matches the input amplitude vector up to an irrelevant global phase.",
        complexityRationale:
            "The cluster has three qubits, so its state has eight amplitudes and each projection touches each amplitude a constant number of times, giving constant time and space. A general cluster of n qubits would require O(2^n) amplitudes in a direct simulation, which is why this demonstration is limited to the smallest useful chain.",
        uses: [
            "One-way quantum computing with cluster states",
            "Teleporting quantum information between sites of a network",
            "A teaching model for feed-forward and measurement-driven gates",
        ],
        references: [
            "Raussendorf and Briegel, A One-Way Quantum Computer, 2001",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 10",
        ],
        workedExample:
            "Preparing an input state at 60 degrees on the Bloch sphere, the cluster CZ gates entangle three qubits. Measuring the middle qubit gives, say, outcome 1, so an X correction is queued; measuring the input gives outcome 0, so no Z is needed. After the X flip, the output qubit reproduces the 60-degree state exactly.",
    },
    id: "measurement-based-quantum-computing",
    name: "Measurement-Based Quantum Computing",
    category: "quantum",
    complexity: { time: "O(1) for three qubits", space: "O(1) for three qubits" },
    defaultInput: { theta: Math.PI / 3, seed: 2026 },
    visualType: "array",
    run,
    pseudocode: [
        "prepare the input qubit and two plus-state qubits in a chain",
        "apply controlled-Z between neighboring sites to build the cluster",
        "measure the middle qubit in the X basis and record the bit m",
        "measure the input qubit in the X basis and record the bit n",
        "apply an X correction to the output when m is one",
        "apply a Z correction to the output when n is one",
        "read out the reduced state of the output qubit",
        "done: the output matches the input up to a global phase",
    ],
};

export default module;
