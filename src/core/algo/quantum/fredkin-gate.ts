/**
 * fredkin-gate.ts - Fredkin Gate (Controlled Swap)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Fredkin gate is a three-qubit reversible gate with one control and two
 * targets. When the control is 0 the targets pass through unchanged; when the
 * control is 1 the two targets are swapped. Because it only permutes basis
 * states, it conserves the number of ones (Hamming weight), making it a
 * conservative and universally reversible logic gate. This module simulates
 * the gate exactly on a three-qubit state vector of up to eight amplitudes.
 *
 * This is an exact, small, real-amplitude simulation of a single gate: it does
 * not model decoherence, noise, or continuous-time dynamics. It is a teaching
 * model of the gate's truth table and its conservation property.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^n) for n qubits (here n = 3, so 8 basis states)
 *   Space: O(2^n) for the state vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One node per three-bit basis state, positioned by bit value.
 *   - The input state is highlighted; the output state turns green.
 *   - An edge shows the permutation induced by the gate.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/** Apply a Fredkin gate: control is bit 2, targets are bits 1 and 0. */
function fredkin(state: number): number {
    const control = (state >> 2) & 1;
    if (control === 0) {
        return state;
    }
    const b1 = (state >> 1) & 1;
    const b0 = state & 1;
    if (b1 === b0) {
        return state;
    }
    return (state & 4) | (b0 << 1) | b1;
}
function popcount(x: number): number {
    let count = 0;
    for (let i = 0; i < 3; i += 1) {
        count += (x >> i) & 1;
    }
    return count;
}
function bits(x: number): string {
    return x.toString(2).padStart(3, "0");
}

/** Build basis-state nodes for one frame. */
function makeEntities(input: number, output: number, phase: "idle" | "check" | "done", checked: number | null): VisualEntity[] {
    return Array.from({ length: 8 }, (_, state) => {
        let stateFlag: EntityState = "idle";
        if (phase === "check" && state === checked) stateFlag = "comparing";
        if (phase === "done") {
            if (state === output) stateFlag = "sorted";
            else if (state === input) stateFlag = "visited";
        }
        return {
            id: `basis-${state}`,
            type: "node" as const,
            label: bits(state),
            value: state,
            state: stateFlag,
            x: state % 4,
            y: Math.floor(state / 4),
            width: 0,
            height: 0,
            metadata: { index: state, weight: popcount(state), mapped: fredkin(state) },
        };
    });
}

/** The Fredkin gate generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { state?: number } | null) ?? {};
    const state = Math.max(0, Math.min(7, Math.floor(Number(task.state ?? 5)) || 0));
    const output = fredkin(state);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(state, output, "idle", null),
        edges: [],
        description: `Fredkin gate on three qubits: input ${bits(state)}, control bit 2 and targets bits 1 and 0.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { input: state, output: state, control: (state >> 2) & 1, weight: popcount(state), checked: -1 },
    };
    step += 1;

    for (let s = 0; s < 8; s += 1) {
        const mapped = fredkin(s);
        yield {
            stepNumber: step,
            entities: makeEntities(state, output, "check", s),
            edges: [],
            description: `${bits(s)} maps to ${bits(mapped)}; Hamming weight ${popcount(s)} to ${popcount(mapped)} ${popcount(s) === popcount(mapped) ? "is conserved" : "changed"}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { input: state, output: state, control: (state >> 2) & 1, weight: popcount(s), checked: s, mapped, conserved: popcount(s) === popcount(mapped) },
        };
        step += 1;
    }

    const edges: VisualEdge[] =
        output === state
            ? []
            : [
                  {
                      id: "swap",
                      sourceId: `basis-${state}`,
                      targetId: `basis-${output}`,
                      label: "swap",
                      state: "active",
                      directed: true,
                  },
              ];
    yield {
        stepNumber: step,
        entities: makeEntities(state, output, "done", null),
        edges,
        description: `Done: input ${bits(state)} becomes ${bits(output)}; every mapping conserves Hamming weight, so the gate is conservative and reversible.`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            input: state,
            output,
            control: (state >> 2) & 1,
            weight: popcount(state),
            outputWeight: popcount(output),
            conserved: popcount(state) === popcount(output),
            done: true,
        },
    };
}

/** The Fredkin gate module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A Fredkin gate is a controlled swap: one qubit decides whether to exchange the other two. Imagine a switch that, when the control wire is on, crosses two lanes of traffic and otherwise leaves them straight. Because it only rearranges basis states and never creates or destroys a one, it is reversible and conserves the number of ones.",
        invariants: [
            "When the control bit is zero, the gate is the identity.",
            "When the control bit is one, the two target bits are exchanged.",
            "The Hamming weight of every basis state is unchanged by the mapping.",
        ],
        correctness:
            "The gate acts on each three-bit basis state by a permutation: fixing the control bit at zero leaves the state unchanged, while a one control swaps the two target bits and keeps the control bit. A permutation of basis states is a unitary, hence reversible, operation, and since the swap only exchanges a one and a zero, the count of ones is preserved on every input.",
        complexityRationale:
            "Evaluating the gate on one basis state is constant work; checking the full truth table visits all 2^n = 8 states, so O(2^n) time and O(2^n) space for the displayed nodes.",
        uses: [
            "Reversible and conservative logic circuit design",
            "Building universal reversible gate sets with the Toffoli gate",
            "Low-power computing where information loss must be avoided",
        ],
        references: [
            "Fredkin and Toffoli, Conservative Logic, 1982",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Section 3.3, 2010",
        ],
        workedExample:
            "With control bit 2 set, input 101 has targets 0 and 1, so the gate swaps them to give 110. The control stays 1 and the number of ones stays two. Input 100 has equal target bits (both 0), so it is unchanged, and any input with control 0, such as 011, also passes straight through.",
    },
    id: "fredkin-gate",
    name: "Fredkin Gate (Controlled Swap)",
    category: "quantum",
    complexity: { time: "O(2^n)", space: "O(2^n)" },
    defaultInput: { state: 5 },
    visualType: "point",
    run,
    pseudocode: [
        "read the three-bit input state",
        "let the control be bit two",
        "if the control is zero, leave the state unchanged",
        "otherwise exchange the two target bits",
        "verify the mapping conserves Hamming weight",
        "done: report the permuted output state",
    ],
};

export default module;
