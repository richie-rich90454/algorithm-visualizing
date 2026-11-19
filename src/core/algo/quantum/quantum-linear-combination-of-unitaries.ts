/**
 * quantum-linear-combination-of-unitaries.ts - Linear Combination of Unitaries
 *
 * A linear combination of unitaries writes a target operator as a weighted sum
 * of easily implemented unitary gates. Dividing by the sum of the absolute
 * weights turns that sum into a valid quantum operation on a larger register.
 * The subroutine is the engine behind Hamiltonian simulation, quantum linear
 * solvers, and block encodings: prepare the coefficient register, apply the
 * controlled unitaries, then undo the preparation to leave the desired state in
 * the main register on a successful postselection.
 *
 * This small simulator applies Pauli strings directly to a two-qubit state
 * vector and reports the normalized result; it does not model the ancilla
 * register or the probability of postselection.
 *
 * Time O(terms * dim * qubits); space O(dim) for the state vector.
 *
 * Visualization: four amplitude bars. Each term is highlighted in turn, then
 * the accumulated state and the normalized final state are shown.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Term {
    pauli: string;
    coefficient: number;
}

interface LcuInput {
    initial?: number;
    terms?: Term[];
}

/** Apply a Pauli string such as "XZ" to a four-element real state vector. */
function applyPauli(label: string, state: number[]): number[] {
    const out = [0, 0, 0, 0];
    const characters = label.padEnd(2, "I").slice(0, 2).split("");
    for (let index = 0; index < 4; index += 1) {
        let target = index;
        let sign = 1;
        for (let qubit = 0; qubit < 2; qubit += 1) {
            const shift = 1 - qubit;
            const gate = characters[qubit] ?? "I";
            const bit = (target >> shift) & 1;
            if (gate === "X") {
                target = target ^ (1 << shift);
            } else if (gate === "Z" && bit === 1) {
                sign = -sign;
            }
        }
        out[target] = (out[target] ?? 0) + sign * (state[index] ?? 0);
    }
    return out;
}

function makeBars(amplitudes: number[], state: EntityState): VisualEntity[] {
    return amplitudes.map((amplitude, index) => ({
        id: `amp-${index}`,
        type: "bar" as const,
        label: amplitude.toFixed(4),
        value: amplitude,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, basis: index, amplitude },
    }));
}

function norm(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LcuInput | null) ?? {};
    const initial = Math.max(0, Math.min(3, Math.floor(Number(task.initial ?? 0)) || 0));
    const given = Array.isArray(task.terms) && task.terms.length > 0
        ? task.terms
        : [
              { pauli: "II", coefficient: 0.5 },
              { pauli: "XX", coefficient: 0.3 },
              { pauli: "ZZ", coefficient: 0.2 },
          ];
    const terms = given.slice(0, 8).map((term) => ({
        pauli: String(term.pauli ?? "II").slice(0, 2),
        coefficient: Number(term.coefficient ?? 0),
    }));
    const start = [0, 0, 0, 0];
    start[initial] = 1;

    yield {
        stepNumber: 0,
        entities: makeBars(start, "idle"),
        edges: [],
        description: `Starting from basis state |${initial.toString(2).padStart(2, "0")}> with ${terms.length} weighted unitaries.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { terms: terms.length, lambda: 0, amplitudes: [...start], probabilities: start.map((a) => a * a), initial },
    };

    const accumulated = [0, 0, 0, 0];
    let step = 1;
    for (const [index, term] of terms.entries()) {
        const contribution = applyPauli(term.pauli, start).map((value) => value * term.coefficient);
        contribution.forEach((value, i) => {
            accumulated[i] = (accumulated[i] ?? 0) + value;
        });
        yield {
            stepNumber: step,
            entities: makeBars(contribution, "comparing"),
            edges: [],
            description: `Term ${index + 1}: ${term.coefficient.toFixed(3)} times ${term.pauli} applied to the input contributes this vector.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                terms: terms.length,
                lambda: 0,
                amplitudes: contribution,
                probabilities: contribution.map((a) => a * a),
                initial,
                termIndex: index,
            },
        };
        step += 1;
    }

    const lambda = norm(accumulated);
    const normalized = lambda > 1e-12 ? accumulated.map((value) => value / lambda) : [...start];
    yield {
        stepNumber: step,
        entities: makeBars(accumulated, "active"),
        edges: [],
        description: `The weighted sum has norm lambda = ${lambda.toFixed(4)} before normalization.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { terms: terms.length, lambda, amplitudes: [...accumulated], probabilities: accumulated.map((a) => a * a), initial },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(normalized, "sorted"),
        edges: [],
        description: `Prepared state with amplitudes ${normalized.map((a) => a.toFixed(3)).join(", ")}; probabilities sum to one.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            terms: terms.length,
            lambda,
            amplitudes: normalized,
            probabilities: normalized.map((a) => a * a),
            initial,
            prepared: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A quantum computer can only apply unitary operations, but many useful operators are sums of unitaries. Write the operator as a weighted sum, prepare a small register whose amplitudes hold the square roots of the weights, apply each unitary under control of that register, and undo the preparation. Postselecting the ancilla in its original state leaves the desired sum applied to the input.",
        invariants: [
            "Each Pauli string is unitary and maps a normalized state to a normalized state.",
            "The accumulated vector is the exact weighted sum of the term contributions.",
            "Dividing by lambda makes the final vector have unit norm whenever lambda is nonzero.",
        ],
        correctness:
            "For each term the simulator permutes basis states with X and flips signs with Z, which is exactly multiplication by the corresponding tensor-product Pauli matrix. Summing coefficient times term therefore computes the action of the linear combination on the input. Normalizing by the vector norm reproduces the state obtained after successful ancilla postselection, up to the usual global phase.",
        complexityRationale:
            "There are a small number of terms, each touching a state vector of dimension dim over a fixed number of qubits, so the work is O(terms * dim * qubits). Only one state vector and the accumulated sum are stored, giving O(dim) space.",
        uses: [
            "Hamiltonian simulation by decomposition into Pauli strings",
            "Quantum solvers for linear systems and singular value estimation",
            "Block encoding of non-unitary matrices inside quantum algorithms",
        ],
        references: [
            "Low and Chuang, Hamiltonian Simulation by Qubitization, 2019",
            "Childs, Kothari and Wiebe, Quantum Algorithm for Systems of Linear Equations with Exponentially Improved Dependence on Precision, 2017",
        ],
        workedExample:
            "Start from |00> and combine II with weight 0.5, XX with weight 0.3, and ZZ with weight 0.2. The terms contribute (0.5,0,0,0), (0,0,0,0.3), and (0.2,0,0,0). Their sum is (0.7,0,0,0.3) with norm about 0.7616, so the prepared state is about (0.919,0,0,0.394).",
    },
    id: "quantum-linear-combination-of-unitaries",
    name: "Quantum Linear Combination of Unitaries",
    category: "quantum",
    complexity: { time: "O(terms * dim * qubits)", space: "O(dim)" },
    defaultInput: {
        initial: 0,
        terms: [
            { pauli: "II", coefficient: 0.5 },
            { pauli: "XX", coefficient: 0.3 },
            { pauli: "ZZ", coefficient: 0.2 },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "start from a computational basis state",
        "initialize the accumulated vector to zero",
        "for each weighted Pauli string apply it to the input",
        "multiply the result by its coefficient and add it to the accumulator",
        "compute lambda as the norm of the accumulated vector",
        "divide every amplitude by lambda to normalize",
        "done: report the prepared state and its probabilities",
    ],
};

export default module;
