/**
 * toffoli-gate.ts - Toffoli (CCNOT) Gate on Three Qubits
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Toffoli gate flips a target qubit only when both control qubits are one.
 * On the eight computational basis states it swaps the amplitudes of |110>
 * and |111> and leaves the other six unchanged. It is a reversible universal
 * classical gate inside a quantum circuit, and it is the workhorse of
 * reversible arithmetic and many error-correction constructions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for a three-qubit state (one amplitude pair is swapped)
 *   Space: O(1) for the eight amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Eight bars show the probability of every three-bit basis state.
 *   - The two amplitudes where both controls are one are highlighted.
 *   - Frame metadata carries the exact amplitude vector for verification.
 *
 * This is an exact small state-vector simulation on up to three qubits. It is
 * not a physical gate: decoherence, gate error, and fault tolerance are out of
 * scope, and the state is kept real because H and Toffoli need no complex phase.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const BASIS = ["000", "001", "010", "011", "100", "101", "110", "111"];
const INV_SQRT2 = Math.SQRT1_2;

function makeBars(amplitudes: number[], active: Set<number>, state: EntityState): VisualEntity[] {
    return amplitudes.map((amplitude, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `|${BASIS[index] ?? index}> ${(amplitude * amplitude).toFixed(3)}`,
        value: amplitude * amplitude,
        state: active.has(index) ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, basis: BASIS[index] ?? String(index), amplitude, probability: amplitude * amplitude },
    }));
}

/** Apply a Hadamard to a qubit of a real amplitude vector. */
function hadamard(state: number[], qubit: number): void {
    const mask = 1 << (2 - qubit);
    for (let i = 0; i < state.length; i += 1) {
        if ((i & mask) !== 0) {
            continue;
        }
        const j = i | mask;
        const a = state[i] ?? 0;
        const b = state[j] ?? 0;
        state[i] = INV_SQRT2 * (a + b);
        state[j] = INV_SQRT2 * (a - b);
    }
}

/** Apply the CCNOT permutation: swap |110> and |111>. */
function toffoli(state: number[]): void {
    const a = state[6] ?? 0;
    state[6] = state[7] ?? 0;
    state[7] = a;
}

/** The Toffoli gate generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { initial?: string; superposeControls?: boolean } | null) ?? {};
    const raw = typeof task.initial === "string" ? task.initial : "110";
    const bits = /^[01]{3}$/.test(raw) ? raw : "110";
    const state = new Array<number>(8).fill(0);
    state[Number.parseInt(bits, 2)] = 1;
    const superpose = task.superposeControls === true;
    const active = new Set([6, 7]);
    let step = 0;

    const emit = (description: string, codeLine: number, state_: EntityState, gateCount: number, extra: object = {}) => {
        const frame: VisualFrame = {
            stepNumber: step,
            entities: makeBars(state, active, state_),
            edges: [],
            description,
            codeLineNumber: codeLine,
            layout: "array",
            meta: {
                amplitudes: [...state],
                probabilities: state.map((a) => a * a),
                gateCount,
                norm: state.reduce((sum, a) => sum + a * a, 0),
                ...extra,
            },
        };
        step += 1;
        return frame;
    };

    yield emit(`Starting from the basis state |${bits}> on three qubits.`, 0, "idle", 0);

    if (superpose) {
        hadamard(state, 0);
        hadamard(state, 1);
        yield emit("Hadamards on both controls put them in superposition before the Toffoli.", 2, "idle", 2);
    }

    yield emit("The target flips only for the terms where both controls read one: |110> and |111>.", 3, "comparing", superpose ? 2 : 0);

    toffoli(state);
    yield emit("Toffoli swaps the amplitudes of |110> and |111>; all other amplitudes are unchanged.", 4, "comparing", superpose ? 3 : 1);

    yield emit("Final state reported with measurement probabilities for every basis state.", 5, "sorted", superpose ? 3 : 1, {
        done: true,
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of the Toffoli gate as a reversible AND-and-flip. It looks at two control bits and flips the target only when both are one; otherwise it changes nothing. Because it is a permutation of basis states, it loses no information and can be undone by applying it again. If the controls are in a superposition, the flip happens only to the part of the state where both controls are one, which is how reversible classical logic is embedded in a quantum circuit.",
        invariants: [
            "The amplitudes of the six states without both controls set are unchanged.",
            "The amplitudes of |110> and |111> are exchanged.",
            "The sum of squared amplitudes stays equal to one.",
        ],
        correctness:
            "The CCNOT matrix is the identity except for the 2-by-2 block on |110> and |111>, which is the swap matrix. A swap matrix is its own inverse and is unitary, so the gate preserves the norm. Applying it to any state vector exchanges exactly those two entries, which implements the rule flip the target if and only if both controls are one for every basis component, and by linearity for superpositions.",
        complexityRationale:
            "Only two of the eight amplitudes change, so the gate uses a constant number of operations and constant memory. On a general n-qubit register a Toffoli touches half the 2^n amplitudes and costs O(2^n), which is why hardware usually compiles it into several one- and two-qubit gates.",
        uses: [
            "Reversible implementations of classical Boolean circuits",
            "Arithmetic circuits such as reversible adders inside quantum algorithms",
            "Building blocks of quantum error-correction and oracle constructions",
        ],
        references: [
            "Toffoli, Reversible Computing, 1980",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 3",
        ],
        workedExample:
            "Starting from |110>, the amplitude vector is zero everywhere except index 6. Toffoli swaps indices 6 and 7, giving |111>: both controls were one, so the target flipped. Starting from |101> would leave the state unchanged because the second control is zero.",
    },
    id: "toffoli-gate",
    name: "Toffoli Gate",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { initial: "110", superposeControls: false },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the three-qubit state from the input bits",
        "optionally apply a Hadamard to each control qubit",
        "identify the two basis states with both controls equal to one",
        "leave all other amplitudes unchanged",
        "swap the amplitudes of |110> and |111>",
        "report the final probabilities of all eight states",
        "done: the target flipped exactly when both controls were one",
    ],
};

export default module;
