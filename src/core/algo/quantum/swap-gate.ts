/**
 * swap-gate.ts - SWAP Gate on a Multi-Qubit State
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The SWAP gate exchanges the states of two qubits. On the computational basis
 * it permutes amplitudes: every basis state whose two target bits differ maps
 * to the state with those bits flipped, and states whose bits agree are fixed.
 * Because it is a permutation matrix it is unitary and involutional: applying
 * SWAP twice returns the original state.
 *
 * This module performs an exact state-vector simulation on a small number of
 * qubits. It prepares a state, optionally creates a superposition with a
 * Hadamard gate, applies SWAP to two chosen qubits, and verifies the permuted
 * amplitudes. It is a teaching model, not a physical quantum device.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^n) for an n-qubit state vector
 *   Space: O(2^n) for the amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the amplitude of each computational basis state.
 *   - Basis states whose target bits differ turn yellow during the swap.
 *   - The final state is green and reports measurement probabilities.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const BASIS_LABELS = ["00", "01", "10", "11"];

/** Apply a Hadamard gate to one qubit of a real state vector. */
export function applyHadamard(state: number[], qubit: number): number[] {
    const step = 1 << qubit;
    const next = [...state];
    const inv = Math.SQRT1_2;
    for (let base = 0; base < next.length; base += step * 2) {
        for (let offset = 0; offset < step; offset += 1) {
            const a = base + offset;
            const b = a + step;
            const va = state[a] ?? 0;
            const vb = state[b] ?? 0;
            next[a] = inv * (va + vb);
            next[b] = inv * (va - vb);
        }
    }
    return next;
}

/** Swap two qubits of a real state vector by permuting amplitudes. */
export function applySwap(state: number[], qubitA: number, qubitB: number): number[] {
    if (qubitA === qubitB) return [...state];
    const n = state.length;
    const next = Array<number>(n).fill(0);
    for (let index = 0; index < n; index += 1) {
        let permuted = index;
        if (((index >> qubitA) & 1) !== ((index >> qubitB) & 1)) {
            permuted = index ^ (1 << qubitA) ^ (1 << qubitB);
        }
        next[permuted] = state[index] ?? 0;
    }
    return next;
}

/** Build amplitude bars for a two-qubit state. */
function makeBars(state: number[], active: Set<number>, done: boolean): VisualEntity[] {
    return state.map((amplitude, index) => {
        const stateName: EntityState = done ? "sorted" : active.has(index) ? "comparing" : "idle";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: BASIS_LABELS[index] ?? String(index),
            value: amplitude,
            state: stateName,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, basis: BASIS_LABELS[index] ?? String(index), amplitude },
        };
    });
}

/** Which two-qubit basis states have differing bits at the target qubits. */
function differingIndices(qubitA: number, qubitB: number): Set<number> {
    const result = new Set<number>();
    for (let index = 0; index < 4; index += 1) {
        if (((index >> qubitA) & 1) !== ((index >> qubitB) & 1)) result.add(index);
    }
    return result;
}

/** The SWAP gate generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { initial?: string; hadamard?: boolean } | null) ?? {};
    const raw = typeof task.initial === "string" ? task.initial : "01";
    const bits = /^[01]{2}$/.test(raw) ? raw : "01";
    const index = Number.parseInt(bits, 2);
    const qubitA = 0;
    const qubitB = 1;
    let state = [0, 0, 0, 0];
    state[index] = 1;
    const start = [...state];
    const changed = differingIndices(qubitA, qubitB);

    yield {
        stepNumber: 0,
        entities: makeBars(state, new Set(), false),
        edges: [],
        description: `Starting from the basis state |${bits}> on two qubits.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { amplitudes: [...state], probabilities: state.map((a) => a * a), swapped: false },
    };

    if (task.hadamard === true) {
        state = applyHadamard(state, qubitA);
        yield {
            stepNumber: 1,
            entities: makeBars(state, new Set(), false),
            edges: [],
            description: "A Hadamard gate on qubit 0 creates a superposition before the swap.",
            codeLineNumber: 1,
            layout: "array",
            meta: { amplitudes: [...state], probabilities: state.map((a) => a * a), swapped: false },
        };
    }

    const stepOffset = task.hadamard === true ? 2 : 1;
    yield {
        stepNumber: stepOffset,
        entities: makeBars(state, changed, false),
        edges: [],
        description: "The basis states with different bits at the two qubits have their amplitudes exchanged.",
        codeLineNumber: 2,
        layout: "array",
        meta: { amplitudes: [...state], probabilities: state.map((a) => a * a), swapped: false },
    };

    const swapped = applySwap(state, qubitA, qubitB);
    yield {
        stepNumber: stepOffset + 1,
        entities: makeBars(swapped, changed, false),
        edges: [],
        description: "SWAP exchanges those amplitudes and leaves the matching-bit states unchanged.",
        codeLineNumber: 3,
        layout: "array",
        meta: { amplitudes: [...swapped], probabilities: swapped.map((a) => a * a), swapped: true },
    };

    yield {
        stepNumber: stepOffset + 2,
        entities: makeBars(swapped, new Set(), true),
        edges: [],
        description: "Applying SWAP twice would restore the original state; the gate is its own inverse.",
        codeLineNumber: 4,
        layout: "array",
        meta: {
            amplitudes: [...swapped],
            probabilities: swapped.map((a) => a * a),
            swapped: true,
            doubleSwapReturnsToStart: JSON.stringify(applySwap(swapped, qubitA, qubitB)) === JSON.stringify(state),
            start: start,
        },
    };
}

/** The SWAP gate module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of the two qubits as two labeled boxes. SWAP trades their contents: any basis state where the boxes differ flips to the state with them reversed, and everything else stays put. Because the operation only relabels amplitudes and never combines them, it preserves total probability and undoes itself when applied a second time.",
        invariants: [
            "The sum of squared amplitudes stays equal to one.",
            "Basis states whose target bits agree are unchanged.",
            "Applying SWAP twice returns the original state.",
        ],
        correctness:
            "SWAP is defined by a permutation P of the computational basis that exchanges the two target bit positions. A permutation matrix has exactly one nonzero entry per row and column and is therefore unitary, so it preserves the norm. P maps index x to x with those two bits toggled when they differ; applying the same toggle again returns x, so P squared is the identity. Hence the simulated amplitudes are a valid quantum state and the gate is self-inverse.",
        complexityRationale:
            "The implementation visits every one of the 2^n amplitudes once to compute its destination, so time and space are both O(2^n). It is a real state-vector simulation limited here to a small qubit count.",
        uses: [
            "Reordering qubits and routing on constrained hardware",
            "Swapping registers in reversible arithmetic circuits",
            "Building block for Bell-pair and entanglement-swapping protocols",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 4",
            "Feynman, Quantum Mechanical Computers, 1985",
        ],
        workedExample:
            "Starting from |01>, the amplitude at index 1 (binary 01) moves to index 2 (binary 10), giving |10>. Starting from |00>, both target bits agree, so the state is unchanged. If a Hadamard is applied first, the superposed amplitudes at 01 and 10 trade places.",
    },
    id: "swap-gate",
    name: "SWAP Gate",
    category: "quantum",
    complexity: { time: "O(2^n)", space: "O(2^n)" },
    defaultInput: { initial: "01", hadamard: false },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the state vector from the input basis state",
        "optionally apply a Hadamard gate to the first qubit",
        "identify basis states whose two target bits differ",
        "send each amplitude to the state with those bits flipped",
        "leave the amplitudes of matching-bit states in place",
        "report the resulting amplitudes and probabilities",
        "done: verify that applying SWAP twice is the identity",
    ],
};

export default module;
