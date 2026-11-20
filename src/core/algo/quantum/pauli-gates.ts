/**
 * pauli-gates.ts - The Three Pauli Gates on a Single Qubit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Pauli matrices X, Y, and Z are the three basic single-qubit rotations.
 * X flips the computational basis (a bit flip), Z flips the phase of |1> (a
 * phase flip), and Y does both up to a global phase. This module applies an
 * arbitrary sequence of Pauli gates to one of the four common input states
 * |0>, |1>, |+>, |-> and shows the exact complex amplitudes after each gate.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(g) for g gates, each a constant-time two-amplitude update
 *   Space: O(1) for the two complex amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two bars show the measurement probability of |0> and |1>.
 *   - The bar affected by the latest gate is highlighted; final bars are green.
 *   - Metadata reports the real and imaginary amplitudes and the phase.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Gate = "X" | "Y" | "Z";
type StateName = "0" | "1" | "+" | "-";
type Complex = [number, number];

interface PauliInput {
    state?: StateName;
    gates?: Gate[];
}

const S = Math.SQRT1_2;

function initialState(name: StateName): Complex[] {
    switch (name) {
        case "1":
            return [[0, 0], [1, 0]];
        case "+":
            return [[S, 0], [S, 0]];
        case "-":
            return [[S, 0], [-S, 0]];
        case "0":
        default:
            return [[1, 0], [0, 0]];
    }
}

/** Apply one Pauli matrix to a two-amplitude state in place. */
function applyGate(state: Complex[], gate: Gate): void {
    const a = state[0]!;
    const b = state[1]!;
    if (gate === "X") {
        state[0] = [b[0], b[1]];
        state[1] = [a[0], a[1]];
    } else if (gate === "Z") {
        state[1] = [-b[0], -b[1]];
    } else {
        // Y = [[0, -i], [i, 0]].
        state[0] = [b[1], -b[0]];
        state[1] = [-a[1], a[0]];
    }
}

function probabilities(state: Complex[]): number[] {
    return state.map(([re, im]) => re * re + im * im);
}

function makeBars(state: Complex[], active: boolean, done: boolean): VisualEntity[] {
    const probs = probabilities(state);
    return probs.map((p, index) => {
        let state_: EntityState = "idle";
        if (done) state_ = "sorted";
        else if (active) state_ = "comparing";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `|${index}> ${p.toFixed(3)}`,
            value: p,
            state: state_,
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, basis: index, probability: p, re: state[index]![0], im: state[index]![1] },
        };
    });
}

function snapshot(state: Complex[], gate: string, count: number) {
    return {
        gate,
        gateCount: count,
        reals: state.map(([re]) => re),
        imags: state.map(([, im]) => im),
        probabilities: probabilities(state),
        norm: probabilities(state).reduce((a, b) => a + b, 0),
    };
}

/** The Pauli-gate generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PauliInput | null) ?? {};
    const name: StateName = task.state ?? "0";
    const gates: Gate[] = Array.isArray(task.gates) && task.gates.length > 0
        ? task.gates.map((g) => (g === "X" || g === "Y" || g === "Z" ? g : "X"))
        : ["X", "Y", "Z"];
    const state = initialState(name);

    yield {
        stepNumber: 0,
        entities: makeBars(state, false, false),
        edges: [],
        description: `Initial state |${name}> with amplitudes ${state.map(([re, im]) => `(${re.toFixed(3)}, ${im.toFixed(3)})`).join(", ")}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { state: name, gates: [...gates], ...snapshot(state, "start", 0) },
    };

    for (let i = 0; i < gates.length; i += 1) {
        const gate = gates[i]!;
        applyGate(state, gate);
        yield {
            stepNumber: i + 1,
            entities: makeBars(state, true, false),
            edges: [],
            description: `Applied ${gate}: amplitudes are ${state.map(([re, im]) => `(${re.toFixed(3)}, ${im.toFixed(3)})`).join(", ")}.`,
            codeLineNumber: gate === "X" ? 2 : gate === "Y" ? 3 : 4,
            layout: "array",
            meta: { state: name, gates: [...gates], ...snapshot(state, gate, i + 1) },
        };
    }

    yield {
        stepNumber: gates.length + 1,
        entities: makeBars(state, false, true),
        edges: [],
        description: `Circuit complete: ${gates.length} Pauli gate(s); measurement probability of |0> is ${probabilities(state)[0]!.toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { state: name, gates: [...gates], ...snapshot(state, "done", gates.length), done: true },
    };
}

/** The Pauli gates module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A qubit is a pair of complex amplitudes, one for |0> and one for |1>. The Pauli X gate swaps those amplitudes, Z negates the second one, and Y combines a swap with phase factors. Because each gate is its own inverse (up to a global phase), applying one twice returns the original state.",
        invariants: [
            "The sum of the two squared amplitudes stays equal to one after every gate.",
            "X and Z anticommute, so their order matters up to a global phase.",
            "Each Pauli matrix is Hermitian and unitary, so it preserves measurement probabilities overall up to the state change it causes.",
        ],
        correctness:
            "Applying X swaps the two amplitudes, which is exactly the matrix [[0,1],[1,0]] acting on the vector. Z multiplies the |1> amplitude by -1 as its matrix specifies. Y multiplies |0> by -i times the |1> amplitude and |1> by i times the |0> amplitude, matching [[0,-i],[i,0]]. Therefore the stored vector after each gate is the exact matrix product applied to the input vector.",
        complexityRationale:
            "Each gate touches the two amplitudes a fixed number of times, so g gates take O(g) time. Only the two amplitudes are stored, O(1) space.",
        uses: [
            "Building blocks of quantum circuits and error correction",
            "Representing bit flips, phase flips, and their combination",
            "Basis changes in quantum error-correcting codes",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 4",
            "Mermin, Quantum Computer Science, Chapter 3",
        ],
        workedExample:
            "Start at |0> with amplitudes (1, 0). Applying X gives |1> with amplitudes (0, 1). Applying Y next gives -i|0> with amplitudes (-i, 0), and applying Z leaves that state unchanged because the |1> amplitude is zero. Each step matches the corresponding two-by-two matrix multiplication.",
    },
    id: "pauli-gates",
    name: "Pauli Gates",
    category: "quantum",
    complexity: { time: "O(g)", space: "O(1)" },
    defaultInput: { state: "0", gates: ["X", "Y", "Z"] },
    visualType: "array",
    run,
    pseudocode: [
        "load the two complex amplitudes of the input state",
        "for each gate in the circuit",
        "X swaps the two amplitudes",
        "Z negates the amplitude of the one state",
        "Y maps the pair through its two-by-two matrix",
        "record the amplitudes and probabilities",
        "done: report the final state",
    ],
};

export default module;
