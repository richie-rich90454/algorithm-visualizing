/**
 * quantum-counting.ts - Quantum Counting by Phase Estimation of Grover's Operator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quantum counting estimates how many marked items M a search space of size N
 * contains. It runs phase estimation on Grover's iterate G, whose eigenvalues
 * are exp(plus or minus 2i theta) with sin(theta) = sqrt(M/N). A t-qubit
 * counting register returns an integer k near t-bit fraction theta/pi, so the
 * estimate is M about N times sin squared of pi k over 2^t.
 *
 * This is an exact state-vector simulation of the full (t + n)-qubit circuit
 * for small n and t. It models ideal gates and ideal measurement, not a noisy
 * physical device, and the estimate is limited by the t-bit phase resolution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^t * 2^n * 2^t) simulated for the Fourier transform and iterates
 *   Space: O(2^(t+n)) complex amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the measurement distribution of the t-qubit counting register.
 *   - The dominant counting outcome is highlighted; final bars are green.
 *   - Metadata reports the estimate, the true count, and the outcome index.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CountingInput {
    n?: number;
    t?: number;
    marked?: number[];
}

function makeBars(probabilities: number[], highlight: number, done: boolean): VisualEntity[] {
    return probabilities.map((p, index) => {
        let state: EntityState = "idle";
        if (index === highlight) state = done ? "sorted" : "comparing";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: String(index),
            value: p,
            state,
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, outcome: index, probability: p },
        };
    });
}

/** The quantum-counting generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CountingInput | null) ?? {};
    const n = Math.min(3, Math.max(1, Math.floor(Number(task.n ?? 2)) || 2));
    const t = Math.min(7, Math.max(2, Math.floor(Number(task.t ?? 6)) || 6));
    const N = 1 << n;
    const T = 1 << t;
    const DIM = N * T;
    const marked = new Set(
        (Array.isArray(task.marked) ? task.marked : [N - 2]).map((v) => Math.abs(Math.floor(Number(v) || 0)) % N),
    );
    const M = marked.size;
    const truePhase = Math.asin(Math.sqrt(M / N)) / Math.PI;

    const re = new Array<number>(DIM).fill(0);
    const im = new Array<number>(DIM).fill(0);
    const amp = 1 / Math.sqrt(DIM);
    re.fill(amp);

    // Projection of the counting-register distribution (marginal over search states).
    const countingProbabilities = (): number[] => {
        const out = new Array<number>(T).fill(0);
        for (let c = 0; c < T; c += 1) {
            let sum = 0;
            for (let x = 0; x < N; x += 1) {
                const idx = c * N + x;
                sum += re[idx]! * re[idx]! + im[idx]! * im[idx]!;
            }
            out[c] = sum;
        }
        return out;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(countingProbabilities(), -1, false),
        edges: [],
        description: `Counting ${M} marked item(s) in a space of ${N} using ${t} counting qubits.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, t, N, T, M, truePhase, estimateM: 0, outcome: -1, done: false },
    };
    step += 1;

    // Uniform superpositions on both registers.
    yield {
        stepNumber: step,
        entities: makeBars(countingProbabilities(), -1, false),
        edges: [],
        description: "Hadamard gates create a uniform superposition on the counting and search registers.",
        codeLineNumber: 1,
        layout: "array",
        meta: { n, t, N, T, M, truePhase, estimateM: 0, outcome: -1 },
    };
    step += 1;

    // Apply one Grover iterate to a single search subvector in place.
    const grover = (base: number) => {
        for (let x = 0; x < N; x += 1) {
            if (marked.has(x)) re[base + x] = -re[base + x]!;
        }
        let sum = 0;
        for (let x = 0; x < N; x += 1) sum += re[base + x]!;
        const twice = (2 * sum) / N;
        for (let x = 0; x < N; x += 1) re[base + x] = twice - re[base + x]!;
    };

    for (let k = 0; k < t; k += 1) {
        const power = 1 << k;
        for (let c = 0; c < T; c += 1) {
            if (((c >> k) & 1) === 0) continue;
            const base = c * N;
            for (let rep = 0; rep < power; rep += 1) grover(base);
        }
        yield {
            stepNumber: step,
            entities: makeBars(countingProbabilities(), -1, false),
            edges: [],
            description: `Applied controlled-G to the power ${power} conditioned on counting bit ${k}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, t, N, T, M, truePhase, estimateM: 0, outcome: -1, appliedPower: power },
        };
        step += 1;
    }

    // Exact inverse quantum Fourier transform on the counting register.
    const cosTable = Array.from({ length: T }, (_, j) => Math.cos((-2 * Math.PI * j) / T));
    const sinTable = Array.from({ length: T }, (_, j) => Math.sin((-2 * Math.PI * j) / T));
    const inv = 1 / Math.sqrt(T);
    for (let x = 0; x < N; x += 1) {
        const inR = new Array<number>(T);
        const inI = new Array<number>(T);
        for (let c = 0; c < T; c += 1) {
            inR[c] = re[c * N + x]!;
            inI[c] = im[c * N + x]!;
        }
        for (let out = 0; out < T; out += 1) {
            let sr = 0;
            let si = 0;
            for (let c = 0; c < T; c += 1) {
                const angleIndex = (c * out) % T;
                const cr = cosTable[angleIndex]!;
                const ci = sinTable[angleIndex]!;
                sr += inR[c]! * cr - inI[c]! * ci;
                si += inR[c]! * ci + inI[c]! * cr;
            }
            re[out * N + x] = sr * inv;
            im[out * N + x] = si * inv;
        }
    }

    const probabilities = countingProbabilities();
    let outcome = 0;
    for (let c = 1; c < T; c += 1) {
        if ((probabilities[c] ?? 0) > (probabilities[outcome] ?? 0)) outcome = c;
    }
    const estimateM = N * Math.sin((Math.PI * outcome) / T) ** 2;
    yield {
        stepNumber: step,
        entities: makeBars(probabilities, outcome, false),
        edges: [],
        description: `Inverse Fourier transform concentrates probability near outcome ${outcome}, giving M ≈ ${estimateM.toFixed(3)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, t, N, T, M, truePhase, estimateM, outcome, probabilities },
    };
    step += 1;

    const probSum = probabilities.reduce((a, b) => a + b, 0);
    yield {
        stepNumber: step,
        entities: makeBars(probabilities, outcome, true),
        edges: [],
        description: `Measured outcome ${outcome}: estimated ${estimateM.toFixed(3)} marked item(s); true count is ${M}. Total probability ${probSum.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, t, N, T, M, truePhase, estimateM, outcome, probabilities, probSum, done: true },
    };
}

/** The quantum counting module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Grover's search rotates a state by an angle that depends on how many marked items exist. Quantum counting listens to that rotation with phase estimation: the counting register reads out the rotation angle as a binary fraction, and converting the angle back through the sine-squared relation reveals the number of matches without finding them individually.",
        invariants: [
            "The joint state vector stays normalized because every gate is unitary.",
            "Grover's operator has eigenvalues exp(plus or minus 2i theta) with sin squared theta equal to M over N.",
            "Both counting peaks correspond to the same estimate because sine squared is symmetric.",
        ],
        correctness:
            "In the two-dimensional Grover subspace the iterate acts as a rotation by 2 theta, so its eigenphases are plus and minus theta over pi. Phase estimation returns a t-bit approximation of that eigenphase with high probability. Substituting the measured phase phi into N sine squared of pi phi recovers M exactly when phi is representable and approximately otherwise, with error controlled by the t-bit resolution.",
        complexityRationale:
            "A physical run uses O(t) controlled iterates and an O(t squared) Fourier transform. This exact simulation evolves 2 to the (t+n) amplitudes, applies controlled Grover powers costing O(2^t times 2^n), and computes a dense Fourier transform costing O(T squared times N).",
        uses: [
            "Estimating solution counts before deciding how many Grover iterations to run",
            "Counting satisfying assignments in a search space",
            "A subroutine in quantum algorithms that need the number of matches",
        ],
        references: [
            "Boyer, Brassard, Hoeyer, and Tapp, Tight Bounds on Quantum Searching, 1996",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 6",
        ],
        workedExample:
            "With four search items and one marked item, sin theta is one half so theta is pi over six and the phase is one sixth. A six-bit counting register peaks near outcome eleven, giving the fraction 11/64 and an estimate of about one marked item.",
    },
    id: "quantum-counting",
    name: "Quantum Counting",
    category: "quantum",
    complexity: { time: "O(2^t * 2^n * 2^t) simulated", space: "O(2^(t+n)) simulated" },
    defaultInput: { n: 2, t: 6, marked: [2] },
    visualType: "array",
    run,
    pseudocode: [
        "prepare uniform superpositions on counting and search registers",
        "for each counting bit apply controlled powers of Grover's operator",
        "the eigenphase of Grover encodes the marked fraction",
        "apply the inverse quantum Fourier transform to the counting register",
        "measure the dominant counting outcome k",
        "estimate M as N sin squared of pi k over 2 to the t",
        "done: report the estimated number of marked items",
    ],
};

export default module;
