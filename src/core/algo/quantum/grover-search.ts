/**
 * grover-search.ts - Grover's Search (Small Ideal Simulator)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Grover's algorithm finds a marked item in an unstructured search space of
 * N items using about square root of N queries instead of N. It places all
 * items in an equal superposition, flips the sign of the marked item with an
 * oracle, and reflects about the average amplitude with a diffusion operator.
 * Each repetition rotates the state closer to the marked item.
 *
 * This is a small, ideal state-vector simulator for up to four qubits. It
 * performs the exact amplitude arithmetic of Grover iterations, but it does
 * NOT model noise, decoherence, gate decomposition, or fault-tolerant error
 * correction. It is a teaching model, not real quantum hardware execution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * N) for N = 2^q amplitudes; iterations is O(sqrt(N))
 *   Space: O(N) for the state vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per computational basis state shows its amplitude.
 *   - The marked state turns red at the oracle step and green when measured.
 *   - meta carries amplitudes, probabilities, and the marked probability.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build amplitude bars for the N basis states. */
function makeBars(amplitudes: number[], marked: number, phase: string): VisualEntity[] {
    return amplitudes.map((amplitude, index) => {
        let state: EntityState = "idle";
        if (phase === "oracle" && index === marked) {
            state = "error";
        } else if (phase === "done" && index === marked) {
            state = "sorted";
        } else if (phase === "diffusion") {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${index.toString(2).padStart(amplitudes.length <= 2 ? 1 : 2, "0")}=${amplitude.toFixed(3)}`,
            value: amplitude,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, amplitude },
        };
    });
}

/** Probabilities derived from the amplitudes. */
function probabilities(amplitudes: number[]): number[] {
    return amplitudes.map((a) => a * a);
}

/** The Grover search generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { qubits?: number; marked?: number } | null) ?? {};
    const qubits = Math.min(4, Math.max(1, Math.floor(Number(task.qubits ?? 3)) || 3));
    const n = 1 << qubits;
    const markedInput = Math.floor(Number(task.marked ?? 5)) || 0;
    const marked = ((markedInput % n) + n) % n;

    const amplitudes = Array.from({ length: n }, () => 0);
    amplitudes[0] = 1;
    const iterations = Math.max(1, Math.floor((Math.PI / 4) * Math.sqrt(n)));
    const uniform = 1 / Math.sqrt(n);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(amplitudes, marked, "init"),
        edges: [],
        description: `Search ${n} items with ${qubits} qubits, starting from the basis state |0...0>. The marked index is ${marked}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { qubits, n, marked, iterations, amplitudes: [...amplitudes], probabilities: probabilities(amplitudes), gateCount: 0, markedProbability: amplitudes[marked] ** 2 },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        amplitudes[i] = uniform;
    }
    yield {
        stepNumber: step,
        entities: makeBars(amplitudes, marked, "superposition"),
        edges: [],
        description: "Hadamard gates create an equal superposition over all N items.",
        codeLineNumber: 2,
        layout: "array",
        meta: { qubits, n, marked, iterations, amplitudes: [...amplitudes], probabilities: probabilities(amplitudes), gateCount: qubits, markedProbability: amplitudes[marked] ** 2 },
    };
    step += 1;

    let gateCount = qubits;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        amplitudes[marked] = -(amplitudes[marked] ?? 0);
        gateCount += 1;
        yield {
            stepNumber: step,
            entities: makeBars(amplitudes, marked, "oracle"),
            edges: [],
            description: `Iteration ${iteration + 1}: the oracle flips the sign of the marked amplitude to ${(amplitudes[marked] ?? 0).toFixed(4)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { qubits, n, marked, iterations, iteration: iteration + 1, amplitudes: [...amplitudes], probabilities: probabilities(amplitudes), gateCount, markedProbability: amplitudes[marked] ** 2 },
        };
        step += 1;

        const mean = amplitudes.reduce((total, a) => total + a, 0) / n;
        for (let i = 0; i < n; i += 1) {
            amplitudes[i] = 2 * mean - (amplitudes[i] ?? 0);
        }
        gateCount += 1;
        yield {
            stepNumber: step,
            entities: makeBars(amplitudes, marked, "diffusion"),
            edges: [],
            description: `Diffusion reflects amplitudes about their mean ${mean.toFixed(4)}, amplifying the marked state.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { qubits, n, marked, iterations, iteration: iteration + 1, amplitudes: [...amplitudes], probabilities: probabilities(amplitudes), gateCount, markedProbability: amplitudes[marked] ** 2 },
        };
        step += 1;
    }

    const markedProbability = (amplitudes[marked] ?? 0) ** 2;
    yield {
        stepNumber: step,
        entities: makeBars(amplitudes, marked, "done"),
        edges: [],
        description: `After ${iterations} Grover iteration(s), measuring returns the marked index ${marked} with probability ${(markedProbability * 100).toFixed(1)} percent. Ideal simulator only; no hardware noise or error correction.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { qubits, n, marked, iterations, amplitudes: [...amplitudes], probabilities: probabilities(amplitudes), gateCount, markedProbability, note: "ideal small simulator, not fault-tolerant hardware" },
    };
}

/** The Grover search teaching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Grover search is like repeatedly tilting a fair coin toward the answer. Start with every item equally likely; the oracle marks the answer by flipping its sign, and the diffusion step reflects all amplitudes about their average. Each round makes the marked item a little larger and the others a little smaller, so after roughly square root of N rounds a measurement almost always finds it.",
        invariants: [
            "The sum of squared amplitudes stays equal to one after every gate.",
            "The oracle flips the sign of exactly the marked amplitude.",
            "Diffusion replaces each amplitude a with twice the mean minus a.",
        ],
        correctness:
            "Let the marked amplitude be m and the other N-1 amplitudes be u. After the oracle and diffusion, the marked amplitude becomes (2/N - 1) times the old marked value plus twice the mean of all others. In the two-dimensional span of the marked and uniform-unmarked states, one Grover iteration is a rotation by about 2/sqrt(N) radians toward the marked state. Starting from the uniform state, about pi/4 times sqrt(N) rotations take the state close to the marked basis vector, so measurement succeeds with high probability.",
        complexityRationale:
            "Each oracle or diffusion step touches all N amplitudes once, giving O(N) work per iteration. The number of iterations is the integer nearest pi/4 times sqrt(N), so the total query cost is O(sqrt(N)) and the simulator stores O(N) amplitudes.",
        uses: [
            "A teaching model for unstructured search speedups",
            "Explaining amplitude amplification as a general technique",
            "A subroutine in more advanced quantum algorithms",
        ],
        references: [
            "Grover, A Fast Quantum Mechanical Algorithm for Database Search, 1996",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 6",
        ],
        workedExample:
            "With three qubits there are eight items and two Grover iterations. Starting uniform at amplitude 0.3536 each, the oracle flips the marked amplitude and diffusion amplifies it to about 0.972, giving a measuring probability above 94 percent for the marked index.",
    },
    id: "grover-search",
    name: "Grover's Search (Ideal Small Simulator)",
    category: "quantum",
    complexity: { time: "O(sqrt(N) * N)", space: "O(N)" },
    defaultInput: { qubits: 3, marked: 5 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the state vector with amplitude one on the zero state",
        "apply Hadamard gates to form the uniform superposition",
        "compute the optimal number of Grover iterations",
        "for each iteration flip the marked amplitude with the oracle",
        "compute the mean of all amplitudes",
        "reflect every amplitude about the mean with diffusion",
        "measure: the marked state has the largest probability",
        "done: report the marked index and its success probability",
    ],
};

export default module;
