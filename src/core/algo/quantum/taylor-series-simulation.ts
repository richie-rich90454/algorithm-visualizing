/**
 * taylor-series-simulation.ts - Taylor Series Hamiltonian Simulation
 *
 * A truncated Taylor expansion of exp(-i H t) is applied term by term to an
 * initial state. Each new term is obtained by multiplying the previous one by
 * (-i H t) and dividing by the term index, so the method needs only repeated
 * sparse matrix-vector products. Truncating after K terms gives an error that
 * falls roughly like (normal form time) to the power K+1 divided by (K+1)!.
 *
 * Limits of the demo: H is a real symmetric two by two matrix, the initial
 * state has real components, the time is a scalar, and the simulator is an
 * exact ideal state-vector calculation. No qubitization, amplitude
 * amplification, truncation randomness, or hardware noise is modeled.
 *
 * Time: O(K) matrix-vector products. Space: O(K) for the stored series.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Complex {
    re: number;
    im: number;
}

/** Apply a real two by two matrix to a complex vector. */
function matVec(H: number[][], v: Complex[]): Complex[] {
    return H.map((row) => ({
        re: (row[0] as number) * (v[0] as Complex).re + (row[1] as number) * (v[1] as Complex).re,
        im: (row[0] as number) * (v[0] as Complex).im + (row[1] as number) * (v[1] as Complex).im,
    }));
}

/** Truncated Taylor approximation of exp(-i H t) applied to the initial state. */
export function taylorSimulate(H: number[][], psi: number[], t: number, order: number): Complex[] {
    let term: Complex[] = psi.map((value) => ({ re: value, im: 0 }));
    const total: Complex[] = term.map((value) => ({ ...value }));
    for (let k = 1; k <= order; k += 1) {
        const Hterm = matVec(H, term);
        term = Hterm.map((value) => ({ re: (t * value.im) / k, im: (-t * value.re) / k }));
        for (let i = 0; i < total.length; i += 1) {
            (total[i] as Complex).re += (term[i] as Complex).re;
            (total[i] as Complex).im += (term[i] as Complex).im;
        }
    }
    return total;
}

/** Closed-form exp(-i H t) state for a real symmetric two by two matrix. */
export function exactSimulate(H: number[][], psi: number[], t: number): Complex[] {
    const a = (H[0] as number[])[0] as number;
    const b = (H[0] as number[])[1] as number;
    const d = (H[1] as number[])[1] as number;
    const mean = (a + d) / 2;
    const gap = Math.sqrt(((a - d) / 2) ** 2 + b * b);
    const cos = Math.cos(gap * t);
    const sin = Math.sin(gap * t);
    const global = Math.cos(mean * t);
    const globalIm = -Math.sin(mean * t);
    const s0 = (psi[0] as number);
    const s1 = (psi[1] as number);
    const u00re = cos;
    const u00im = -((a - d) / 2 / gap) * sin;
    const u01im = -(b / gap) * sin;
    const u11re = cos;
    const u11im = ((a - d) / 2 / gap) * sin;
    const v0re = u00re * s0;
    const v0im = u00im * s0 + u01im * s1;
    const v1re = u11re * s1;
    const v1im = u11im * s1 + u01im * s0;
    return [
        { re: global * v0re - globalIm * v0im, im: global * v0im + globalIm * v0re },
        { re: global * v1re - globalIm * v1im, im: global * v1im + globalIm * v1re },
    ];
}

function probabilities(state: Complex[]): number[] {
    return state.map((value) => value.re * value.re + value.im * value.im);
}

function distance(a: Complex[], b: Complex[]): number {
    return Math.sqrt(a.reduce((sum, value, i) =>
        sum + (value.re - (b[i] as Complex).re) ** 2 + (value.im - (b[i] as Complex).im) ** 2, 0));
}

function makeBars(values: number[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: index % 2 === 0 ? `Re amp ${index / 2}=${value.toFixed(5)}` : `Im amp ${(index - 1) / 2}=${value.toFixed(5)}`,
        value,
        state: index === active ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index % 2 === 0 ? "real" : "imaginary" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { h?: number[][]; psi?: number[]; time?: number; order?: number } | null) ?? {};
    const H = Array.isArray(task.h) && task.h.length === 2 && task.h[0]?.length === 2
        ? task.h.map((row) => row.map(Number))
        : [[0, 1], [1, 0]];
    const psi = Array.isArray(task.psi) && task.psi.length === 2
        ? task.psi.map(Number)
        : [1, 0];
    const t = Number(task.time ?? 1.2);
    const order = Math.min(60, Math.max(1, Math.floor(Number(task.order ?? 14)) || 14));
    const exact = exactSimulate(H, psi, t);
    const exactProb = probabilities(exact);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars([psi[0] as number, 0, psi[1] as number, 0], -1),
        edges: [],
        description: `Prepare the initial state and approximate exp(-i H t) with ${order} Taylor terms.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { H, psi: [...psi], time: t, order, exactProb, error: 0 },
    };
    step += 1;

    let term: Complex[] = psi.map((value) => ({ re: value, im: 0 }));
    const total: Complex[] = term.map((value) => ({ ...value }));
    for (let k = 1; k <= order; k += 1) {
        const Hterm = matVec(H, term);
        term = Hterm.map((value) => ({ re: (t * value.im) / k, im: (-t * value.re) / k }));
        for (let i = 0; i < total.length; i += 1) {
            (total[i] as Complex).re += (term[i] as Complex).re;
            (total[i] as Complex).im += (term[i] as Complex).im;
        }
        const prob = probabilities(total);
        const error = distance(total, exact);
        yield {
            stepNumber: step,
            entities: makeBars([(total[0] as Complex).re, (total[0] as Complex).im, (total[1] as Complex).re, (total[1] as Complex).im], k - 1),
            edges: [],
            description: `After ${k} terms the state error is ${error.toExponential(3)} and probability ${(prob[0] as number).toFixed(6)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                H, psi: [...psi], time: t, order, term: k,
                amplitudes: total.map((value) => ({ re: value.re, im: value.im })),
                probabilities: prob, exactProb, error,
            },
        };
        step += 1;
    }

    const finalProb = probabilities(total);
    const finalError = distance(total, exact);
    yield {
        stepNumber: step,
        entities: makeBars([(total[0] as Complex).re, (total[0] as Complex).im, (total[1] as Complex).re, (total[1] as Complex).im], -1),
        edges: [],
        description: `Final probabilities ${(finalProb[0] as number).toFixed(6)}, ${(finalProb[1] as number).toFixed(6)}; error ${finalError.toExponential(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            H, psi: [...psi], time: t, order,
            amplitudes: total.map((value) => ({ re: value.re, im: value.im })),
            probabilities: finalProb, exactProb, finalError,
            norm: finalProb.reduce((a, b) => a + b, 0),
            accurate: finalError < 1e-6,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The exponential of minus i times a Hamiltonian generates quantum time evolution. Instead of diagonalizing the Hamiltonian, a Taylor series builds the evolved state from repeated applications of H to the current vector. Each term is cheap, and truncating after enough terms gives a controlled approximation. This is the foundation of several near-term simulation algorithms.",
        invariants: [
            "Each Taylor term is the previous term multiplied by minus i H t and divided by its index.",
            "The exact generator is anti-Hermitian because H is Hermitian.",
            "The exact evolution preserves the total probability, which truncation approximates.",
        ],
        correctness:
            "The power-series definition of the matrix exponential gives exp(-i H t) as the sum over k of (-i H t)^k over k factorial. Term k in the recurrence equals (-i H t)^k psi over k factorial by induction, so the accumulated sum is the truncated exponential. For a real symmetric two by two H the eigenvalues and angle of its eigendecomposition are available in closed form, yielding an independent exact state. As the order grows the truncated series converges to that exact state and the norm approaches one.",
        complexityRationale:
            "Each new term requires one multiplication by the two by two matrix and vector updates, so K terms cost O(K) time. Storing the displayed amplitudes and probabilities for replay uses O(K) space.",
        uses: [
            "Simulating short-time quantum dynamics on early hardware",
            "Building blocks for qubitized and linear-combination-of-unitaries methods",
            "Modeling spin and molecular Hamiltonians in small demos",
        ],
        references: [
            "Low and Chuang, Hamiltonian Simulation by Qubitization, 2019",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, 2010",
        ],
        workedExample:
            "For H equal to the Pauli X matrix, initial state (1,0) and time 1.2, the exact amplitudes are cos(1.2) and minus i sin(1.2). Fourteen Taylor terms reproduce them to better than one part in a million, and the probabilities remain close to 0.869 and 0.131.",
    },
    id: "taylor-series-simulation",
    name: "Taylor Series Hamiltonian Simulation",
    category: "quantum",
    complexity: { time: "O(K)", space: "O(K)" },
    defaultInput: { h: [[0, 1], [1, 0]], psi: [1, 0], time: 1.2, order: 14 },
    visualType: "array",
    run,
    pseudocode: [
        "read the Hamiltonian, initial state and evolution time",
        "set the zeroth Taylor term to the initial state",
        "start the accumulated state at that term",
        "multiply the current term by minus i H t",
        "divide by the term index and add to the state",
        "record amplitudes and probabilities after each term",
        "compare the final state with the closed-form exponential",
        "done: report probabilities, norm and error",
    ],
};

export default module;
