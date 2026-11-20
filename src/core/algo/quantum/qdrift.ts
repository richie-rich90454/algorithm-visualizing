/**
 * qdrift.ts - QDrift Randomized Product Formula (exact small simulator)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * QDrift approximates the time evolution under a sum of Hamiltonians without
 * sorting or commuting terms. At each of N short time slices it samples one
 * term with probability proportional to that term's coefficient magnitude and
 * applies that term's full exponentiated contribution scaled so the average
 * evolution is correct. The result is a time-ordered product of random
 * two-by-two rotations whose expected channel converges to exp(-i H t).
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an exact state-vector simulation of one qubit with H equal to a X
 * plus b Z, using a fixed-seed deterministic pseudorandom sequence so the
 * replay is reproducible. It is not a physical quantum device: no gate noise,
 * measurement shots, or asymptotic convergence proof is implemented. Limits:
 * two Pauli terms, N at most twelve slices, exact arithmetic on two complex
 * amplitudes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(N) two-by-two rotations; Space: O(1) amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two bars show the evolving measurement probabilities.
 *   - The sampled term for the current slice is named in the caption.
 *   - The final frame reports the exact probabilities and the drift error.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Complex {
    re: number;
    im: number;
}

const c = (re: number, im = 0): Complex => ({ re, im });

function sampledTerms(seedInput: number, steps: number, pX: number): number[] {
    let seed = seedInput >>> 0;
    const out: number[] = [];
    for (let i = 0; i < steps; i += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        out.push(seed / 4294967296 < pX ? 0 : 1);
    }
    return out;
}

function applyTerm(state: Complex[], term: number, angle: number, sign: number): Complex[] {
    const cs = Math.cos(angle);
    const sn = Math.sin(angle) * sign;
    const p0 = term === 0 ? state[1] ?? c(0) : state[0] ?? c(0);
    const p1 = term === 0 ? state[0] ?? c(0) : c(-(state[1]?.re ?? 0), -(state[1]?.im ?? 0));
    const s0 = state[0] ?? c(0);
    const s1 = state[1] ?? c(0);
    return [
        c(cs * s0.re + sn * (p0.im ?? 0), cs * s0.im - sn * (p0.re ?? 0)),
        c(cs * s1.re + sn * (p1.im ?? 0), cs * s1.im - sn * (p1.re ?? 0)),
    ];
}

function bars(p0: number, p1: number, term: number): VisualEntity[] {
    return [
        {
            id: "amp-0",
            type: "bar" as const,
            label: `|0>: ${p0.toFixed(3)}`,
            value: p0,
            state: "active" as const,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: 0, probability: p0, term },
        },
        {
            id: "amp-1",
            type: "bar" as const,
            label: `|1>: ${p1.toFixed(3)}`,
            value: p1,
            state: "comparing" as const,
            x: 1,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: 1, probability: p1, term },
        },
    ];
}

function probs(state: Complex[]): [number, number] {
    const a = state[0] ?? c(0);
    const b = state[1] ?? c(0);
    return [a.re * a.re + a.im * a.im, b.re * b.re + b.im * b.im];
}

function exactProbs(a: number, b: number, phi: number, time: number): [number, number] {
    const theta = Math.hypot(a, b);
    const psi0 = Math.cos(phi);
    const psi1 = Math.sin(phi);
    if (theta < 1e-12) {
        return [psi0 * psi0, psi1 * psi1];
    }
    const cs = Math.cos(theta * time);
    const sn = Math.sin(theta * time) / theta;
    const re0 = cs * psi0;
    const im0 = -sn * (b * psi0 + a * psi1);
    const re1 = cs * psi1;
    const im1 = -sn * (a * psi0 - b * psi1);
    return [re0 * re0 + im0 * im0, re1 * re1 + im1 * im1];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number; phi?: number; t?: number; steps?: number; seed?: number } | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 1;
    const b = typeof task.b === "number" ? task.b : 0.5;
    const phi = typeof task.phi === "number" ? task.phi : 0.3;
    const totalTime = typeof task.t === "number" ? task.t : 1.5;
    const steps = Math.max(1, Math.min(12, typeof task.steps === "number" ? Math.floor(task.steps) : 8));
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 12345;

    const lambda = Math.abs(a) + Math.abs(b);
    const pX = lambda > 0 ? Math.abs(a) / lambda : 0.5;
    const terms = sampledTerms(seed, steps, pX);
    const signs = [a >= 0 ? 1 : -1, b >= 0 ? 1 : -1];
    const slice = lambda > 0 ? totalTime / steps : 0;

    let state: Complex[] = [c(Math.cos(phi)), c(Math.sin(phi))];
    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(...probs(state), -1),
        edges: [],
        description: `QDrift with ${steps} slices samples X with probability ${pX.toFixed(3)} and Z otherwise, using seed ${seed}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { a, b, phi, t: totalTime, steps, seed, pX, lambda },
    };
    step += 1;

    for (let i = 0; i < steps; i += 1) {
        const term = terms[i] ?? 0;
        const angle = lambda * slice;
        state = applyTerm(state, term, angle, signs[term] ?? 1);
        const [p0, p1] = probs(state);
        yield {
            stepNumber: step,
            entities: bars(p0, p1, term),
            edges: [],
            description: `Slice ${i + 1}: sampled ${term === 0 ? "X" : "Z"}, applied an exact rotation of angle ${angle.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { slice: i + 1, term, angle, p0, p1, sampled: [...terms.slice(0, i + 1)] },
        };
        step += 1;
    }

    const [fp0, fp1] = probs(state);
    const [ep0, ep1] = exactProbs(a, b, phi, totalTime);
    const error = Math.abs(fp0 - ep0) + Math.abs(fp1 - ep1);
    yield {
        stepNumber: step,
        entities: bars(fp0, fp1, -1),
        edges: [],
        description: `Drifted probabilities ${fp0.toFixed(4)}, ${fp1.toFixed(4)} versus exact ${ep0.toFixed(4)}, ${ep1.toFixed(4)}; total error ${error.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            a,
            b,
            phi,
            t: totalTime,
            steps,
            seed,
            p0: fp0,
            p1: fp1,
            exactP0: ep0,
            exactP1: ep1,
            error,
            sampled: [...terms],
            norm: fp0 + fp1,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than decomposing a Hamiltonian into an ordered sequence of exponentials, QDrift picks one term at random for each short time slice. Terms with larger coefficients are chosen more often, and the rotation angle is scaled so that the average over the random choices matches the desired evolution. Because no commutators or orderings are needed, the rule is simple and easy to implement.",
        invariants: [
            "A term is sampled with probability equal to its coefficient magnitude divided by the sum of magnitudes.",
            "Each sampled rotation is applied exactly, so the state stays normalized.",
            "The expectation of the product channel approaches the exact evolution as the number of slices grows.",
        ],
        correctness:
            "For one slice of length dt the channel averages term j with probability h_j over lambda, applying exp(-i lambda sign(h_j) dt P_j). To first order in dt this average equals the identity minus i dt sum h_j P_j, which is the expansion of exp(-i H dt) up to error of order dt squared. Composing N such slices gives a total error of order lambda squared t squared over N, so the expected channel converges to the exact evolution. The simulator applies each sampled two-by-two rotation exactly, and the fixed seed makes the sampled sequence reproducible.",
        complexityRationale:
            "Each slice draws one pseudorandom number and updates two complex amplitudes, so the simulation is O(N) time and O(1) space for N slices. This is the state-vector cost, not the gate count of a physical implementation.",
        uses: [
            "Hamiltonian simulation when term ordering is inconvenient",
            "Near-term quantum algorithms with short coherent circuits",
            "Benchmarking randomized compiling and product formulas",
        ],
        references: [
            "Campbell, Randomized Compiling and QDrift (2019)",
            "Nielsen and Chuang, Quantum Computation and Quantum Information (2010), Chapter 4",
        ],
        workedExample:
            "For H equal to X plus Z the sum of magnitudes lambda is two, so X and Z are each sampled half the time and each rotation has angle two times t over N. With t equal to 1.5 and N equal to 8 each slice rotates by 0.375 radians, and the product of the eight sampled rotations drifts only slightly from the exact Z and X evolution.",
    },
    id: "qdrift",
    name: "QDrift Randomized Product Formula",
    category: "quantum",
    complexity: { time: "O(N)", space: "O(1)" },
    defaultInput: { a: 1, b: 0.5, phi: 0.3, t: 1.5, steps: 8, seed: 12345 },
    visualType: "array",
    run,
    pseudocode: [
        "read coefficients, initial state angle, time, slices, and seed",
        "compute lambda as the sum of coefficient magnitudes",
        "for each slice sample a term with probability proportional to magnitude",
        "apply that term's exact exponential rotation",
        "accumulate the product of sampled rotations",
        "compute the exact evolution probabilities for comparison",
        "report the drift error and the sampled term sequence",
    ],
};

export default module;
