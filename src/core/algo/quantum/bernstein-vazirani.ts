/**
 * bernstein-vazirani.ts - Bernstein-Vazirani Algorithm (State-Vector Toy)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a black box that computes the parity f(x) = s dot x mod 2 for a hidden
 * bit string s, the Bernstein-Vazirani algorithm finds s with a single oracle
 * query. It puts the input register in an equal superposition, applies the
 * oracle as a phase flip, then applies Hadamard gates again. Interference leaves
 * all amplitude on the basis state s, so measuring reveals the whole string at
 * once.
 *
 * This is a small, exact state-vector simulation for at most four input qubits.
 * Amplitudes are updated with real Hadamard matrices and the phase oracle, so
 * the mathematical step is exact. It is NOT a fault-tolerant quantum run: there
 * is no noise model, no error correction, and the oracle is assumed perfect.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * 2^n) gates for n qubits on a classical simulator
 *   Space: O(2^n) for the state vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the real amplitudes of the 2^n basis states.
 *   - The oracle frame marks negative amplitudes; the measured state is green.
 *   - Measurement outcome and success probability are in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface BernsteinVaziraniData {
    qubits: number;
    secret: number;
    snapshots: number[][];
    measured: number;
    probability: number;
    phases: number[];
}

/** Apply a Hadamard gate to one qubit of a real state vector. */
function hadamard(state: number[], qubit: number): void {
    const bit = 1 << qubit;
    for (let i = 0; i < state.length; i += 1) {
        if ((i & bit) !== 0) continue;
        const j = i | bit;
        const a = state[i] ?? 0;
        const b = state[j] ?? 0;
        state[i] = (a + b) * Math.SQRT1_2;
        state[j] = (a - b) * Math.SQRT1_2;
    }
}

/** Parity of the bitwise AND of two integers. */
function parity(a: number, b: number): number {
    let bits = a & b;
    let result = 0;
    while (bits !== 0) {
        result ^= bits & 1;
        bits >>>= 1;
    }
    return result;
}

/** Exact Bernstein-Vazirani state-vector simulation. */
export function bernsteinVazirani(qubits: number, secret: number): BernsteinVaziraniData {
    const n = Math.max(1, Math.min(4, Math.floor(qubits)));
    const size = 1 << n;
    const s = ((secret % size) + size) % size;
    const state = Array<number>(size).fill(0);
    state[0] = 1;
    const snapshots: number[][] = [[...state]];

    for (let q = 0; q < n; q += 1) {
        hadamard(state, q);
    }
    snapshots.push([...state]);

    const phases = Array.from({ length: size }, (_, x) => (parity(s, x) === 1 ? -1 : 1));
    for (let x = 0; x < size; x += 1) {
        state[x] = (state[x] ?? 0) * (phases[x] ?? 1);
    }
    snapshots.push([...state]);

    for (let q = 0; q < n; q += 1) {
        hadamard(state, q);
    }
    snapshots.push([...state]);
    // Measurement collapses an already deterministic state, so it is unchanged.
    snapshots.push([...state]);

    let measured = 0;
    for (let x = 1; x < size; x += 1) {
        if (Math.abs(state[x] ?? 0) > Math.abs(state[measured] ?? 0)) measured = x;
    }
    const probability = (state[measured] ?? 0) ** 2;
    return { qubits: n, secret: s, snapshots, measured, probability, phases };
}

/** Build amplitude bars for a snapshot. */
function makeBars(amplitudes: number[], phaseFrame: boolean, measured: number, done: boolean): VisualEntity[] {
    return amplitudes.map((amplitude, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: phaseFrame
            ? `${amplitude.toFixed(3)}${(index === measured ? " <-" : "")}`
            : amplitude.toFixed(4),
        value: amplitude,
        state: done && index === measured ? "sorted" as const : phaseFrame && amplitude < 0 ? "comparing" as const : "idle" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, basis: index.toString(2).padStart(4, "0") },
    }));
}

/** The Bernstein-Vazirani generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { qubits?: number; secret?: number } | null) ?? {};
    const qubits = typeof task.qubits === "number" ? Math.max(1, Math.min(4, Math.floor(task.qubits))) : 3;
    const secret = typeof task.secret === "number" ? task.secret : 5;
    const data = bernsteinVazirani(qubits, secret);
    const size = 1 << data.qubits;

    const frames: Array<{ line: number; description: string; phase: boolean; done: boolean }> = [
        { line: 0, description: `Start in the basis state |0...0> with ${data.qubits} input qubit(s).`, phase: false, done: false },
        { line: 1, description: "Hadamard gates create an equal superposition over all inputs.", phase: false, done: false },
        { line: 3, description: "The oracle flips the phase where the hidden parity is one.", phase: true, done: false },
        { line: 5, description: "A second round of Hadamards makes all wrong answers interfere away.", phase: false, done: false },
        { line: 7, description: `Measurement returns ${data.measured} (binary ${data.measured.toString(2)}) with probability ${data.probability.toFixed(4)}.`, phase: false, done: true },
    ];

    for (let i = 0; i < frames.length; i += 1) {
        const spec = frames[i]!;
        yield {
            stepNumber: i,
            entities: makeBars(data.snapshots[i] ?? [], spec.phase, data.measured, spec.done),
            edges: [],
            description: spec.description,
            codeLineNumber: spec.line,
            layout: "array",
            meta: {
                qubits: data.qubits,
                secret: data.secret,
                measured: spec.done ? data.measured : -1,
                probability: spec.done ? data.probability : 0,
                phases: spec.phase ? data.phases : [],
                amplitudes: [...(data.snapshots[i] ?? [])],
                size,
            },
        };
    }
}

/** The Bernstein-Vazirani module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Ask the oracle every possible question at once by building a superposition of all inputs. The oracle marks the right answers with a minus sign, and a second Hadamard transform turns those sign patterns into a single bright basis state: the hidden string itself. One query reveals all the bits instead of one bit at a time.",
        invariants: [
            "The state vector stays normalized after every gate.",
            "The oracle phase at input x is negative exactly when s dot x is odd.",
            "After the final Hadamards the only amplitude of nonzero size sits on basis state s.",
        ],
        correctness:
            "The amplitude of basis state y after the circuit is the average over x of (-1) raised to x dot (s xor y). This Fourier sum equals one when y equals s and zero otherwise, because the characters of the parity group are orthonormal. Measuring therefore returns s with probability one using a single oracle call, while a classical deterministic algorithm needs n calls.",
        complexityRationale:
            "The circuit uses n Hadamards before the oracle and n after, so the quantum query count is one and the gate count is O(n). Simulating it classically manipulates 2^n amplitudes with O(n) gates on each, giving O(n*2^n) time and O(2^n) space.",
        uses: [
            "A canonical example of quantum speedup in oracle problems",
            "A subroutine pattern reused in more complex Fourier algorithms",
            "Teaching interference and phase kickback with exact simulation",
        ],
        references: [
            "Bernstein and Vazirani, Quantum Complexity Theory, STOC 1993",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Section 3.5",
        ],
        workedExample:
            "For three qubits with hidden string 101, the oracle applies a minus sign to inputs whose first and last bits have odd parity. After the second Hadamard layer, amplitude 1 sits on basis state 101 and every other amplitude is zero, so measurement returns 101 in a single query.",
    },
    id: "bernstein-vazirani",
    name: "Bernstein-Vazirani (Toy Simulation)",
    category: "quantum",
    complexity: { time: "O(n*2^n) simulated", space: "O(2^n)" },
    defaultInput: { qubits: 3, secret: 5 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize n qubits in the all-zero basis state",
        "apply a Hadamard gate to every input qubit",
        "query the oracle as a phase flip for hidden parity",
        "record the sign of each basis amplitude",
        "apply Hadamard gates to every input qubit again",
        "sum the interfering paths for each basis state",
        "measure and read off the hidden string",
        "done: report the measured string and probability",
    ],
};

export default module;
