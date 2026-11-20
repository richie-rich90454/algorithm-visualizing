/**
 * hadamard-test.ts - Hadamard Test (exact small simulator)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Hadamard test estimates the real part of an expectation value of a
 * unitary U in a state psi using one ancilla qubit. The ancilla is put in a
 * uniform superposition, U is applied conditionally on the system, and a
 * second Hadamard maps the interference back into the ancilla measurement
 * probability. Measuring ancilla zero with probability p gives Re(psi-dagger U
 * psi) equal to 2p minus 1.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an exact state-vector simulation of one ancilla and one system
 * qubit with a phase unitary diag(1, exp(i theta)) and a real state
 * cos(phi)|0> + sin(phi)|1>. It is not a physical device: no sampling noise,
 * decoherence, finite gate fidelity, or many-shot statistics are modeled.
 * The measured probability is computed exactly, not estimated from shots.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(4) for a two-qubit state; Space: O(4) amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four bars show the probability of each two-qubit basis state.
 *   - The ancilla-zero pair is highlighted after the final Hadamard.
 *   - The final frame reports the inferred real expectation value.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Complex {
    re: number;
    im: number;
}

const c = (re: number, im = 0): Complex => ({ re, im });
const add = (a: Complex, b: Complex): Complex => c(a.re + b.re, a.im + b.im);
const sub = (a: Complex, b: Complex): Complex => c(a.re - b.re, a.im - b.im);
const scale = (a: Complex, s: number): Complex => c(a.re * s, a.im * s);
const abs2 = (a: Complex): number => a.re * a.re + a.im * a.im;
const INV_SQRT2 = Math.SQRT1_2;

function bars(probs: number[], highlight: number[]): VisualEntity[] {
    const labels = ["|00>", "|01>", "|10>", "|11>"];
    return probs.map((p, index) => ({
        id: `amp-${index}`,
        type: "bar" as const,
        label: `${labels[index]}: ${p.toFixed(3)}`,
        value: p,
        state: (highlight.includes(index) ? "active" : "comparing") as VisualEntity["state"],
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability: p, basis: labels[index] ?? "" },
    }));
}

function probsOf(state: Complex[]): number[] {
    return state.map(abs2);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { theta?: number; phi?: number } | null) ?? {};
    const theta = typeof task.theta === "number" ? task.theta : 1.0;
    const phi = typeof task.phi === "number" ? task.phi : 0.6;

    const a0 = Math.cos(phi);
    const a1 = Math.sin(phi);
    const state: Complex[] = [c(a0), c(a1), c(0), c(0)];
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(probsOf(state), [0, 1]),
        edges: [],
        description: `Prepare the system state cos(phi)|0> + sin(phi)|1> with ancilla zero, where phi is ${phi.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { theta, phi, phase: 0 },
    };
    step += 1;

    for (let s = 0; s < 2; s += 1) {
        const low = state[s] ?? c(0);
        const high = state[2 + s] ?? c(0);
        state[s] = scale(add(low, high), INV_SQRT2);
        state[2 + s] = scale(sub(low, high), INV_SQRT2);
    }
    yield {
        stepNumber: step,
        entities: bars(probsOf(state), [0, 1, 2, 3]),
        edges: [],
        description: `Apply a Hadamard to the ancilla, creating a uniform superposition over the two ancilla branches.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { theta, phi, phase: 1 },
    };
    step += 1;

    const phase = c(Math.cos(theta), Math.sin(theta));
    const systemOne = state[3] ?? c(0);
    state[3] = c(systemOne.re * phase.re - systemOne.im * phase.im, systemOne.re * phase.im + systemOne.im * phase.re);
    yield {
        stepNumber: step,
        entities: bars(probsOf(state), [3]),
        edges: [],
        description: `Apply controlled-U with phase ${theta.toFixed(3)} on the system only in the ancilla-one branch.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { theta, phi, phase: 2 },
    };
    step += 1;

    for (let s = 0; s < 2; s += 1) {
        const low = state[s] ?? c(0);
        const high = state[2 + s] ?? c(0);
        state[s] = scale(add(low, high), INV_SQRT2);
        state[2 + s] = scale(sub(low, high), INV_SQRT2);
    }
    const probs = probsOf(state);
    const p0 = (probs[0] ?? 0) + (probs[1] ?? 0);
    const p1 = (probs[2] ?? 0) + (probs[3] ?? 0);
    const estimate = 2 * p0 - 1;
    const directValue = a0 * a0 + a1 * a1 * Math.cos(theta);

    yield {
        stepNumber: step,
        entities: bars(probs, [0, 1]),
        edges: [],
        description: `Apply the final Hadamard and read the ancilla: p0 is ${p0.toFixed(4)}, so the real expectation is ${estimate.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { theta, phi, phase: 3, p0, p1, estimate, directValue },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(probs, [0, 1]),
        edges: [],
        description: `The Hadamard test returns ${estimate.toFixed(4)}, matching the direct expectation ${directValue.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { theta, phi, p0, p1, estimate, directValue, error: Math.abs(estimate - directValue) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Put an ancilla qubit into a superposition of doing nothing and applying the unitary. Those two branches interfere when the ancilla is measured, and the interference pattern depends on how much the unitary leaves the state unchanged. Reading the ancilla probability therefore reveals a quantity that is not directly observable as a single measurement of the system.",
        invariants: [
            "The joint two-qubit state stays normalized after every gate.",
            "The ancilla-zero probability is one plus the real expectation value, all divided by two.",
            "For a phase unitary the real expectation equals cos(phi) squared plus sin(phi) squared times cos(theta).",
        ],
        correctness:
            "After the first Hadamard the state is the tensor sum of the ancilla-zero branch holding psi and the ancilla-one branch holding U psi. A second Hadamard on the ancilla produces an ancilla-zero component proportional to psi plus U psi, whose squared norm is one half of one plus the real part of the inner product of psi with U psi. Hence p0 equals one plus the real expectation over two, and rearranging gives the estimator two p0 minus one. For the phase model the inner product is cos(phi) squared plus sin(phi) squared times exp(i theta), whose real part matches the direct calculation.",
        complexityRationale:
            "The state has four complex amplitudes and each of the three circuit stages touches a constant number of them, giving constant time and constant space. A physical implementation would instead need many shots to estimate p0 to a desired precision.",
        uses: [
            "Estimating expectation values of unitaries on quantum processors",
            "Variational algorithms that measure overlap and kernel entries",
            "Verifying a unitary by measuring its diagonal matrix elements",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information (2010), Section 4.2",
            "Aharonov, Englert and Scully, On the Hadamard Test (1993)",
        ],
        workedExample:
            "With phi equal to zero the state is |0>. The phase gate leaves the amplitude at 1 while the branch |1> is absent, so the expectation is 1 for any theta. The final ancilla-zero probability is 1 and the estimator two times one minus one returns 1, matching the direct value.",
    },
    id: "hadamard-test",
    name: "Hadamard Test",
    category: "quantum",
    complexity: { time: "O(1) state update", space: "O(1)" },
    defaultInput: { theta: 1.0, phi: 0.6 },
    visualType: "array",
    run,
    pseudocode: [
        "prepare the system state and set the ancilla to zero",
        "apply a Hadamard gate to the ancilla",
        "apply the unitary controlled on the ancilla being one",
        "apply a second Hadamard gate to the ancilla",
        "compute the probability of measuring ancilla zero",
        "return twice that probability minus one",
        "compare against the directly computed expectation",
    ],
};

export default module;
