/**
 * deutsch-jozsa.ts - Deutsch-Jozsa Algorithm (exact small state-vector toy model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a Boolean function on n bits promised to be either constant or
 * balanced, Deutsch-Jozsa decides which with one oracle query. It prepares a
 * superposition of all inputs, uses the oracle to phase-kick the function
 * values, and applies a final Hadamard transform. Measuring all zeros means
 * constant; any other result means balanced.
 *
 * This is an exact simulation of the state vector for small n (up to 4 bits).
 * It is a teaching model, not a physical quantum computer or a fault-tolerant
 * implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * 2^n) to simulate the state vector
 *   Space: O(2^n) for the amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the probability of each input-register basis state.
 *   - The measured outcome is yellow; the final classification is green.
 *   - The metadata reports the all-zeros probability and the verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Apply a Hadamard gate to one qubit of a real state vector. */
function applyHadamard(state: number[], qubit: number): void {
    const step = 1 << qubit;
    const inverse = Math.SQRT1_2;
    for (let base = 0; base < state.length; base += step * 2) {
        for (let offset = 0; offset < step; offset += 1) {
            const a = base + offset;
            const b = a + step;
            const va = state[a]!;
            const vb = state[b]!;
            state[a] = (va + vb) * inverse;
            state[b] = (va - vb) * inverse;
        }
    }
}

/** Build probability bars for the n-bit input register (sum over answer qubit). */
function makeBars(probabilities: number[], measured: number, verdict: string): VisualEntity[] {
    return probabilities.map((probability, index) => {
        let state: EntityState = "idle";
        if (verdict !== "pending") {
            state = index === measured ? "sorted" : "idle";
        } else if (index === measured) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: probability.toFixed(3),
            value: probability,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, basis: index.toString(2).padStart(probabilities.length.toString(2).length, "0") },
        };
    });
}

/** The Deutsch-Jozsa generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; truthTable?: number[]; balanced?: boolean } | null) ?? {};
    const n = Math.min(4, Math.max(1, typeof task.n === "number" ? Math.floor(task.n) : 3));
    const size = 1 << n;
    let truthTable: number[];
    if (Array.isArray(task.truthTable) && task.truthTable.length === size) {
        truthTable = task.truthTable.map((value) => (value === 1 ? 1 : 0));
    } else if (task.balanced === false) {
        truthTable = Array.from({ length: size }, () => 0);
    } else {
        truthTable = Array.from({ length: size }, (_, index) => (index < size / 2 ? 0 : 1));
    }
    const ones = truthTable.reduce((sum, value) => sum + value, 0);
    const verdict: "constant" | "balanced" = ones === 0 || ones === size ? "constant" : "balanced";

    const state = Array.from({ length: size * 2 }, () => 0);
    state[1] = 1;

    function inputProbabilities(): number[] {
        const result: number[] = Array.from({ length: size }, () => 0);
        for (let x = 0; x < size; x += 1) {
            result[x] = (state[x * 2]! ** 2) + (state[x * 2 + 1]! ** 2);
        }
        return result;
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(inputProbabilities(), -1, "pending"),
        edges: [],
        description: `Preparing ${n} input qubits and one answer qubit; the oracle is ${verdict}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, allZerosProbability: 0, verdict: "pending", oracle: verdict, queries: 0 },
    };
    step += 1;

    for (let qubit = 0; qubit < n; qubit += 1) applyHadamard(state, qubit + 1);
    applyHadamard(state, 0);
    yield {
        stepNumber: step,
        entities: makeBars(inputProbabilities(), -1, "pending"),
        edges: [],
        description: "Applied Hadamard gates to all qubits, creating a uniform superposition.",
        codeLineNumber: 1,
        layout: "array",
        meta: { n, allZerosProbability: inputProbabilities()[0]!, verdict: "pending", oracle: verdict, queries: 0 },
    };
    step += 1;

    for (let x = 0; x < size; x += 1) {
        if (truthTable[x] === 1) {
            const zero = x * 2;
            const one = zero + 1;
            const tmp = state[zero]!;
            state[zero] = state[one]!;
            state[one] = tmp;
        }
    }
    yield {
        stepNumber: step,
        entities: makeBars(inputProbabilities(), -1, "pending"),
        edges: [],
        description: "The oracle flips the answer qubit for inputs where the function returns one.",
        codeLineNumber: 2,
        layout: "array",
        meta: { n, allZerosProbability: inputProbabilities()[0]!, verdict: "pending", oracle: verdict, queries: 1 },
    };
    step += 1;

    for (let qubit = 0; qubit < n; qubit += 1) applyHadamard(state, qubit + 1);
    const probabilities = inputProbabilities();
    const allZerosProbability = probabilities[0]!;
    const measuredVerdict: "constant" | "balanced" =
        allZerosProbability > 0.999 ? "constant" : "balanced";
    let measured = 0;
    for (let index = 1; index < size; index += 1) {
        if ((probabilities[index] ?? 0) > (probabilities[measured] ?? 0)) measured = index;
    }
    yield {
        stepNumber: step,
        entities: makeBars(probabilities, measured, "pending"),
        edges: [],
        description: `After the final Hadamard transform the all-zeros outcome has probability ${allZerosProbability.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { n, allZerosProbability, verdict: "pending", oracle: verdict, queries: 1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, measured, measuredVerdict),
        edges: [],
        description:
            measuredVerdict === "constant"
                ? `Measurement always gives all zeros, so the function is constant.`
                : `Measurement never gives all zeros, so the function is balanced.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, allZerosProbability, verdict: measuredVerdict, oracle: verdict, queries: 1 },
    };
}

/** The Deutsch-Jozsa module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A classical computer may need half plus one of all inputs to tell a constant function from a balanced one. Quantum interference does it in one oracle call: the answer qubit turns function values into phases, and the final Hadamard transform makes a constant function interfere constructively on all zeros while a balanced function cancels that outcome completely.",
        invariants: [
            "The state vector has unit norm throughout, so probabilities sum to one.",
            "The oracle is queried exactly once.",
            "The answer qubit starts in the minus state so the oracle writes the function value into the phase.",
        ],
        correctness:
            "After the first Hadamards the input register is a uniform superposition. The oracle maps each input x to (-1)^f(x) times that input. The final Hadamard transform computes the Fourier coefficient at zero, which is the average of (-1)^f(x) over all inputs. That average is plus one when f is constant and zero when f is balanced, so measuring all zeros has probability one or zero exactly as required.",
        complexityRationale:
            "On a real quantum computer the algorithm uses O(n) gates and one oracle query. This exact classical simulation holds 2^(n+1) amplitudes and applies O(n * 2^n) operations to update them.",
        uses: [
            "The canonical example of quantum speedup over classical queries",
            "A building block for more advanced Fourier-sampling algorithms",
            "Teaching interference and oracle models in quantum computing",
        ],
        references: [
            "Deutsch and Jozsa, Rapid Solution of Problems by Quantum Computation, 1992",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 5",
        ],
        workedExample:
            "For one input bit, the balanced function f(0)=0, f(1)=1 gives amplitudes (0, 0, 0, -1) after the oracle and leaves zero probability on the all-zero input after the final Hadamard. The verdict is balanced after a single query.",
    },
    id: "deutsch-jozsa",
    name: "Deutsch-Jozsa Algorithm",
    category: "quantum",
    complexity: { time: "O(n * 2^n) simulated", space: "O(2^n) simulated" },
    defaultInput: { n: 3, balanced: true },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the answer qubit to the minus state",
        "apply Hadamard gates to all qubits",
        "query the oracle once to phase-kick the function",
        "apply Hadamard gates to the input register",
        "measure the input register",
        "all zeros means constant, otherwise balanced",
        "done: report the verdict and query count",
    ],
};

export default module;
