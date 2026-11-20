/**
 * quantum-monte-carlo.ts - Quantum Monte Carlo (Amplitude Estimation Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quantum Monte Carlo uses amplitude estimation to accelerate Monte Carlo
 * integration. An integral or expectation in [0, 1] is encoded as the squared
 * amplitude a of a work qubit prepared by a rotation of angle theta where
 * a = sin^2(theta). The standard amplitude-estimation circuit applies Hadamards
 * to m ancilla qubits, controlled powers of the Grover operator Q = R(2 theta),
 * and an inverse quantum Fourier transform. Measuring the ancilla yields an
 * integer y from which a is estimated as sin^2(pi y / 2^m). The runtime scales
 * as O(1/epsilon) for precision epsilon, a quadratic gain over classical
 * sampling. This module simulates the full circuit exactly on a state vector
 * of 2^(m+1) amplitudes and reports the most likely measurement outcome.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * 2^m + 4^m) for the phase kicks and the exact inverse QFT
 *   Space: O(2^(m+1)) for the complex state vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the probability of each ancilla measurement outcome.
 *   - The uniform superposition after the Hadamards is yellow.
 *   - The peaked distribution after the inverse QFT is green, with the most
 *     likely outcome selected as the deterministic estimate.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type C = [number, number];

interface QmcInput {
    a?: number;
    precision?: number;
}

const cadd = (u: C, v: C): C => [u[0] + v[0], u[1] + v[1]];
const cscale = (u: C, k: number): C => [u[0] * k, u[1] * k];
const cabs2 = (u: C): number => u[0] * u[0] + u[1] * u[1];

function makeBars(probabilities: number[], peak: number, done: boolean): VisualEntity[] {
    return probabilities.map((p, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `y=${index}: ${p.toFixed(4)}`,
        value: p,
        state: done ? "sorted" as EntityState : index === peak ? "comparing" as EntityState : "active" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability: p },
    }));
}

/** The quantum Monte Carlo generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as QmcInput | null) ?? {};
    const trueA = typeof task.a === "number" && Number.isFinite(task.a) ? Math.min(1, Math.max(0, task.a)) : 0.25;
    const m = Math.max(1, Math.min(8, Math.floor(task.precision ?? 4)));
    const outcomes = 1 << m;
    const theta = Math.asin(Math.sqrt(trueA));
    const state: C[] = Array.from({ length: outcomes * 2 }, () => [0, 0]);
    state[0] = [Math.cos(theta), 0];
    state[1] = [Math.sin(theta), 0];
    let step = 0;

    const distribution = (): number[] => {
        const p: number[] = [];
        for (let A = 0; A < outcomes; A += 1) {
            p.push(cabs2(state[A * 2] ?? [0, 0]) + cabs2(state[A * 2 + 1] ?? [0, 0]));
        }
        return p;
    };
    const meta = (stage: string, estimate: number, peak: number, done: boolean) => {
        const p = distribution();
        return {
            a: trueA,
            theta,
            precision: m,
            outcomes,
            stage,
            mostLikely: peak,
            estimate,
            probabilities: p,
            sumProbability: p.reduce((sum, v) => sum + v, 0),
            done,
        };
    };

    const frame = (stage: string, estimate: number, peak: number, done: boolean, description: string, line: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeBars(distribution(), peak, done),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "array",
        meta: meta(stage, estimate, peak, done),
    });

    yield frame("prepared", trueA, 0, false, `Encoded a = ${trueA.toFixed(4)} as sin squared of angle ${theta.toFixed(4)} on the work qubit.`, 0);

    const S = Math.SQRT1_2;
    for (let q = 0; q < m; q += 1) {
        const bit = 1 << (m - 1 - q);
        for (let A = 0; A < outcomes; A += 1) {
            if ((A & bit) !== 0) continue;
            const partner = A | bit;
            for (let w = 0; w < 2; w += 1) {
                const i0 = A * 2 + w;
                const i1 = partner * 2 + w;
                const t0 = state[i0] ?? [0, 0];
                const t1 = state[i1] ?? [0, 0];
                state[i0] = cscale(cadd(t0, t1), S);
                state[i1] = cscale([t0[0] - t1[0], t0[1] - t1[1]], S);
            }
        }
    }
    yield frame("superposition", trueA, -1, false, `Hadamards put the ${m} ancilla qubits in an equal superposition over ${outcomes} outcomes.`, 2);

    for (let j = 0; j < m; j += 1) {
        const bit = 1 << j;
        const phi = 2 * Math.pow(2, j) * theta;
        const cp = Math.cos(phi);
        const sp = Math.sin(phi);
        for (let A = 0; A < outcomes; A += 1) {
            if ((A & bit) === 0) continue;
            const i0 = A * 2;
            const i1 = A * 2 + 1;
            const t0 = state[i0] ?? [0, 0];
            const t1 = state[i1] ?? [0, 0];
            state[i0] = [cp * t0[0] - sp * t1[0], cp * t0[1] - sp * t1[1]];
            state[i1] = [sp * t0[0] + cp * t1[0], sp * t0[1] + cp * t1[1]];
        }
    }
    yield frame("phase-kicks", trueA, -1, false, `Applied controlled powers Q, Q^2, ... Q^(${m}) to imprint the phase 2 theta on the ancilla.`, 4);

    const invQft: C[][] = Array.from({ length: outcomes }, (_, y) =>
        Array.from({ length: outcomes }, (_, x) => {
            const angle = (-2 * Math.PI * x * y) / outcomes;
            return [Math.cos(angle) / Math.sqrt(outcomes), Math.sin(angle) / Math.sqrt(outcomes)];
        }),
    );
    const next: C[] = Array.from({ length: outcomes * 2 }, () => [0, 0]);
    for (let w = 0; w < 2; w += 1) {
        for (let y = 0; y < outcomes; y += 1) {
            let re = 0;
            let im = 0;
            for (let x = 0; x < outcomes; x += 1) {
                const u = invQft[y]![x]!;
                const v = state[x * 2 + w] ?? [0, 0];
                re += u[0] * v[0] - u[1] * v[1];
                im += u[0] * v[1] + u[1] * v[0];
            }
            next[y * 2 + w] = [re, im];
        }
    }
    for (let i = 0; i < next.length; i += 1) {
        state[i] = next[i] ?? [0, 0];
    }
    yield frame("qft", trueA, -1, false, "The inverse quantum Fourier transform concentrates the amplitude into a few measurement outcomes.", 6);

    const probs = distribution();
    let peak = 0;
    for (let y = 1; y < outcomes; y += 1) {
        if ((probs[y] ?? 0) > (probs[peak] ?? 0)) peak = y;
    }
    const estimate = Math.sin((Math.PI * peak) / outcomes) ** 2;
    yield frame("measured", estimate, peak, true, `Most likely outcome y=${peak} gives estimate ${estimate.toFixed(6)} for the true value ${trueA.toFixed(6)}.`, 7);
}

/** The quantum Monte Carlo module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Classical Monte Carlo needs about one over epsilon squared samples to estimate a quantity to accuracy epsilon. Quantum amplitude estimation encodes that quantity as a probability amplitude and uses interference to read it off with about one over epsilon queries. A controlled Grover operator imprints the unknown angle into the phase of an ancilla register, and an inverse Fourier transform turns that phase into a number that can be measured.",
        invariants: [
            "The work qubit begins in cos(theta)|0> plus sin(theta)|1> with sin squared theta equal to the value being estimated.",
            "The Grover operator is a rotation by 2 theta and is unitary, so the total probability stays one.",
            "The most likely ancilla outcome y satisfies pi y over 2^m approximately equal to theta.",
        ],
        correctness:
            "The Grover operator Q has eigenvalues exp(plus or minus 2 i theta). Applying controlled powers Q raised to 2^j writes the binary expansion of the phase 2 theta into the ancilla register through phase estimation. The inverse quantum Fourier transform maps that phase to a computational basis integer y with pi y / 2^m close to theta, so sin squared of pi y over 2^m approximates sin squared theta, the encoded value. Using m ancilla qubits gives precision about 2 to the minus m, so the number of Grover applications scales like one over the desired precision, a quadratic improvement over ordinary sampling.",
        complexityRationale:
            "Preparing the superposition uses O(m) Hadamards over 2^m amplitudes, the controlled phase kicks touch half the state per ancilla qubit for O(m 2^m) work, and the exact inverse QFT is a dense 2^m by 2^m transform costing O(4^m). Memory holds 2^(m+1) complex amplitudes. The m <= 8 cap keeps this exact teaching simulation small; a real device would implement the QFT with O(m^2) gates.",
        uses: [
            "Accelerated Monte Carlo integration and expectation estimation",
            "Risk analysis and derivative pricing in quantum finance",
            "Estimating partition functions and expectation values in quantum chemistry",
        ],
        references: [
            "Brassard, Hoyer, Mosca, and Tapp, Quantum Amplitude Amplification and Estimation, 2002",
            "Stamatopoulos et al., Option Pricing Using Quantum Computers, 2020",
        ],
        workedExample:
            "To estimate a = 0.25 the work rotation angle is theta = asin(0.5) = pi/6, so the Grover phase is 2 theta = pi/3. With four ancilla qubits the phase-estimation register concentrates near y = 16 times (pi/3) over 2 pi, about y = 2 or 3; reading y = 3 gives sin squared of 3 pi over 16, roughly 0.31. Eight ancilla qubits narrow the answer to within a few hundredths of 0.25.",
    },
    id: "quantum-monte-carlo",
    name: "Quantum Monte Carlo (Amplitude Estimation Core)",
    category: "quantum",
    complexity: { time: "O(m * 2^m + 4^m)", space: "O(2^(m+1))" },
    defaultInput: { a: 0.25, precision: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "encode the value a as sin squared of a rotation angle theta",
        "prepare the work qubit with that rotation",
        "apply Hadamards to all m ancilla qubits",
        "for each ancilla qubit apply a controlled power of the Grover rotation",
        "apply the inverse quantum Fourier transform to the ancilla",
        "compute the probability of every measurement outcome",
        "choose the most likely outcome y as the estimate",
        "done: report sin squared of pi y over 2 to the m",
    ],
};

export default module;
