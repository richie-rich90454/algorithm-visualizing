/**
 * transversal-gate.ts - Transversal Logical Gates (3-qubit repetition code)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A transversal gate acts on a quantum error-correcting code by applying one
 * physical gate to each qubit (or to a single distinguished qubit), never
 * coupling qubits inside one encoded block. Because an error on one physical
 * qubit cannot spread to others in the block, transversal gates are naturally
 * fault tolerant. The three-qubit bit-flip repetition code encodes a logical
 * qubit as alpha times 000 plus beta times 111. Logical X is the transversal
 * product X X X, and logical Z can be the single-qubit operator Z on any one
 * physical qubit.
 *
 * Limits: exact state-vector simulation of three qubits, only the bit-flip
 * repetition code, and only the transversal X and Z gates. No noise, no
 * syndrome extraction, and no non-transversal gates such as the Hadamard.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(gates * 2^3)
 *   Space: O(2^3) for the eight amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the eight computational-basis amplitudes of the encoded block.
 *   - The two code words 000 and 111 are gold; other bars stay gray.
 *   - meta carries the logical amplitudes, stabilizer values, and gate history.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Gate = "X" | "Z";

function makeBars(amplitudes: number[], active: number): VisualEntity[] {
    return amplitudes.map((value, index) => {
        let state: "comparing" | "sorted" | "idle" = "idle";
        if (index === 0 || index === 7) {
            state = index === active ? "comparing" : "sorted";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, basis: index.toString(2).padStart(3, "0") },
        };
    });
}

/** Apply logical X = X X X by pairing each basis state with its bitwise complement. */
function applyLogicalX(amplitudes: number[]): number[] {
    const next = amplitudes.slice();
    for (let i = 0; i < 8; i += 1) {
        const partner = i ^ 7;
        if (partner > i) {
            const tmp = next[i] ?? 0;
            next[i] = next[partner] ?? 0;
            next[partner] = tmp;
        }
    }
    return next;
}

/** Apply logical Z = Z on the first physical qubit. */
function applyLogicalZ(amplitudes: number[]): number[] {
    return amplitudes.map((value, index) => ((index & 1) === 1 ? -(value ?? 0) : (value ?? 0)));
}

/** Expectation of a Pauli product given parity masks over three qubits. */
function stabilizer(amplitudes: number[], maskA: number, maskB: number): number {
    let total = 0;
    for (let i = 0; i < 8; i += 1) {
        const parityA = ((i & maskA) !== 0) ? -1 : 1;
        const parityB = ((i & maskB) !== 0) ? -1 : 1;
        total += (amplitudes[i] ?? 0) ** 2 * parityA * parityB;
    }
    return total;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { theta?: number; gates?: Gate[] } | null) ?? {};
    const theta = Number.isFinite(Number(task.theta)) ? Number(task.theta) : Math.PI / 4;
    const rawGates = Array.isArray(task.gates) ? task.gates : ["X", "Z", "X"];
    const gates: Gate[] = rawGates.map((g) => (g === "Z" ? "Z" : "X")).slice(0, 12);

    let amplitudes = Array.from({ length: 8 }, () => 0);
    amplitudes[0] = Math.cos(theta);
    amplitudes[7] = Math.sin(theta);
    let active = 0;

    const metaFor = (phase: string, gateIndex: number, gate: string) => {
        const a = amplitudes[0] ?? 0;
        const b = amplitudes[7] ?? 0;
        return {
            phase,
            gateIndex,
            gate,
            theta,
            gateCount: gates.length,
            logicalAmplitudes: [a, b],
            codeFidelity: a * a + b * b,
            stabilizers: [
                stabilizer(amplitudes, 1, 2),
                stabilizer(amplitudes, 2, 4),
            ],
        };
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(amplitudes, active),
        edges: [],
        description: `Encode cos(theta) times 000 plus sin(theta) times 111 with theta = ${theta.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor("encoded", -1, "none"),
    };
    step += 1;

    for (let index = 0; index < gates.length; index += 1) {
        const gate = gates[index] ?? "X";
        amplitudes = gate === "X" ? applyLogicalX(amplitudes) : applyLogicalZ(amplitudes);
        active = gate === "X" ? 7 : 0;
        yield {
            stepNumber: step,
            entities: makeBars(amplitudes, active),
            edges: [],
            description: `Apply transversal logical ${gate}${gate === "X" ? " across all three physical qubits" : " on the first physical qubit"}; the state stays inside the code space.`,
            codeLineNumber: gate === "X" ? 3 : 4,
            layout: "array",
            meta: metaFor("gate", index, gate),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(amplitudes, active),
        edges: [],
        description: `Applied ${gates.length} transversal gate(s); the encoded amplitudes are (${(amplitudes[0] ?? 0).toFixed(3)}, ${(amplitudes[7] ?? 0).toFixed(3)}).`,
        codeLineNumber: 6,
        layout: "array",
        meta: metaFor("complete", gates.length, "none"),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To protect a qubit, spread its information across several physical qubits. In the three-qubit repetition code, flipping all three physical qubits flips the encoded logical bit, and applying a phase flip to just one of them applies a logical phase flip. Because each operation touches physical qubits without consulting their neighbors inside the block, a single physical fault cannot cascade into a logical error.",
        invariants: [
            "The amplitudes stay nonzero only on 000 and 111, so the state remains in the code space.",
            "Both stabilizers Z1 Z2 and Z2 Z3 keep expectation value plus one.",
            "Logical X swaps the two code-word amplitudes and logical Z negates the 111 amplitude.",
        ],
        correctness:
            "The code space is spanned by 000 and 111, which share the plus-one eigenspace of both stabilizers. Products of X on all three qubits map 000 to 111 and back, so within the code space they implement logical X. Z on the first qubit leaves 000 unchanged and negates 111, which is exactly logical Z. Both operations commute with every stabilizer and therefore preserve the code space and the stabilizer expectations. Applying X twice or Z twice returns the logical state, completing the Pauli group up to global phase.",
        complexityRationale:
            "Each gate permutes or re-signs eight amplitudes, so the cost is O(gates * 2^3), which is constant for the three-qubit code. The visualization keeps one eight-element amplitude vector.",
        uses: [
            "Fault-tolerant logical operations in stabilizer codes",
            "Teaching the Eastin-Knill limit on transversal gate sets",
            "Building blocks for magic-state distillation and lattice surgery",
        ],
        references: [
            "Shor, Scheme for Reducing Decoherence in Quantum Computer Memory, 1995",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 10",
        ],
        workedExample:
            "Encode (000 plus 111) divided by the square root of two. Applying X to all three qubits turns it into (111 plus 000) divided by the square root of two, the same state up to relabeling, so it is a logical X. Applying Z to the first qubit changes the sign of 111, producing (000 minus 111) divided by the square root of two, the logical Z eigenstate.",
    },
    id: "transversal-gate",
    name: "Transversal Logical Gate",
    category: "quantum",
    complexity: { time: "O(gates * 2^3)", space: "O(2^3)" },
    defaultInput: { theta: Math.PI / 4, gates: ["X", "Z", "X"] },
    visualType: "array",
    run,
    pseudocode: [
        "encode alpha on 000 and beta on 111",
        "for each requested logical gate",
        "for logical X apply physical X to every qubit in the block",
        "for logical Z apply physical Z to the first qubit",
        "verify the state still lies in the code space",
        "measure stabilizer expectations to confirm correctness",
        "advance to the next gate",
        "done: report the final encoded logical state",
    ],
};

export default module;
