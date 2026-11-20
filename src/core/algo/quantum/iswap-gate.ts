/**
 * iswap-gate.ts - The iSWAP Two-Qubit Gate
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The iSWAP gate exchanges the states of two qubits and adds a phase of i to
 * the swapped components. Its matrix is the identity on |00> and |11>, and it
 * maps |01> to i times |10> and |10> to i times |01>. Because the exchange
 * carries a phase, applying it twice returns each qubit with a minus sign, and
 * a single application can create entanglement from a superposition.
 *
 * This is an exact two-qubit state-vector simulation on four complex
 * amplitudes. It assumes ideal gates with no decoherence, no gate error, and
 * no measurement shot noise, and reports ideal probabilities.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for four amplitudes
 *   Space: O(1) for the state vector and gate matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the four basis-state probabilities at each application.
 *   - The final frame reports concurrence and the gate matrix.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface IswapInput {
    theta?: number;
    phi?: number;
}

/** The iSWAP matrix as four rows of four complex pairs (real, imaginary). */
const GATE: number[][][] = [
    [[1, 0], [0, 0], [0, 0], [0, 0]],
    [[0, 0], [0, 0], [0, 1], [0, 0]],
    [[0, 0], [0, 1], [0, 0], [0, 0]],
    [[0, 0], [0, 0], [0, 0], [1, 0]],
];

/** Complex multiplication. */
function mul(a: [number, number], b: [number, number]): [number, number] {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

/** Apply the iSWAP matrix to a four-amplitude state. */
function applyGate(state: Array<[number, number]>): Array<[number, number]> {
    return state.map((_, row) => {
        let re = 0;
        let im = 0;
        for (let col = 0; col < 4; col += 1) {
            const product = mul(GATE[row]![col]! as [number, number], state[col]!);
            re += product[0];
            im += product[1];
        }
        return [re, im] as [number, number];
    });
}

/** Bars for basis-state probabilities. */
function makeBars(probabilities: number[], highlight: number): VisualEntity[] {
    const labels = ["|00>", "|01>", "|10>", "|11>"];
    return probabilities.map((value, index) => ({
        id: `basis-${index}`,
        type: "bar" as const,
        label: `${labels[index]} ${value.toFixed(3)}`,
        value,
        state: (index === highlight ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability: value },
    }));
}

/** Concurrence of a pure two-qubit state. */
function concurrence(amps: Array<[number, number]>): number {
    const [a, b, c, d] = amps;
    const first = mul(a!, d!);
    const second = mul(b!, c!);
    return 2 * Math.hypot(first[0] - second[0], first[1] - second[1]);
}

/** The iSWAP generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as IswapInput | null) ?? {};
    const clamp = (value: unknown, low: number, high: number, fallback: number): number =>
        typeof value === "number" && Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback;
    const theta = clamp(task.theta, 0, Math.PI, Math.PI / 4);
    const phi = clamp(task.phi, -Math.PI, Math.PI, 0);

    let state: Array<[number, number]> = [
        [0, 0],
        [Math.cos(theta), 0],
        [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi)],
        [0, 0],
    ];
    const probabilities = (): number[] => state.map(([re, im]) => re * re + im * im);
    const flatAmps = (): number[] => state.flatMap(([re, im]) => [re, im]);

    const metaBase = {
        theta,
        phi,
        gate: GATE.flat(2),
        concurrence: concurrence(state),
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(), 1),
        edges: [],
        description: `Prepared cos(theta) times |01> plus sin(theta) times |10> with theta ${theta.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaBase, phase: "input", amplitudes: flatAmps(), probabilities: probabilities(), applications: 0 },
    };
    step += 1;

    state = applyGate(state);
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(), 2),
        edges: [],
        description: `One iSWAP exchanges |01> and |10> and multiplies each swapped component by i.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...metaBase, phase: "swap", amplitudes: flatAmps(), probabilities: probabilities(), concurrence: concurrence(state), applications: 1 },
    };
    step += 1;

    state = applyGate(state);
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(), 1),
        edges: [],
        description: `A second iSWAP returns the original populations with a minus phase on the swapped components.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...metaBase, phase: "twice", amplitudes: flatAmps(), probabilities: probabilities(), concurrence: concurrence(state), applications: 2 },
    };
    step += 1;

    state = applyGate(state);
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(), -1),
        edges: [],
        description: `Third application completes the cycle; concurrence is ${concurrence(state).toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...metaBase, phase: "done", amplitudes: flatAmps(), probabilities: probabilities(), concurrence: concurrence(state), applications: 3 },
    };
}

/** The iSWAP gate module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A SWAP gate exchanges two qubits. The iSWAP does the same exchange but attaches a phase of i to the parts where the qubits differ. That tiny phase matters: it lets a single gate turn a superposition into an entangled state, and applying the gate twice returns the qubits with a minus sign rather than the original state.",
        invariants: [
            "The gate matrix is unitary, so total probability stays one.",
            "The states |00> and |11> are left unchanged by the gate.",
            "Applying iSWAP four times returns the identity because its eigenvalues are fourth roots of unity.",
        ],
        correctness:
            "Reading the matrix column by column, |00> maps to |00>, |11> maps to |11>, |01> maps to i|10>, and |10> maps to i|01>, which is exactly the exchange with a phase. The matrix rows and columns are orthonormal, so the transformation is unitary. Squaring it multiplies the swapped subspace by i squared equals minus one, and the fourth power is the identity. For an equal superposition of |01> and |10>, the output remains a Bell-like state with concurrence one, confirming entanglement.",
        complexityRationale:
            "The state has four complex amplitudes and the gate has sixteen entries, so one application takes constant time and space. The simulation is exact up to ordinary floating-point rounding; no sampling or truncation is involved.",
        uses: [
            "Native two-qubit coupling in superconducting processor architectures",
            "Generating entanglement and implementing swap networks",
            "Compiling fermionic simulation circuits where the exchange phase appears naturally",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 4",
            "Schuch and Siewert, Efficient Lindblad Simulation with iSWAP Couplers, 2003",
        ],
        workedExample:
            "Starting from (|01> plus |10>) over the square root of two, one iSWAP gives i times (|10> plus |01>) over the square root of two, the same entangled Bell state up to a global phase. Starting from |01> alone, one iSWAP gives i|10> and a second gives minus |01>.",
    },
    id: "iswap-gate",
    name: "iSWAP Gate",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { theta: 0.7853981633974483, phi: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "prepare a two-qubit state in the computational basis",
        "apply the iSWAP matrix to the four amplitudes",
        "exchange the |01> and |10> components with a phase i",
        "leave |00> and |11> untouched",
        "record the basis-state probabilities",
        "repeat to show the squared and cubed actions",
        "done: report concurrence of the final state",
    ],
};

export default module;
