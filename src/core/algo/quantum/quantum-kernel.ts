/**
 * quantum-kernel.ts - Quantum Kernel Estimation (Exact Small Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A quantum kernel maps each classical data point x to a quantum state
 * |phi(x)> using a parameterized circuit, then defines K(x, y) as the squared
 * overlap |<phi(x)|phi(y)>|^2. Because the overlap is measured in a high-
 * dimensional Hilbert space, the kernel can capture structure that is hard to
 * represent classically. The resulting Gram matrix can be fed to any kernel
 * method, such as a support vector machine or kernel ridge regression.
 *
 * This is an exact two-qubit state-vector simulation of an angle-encoding
 * feature map: Hadamards create a superposition, rotations RZ encode the two
 * feature values as phases, and a CNOT entangles the qubits. For this map the
 * kernel has the closed form cos^2((x0-y0)/2) times cos^2((x1-y1)/2), which the
 * simulation reproduces exactly. It models only the noiseless feature states
 * and their overlaps; it does not model hardware noise, sampling shot noise,
 * or training of large models.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N^2 * 2^q) for N data points and q qubits
 *   Space: O(N^2 + 2^q) for the Gram matrix and a state vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each Gram matrix entry K[x_i][x_j] is a grid cell.
 *   - The diagonal is green, the active pair yellow, low values gray.
 *   - meta carries the data, the Gram matrix, and a reference prediction.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Complex {
    re: number;
    im: number;
}

const cMul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cConj = (a: Complex): Complex => ({ re: a.re, im: -a.im });
const cAbsSquared = (a: Complex): number => a.re * a.re + a.im * a.im;
const INV_SQRT2 = 1 / Math.sqrt(2);

/** Apply a single-qubit 2x2 complex gate to a state vector. */
export function applySingle(state: Complex[], qubit: number, gate: Complex[][]): Complex[] {
    const result = [...state];
    const bit = 1 << qubit;
    for (let index = 0; index < state.length; index += 1) {
        if (index & bit) {
            continue;
        }
        const partner = index | bit;
        const a = state[index] as Complex;
        const b = state[partner] as Complex;
        result[index] = cAdd2(cMul((gate[0] as Complex[])[0] as Complex, a), cMul((gate[0] as Complex[])[1] as Complex, b));
        result[partner] = cAdd2(cMul((gate[1] as Complex[])[0] as Complex, a), cMul((gate[1] as Complex[])[1] as Complex, b));
    }
    return result;
}

function cAdd2(a: Complex, b: Complex): Complex {
    return { re: a.re + b.re, im: a.im + b.im };
}

/** Apply a CNOT with the given control and target qubit indices. */
export function applyCNOT(state: Complex[], control: number, target: number): Complex[] {
    const result = [...state];
    const controlBit = 1 << control;
    const targetBit = 1 << target;
    for (let index = 0; index < state.length; index += 1) {
        if ((index & controlBit) !== 0 && (index & targetBit) === 0) {
            const partner = index | targetBit;
            result[index] = state[partner] as Complex;
            result[partner] = state[index] as Complex;
        }
    }
    return result;
}

const HADAMARD: Complex[][] = [
    [{ re: INV_SQRT2, im: 0 }, { re: INV_SQRT2, im: 0 }],
    [{ re: INV_SQRT2, im: 0 }, { re: -INV_SQRT2, im: 0 }],
];

/** Build the feature state |phi(x)> for a two-feature point. */
export function featureState(x: number[]): Complex[] {
    let state: Complex[] = [{ re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }];
    state = applySingle(state, 0, HADAMARD);
    state = applySingle(state, 1, HADAMARD);
    const theta0 = x[0] ?? 0;
    const theta1 = x[1] ?? 0;
    const rz0: Complex[][] = [
        [{ re: Math.cos(-theta0 / 2), im: Math.sin(-theta0 / 2) }, { re: 0, im: 0 }],
        [{ re: 0, im: 0 }, { re: Math.cos(theta0 / 2), im: Math.sin(theta0 / 2) }],
    ];
    const rz1: Complex[][] = [
        [{ re: Math.cos(-theta1 / 2), im: Math.sin(-theta1 / 2) }, { re: 0, im: 0 }],
        [{ re: 0, im: 0 }, { re: Math.cos(theta1 / 2), im: Math.sin(theta1 / 2) }],
    ];
    state = applySingle(state, 0, rz0);
    state = applySingle(state, 1, rz1);
    return applyCNOT(state, 0, 1);
}

/** Squared-overlap quantum kernel value. */
export function quantumKernel(x: number[], y: number[]): number {
    const a = featureState(x);
    const b = featureState(y);
    let overlap: Complex = { re: 0, im: 0 };
    for (let index = 0; index < a.length; index += 1) {
        overlap = cAdd2(overlap, cMul(cConj(a[index] as Complex), b[index] as Complex));
    }
    return cAbsSquared(overlap);
}

/** Closed form of the kernel for this feature map. */
export function closedFormKernel(x: number[], y: number[]): number {
    const dx = ((x[0] ?? 0) - (y[0] ?? 0)) / 2;
    const dy = ((x[1] ?? 0) - (y[1] ?? 0)) / 2;
    return Math.cos(dx) ** 2 * Math.cos(dy) ** 2;
}

/** Build Gram-matrix cells, revealing entries up to the active index. */
function makeCells(data: number[][], gram: number[][], visible: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < data.length; i += 1) {
        for (let j = 0; j < data.length; j += 1) {
            const index = i * data.length + j;
            const shown = index <= visible;
            let state: EntityState = "unvisited";
            if (shown) {
                state = i === j ? "sorted" : j === visible % data.length ? "comparing" : (gram[i]?.[j] as number) > 0.5 ? "active" : "idle";
            }
            entities.push({
                id: `gram-${i}-${j}`,
                type: "cell",
                label: shown ? (gram[i]?.[j] as number).toFixed(4) : "?",
                value: shown ? (gram[i]?.[j] as number) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, shown, value: shown ? (gram[i]?.[j] as number) : 0 },
            });
        }
    }
    return entities;
}

/** The quantum-kernel generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { data?: number[][] } | null) ?? {};
    const data: number[][] = Array.isArray(task.data) && task.data.length > 0
        ? task.data.map((point) => [...point])
        : [[0, 0], [1, 0], [0, 1]];
    const n = data.length;
    const gram: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeCells(data, gram, -1),
        edges: [],
        description: `Quantum kernel on ${n} two-feature points; each point is encoded into a two-qubit feature state.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n, points: n, pairs: 0, gram: [] as number[], diagonal: false, data: data.flat() },
    };

    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            gram[i]![j] = quantumKernel(data[i] as number[], data[j] as number[]);
            yield {
                stepNumber: step++,
                entities: makeCells(data, gram, i * n + j),
                edges: [],
                description: `K(x${i}, x${j}) = |<phi(x${i})|phi(x${j})>|^2 = ${(gram[i] as number[])[j]?.toFixed(6)}.`,
                codeLineNumber: i === j ? 3 : 4,
                layout: "grid",
                meta: { rows: n, cols: n, points: n, pairs: i * n + j + 1, gram: gram.flat(), diagonal: i === j, data: data.flat() },
            };
        }
    }

    const diagonal = gram.every((row, index) => Math.abs((row[index] as number) - 1) < 1e-9);
    const symmetric = gram.every((row, i) => row.every((value, j) => Math.abs(value - (gram[j]?.[i] as number)) < 1e-9));
    const meanOffDiagonal = n > 1
        ? gram.reduce((sum, row, i) => sum + row.reduce((inner, value, j) => inner + (i === j ? 0 : value), 0), 0) / (n * (n - 1))
        : 0;
    yield {
        stepNumber: step,
        entities: makeCells(data, gram, n * n - 1),
        edges: [],
        description: `Gram matrix complete: unit diagonal ${diagonal}, symmetric ${symmetric}; mean off-diagonal kernel ${meanOffDiagonal.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: n,
            cols: n,
            points: n,
            pairs: n * n,
            gram: gram.flat(),
            diagonal,
            symmetric,
            meanOffDiagonal,
            data: data.flat(),
            note: "exact two-qubit state-vector simulation, no shot noise or hardware error",
        },
    };
}

/** The quantum-kernel module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A quantum feature map turns each data point into a quantum state by encoding its features as rotation angles. Similar inputs produce states with a large overlap, so the squared overlap works as a similarity score. Collect all pairwise scores into a Gram matrix and hand it to a conventional kernel learner. The quantum circuit is doing the feature engineering; the learning algorithm stays classical.",
        invariants: [
            "Every feature state is normalized, so K(x, x) equals one.",
            "The overlap is symmetric, so the Gram matrix is symmetric.",
            "Squared overlaps lie between zero and one for all pairs.",
        ],
        correctness:
            "Hadamards create an equal superposition; RZ rotations imprint phases determined by the features, and the CNOT entangles the qubits, producing a normalized state |phi(x)>. The squared inner product of two normalized states is symmetric and lies in [0, 1], and equals one only for identical states. For this two-qubit map the overlap works out to cos((x0-y0)/2) times cos((x1-y1)/2), so the kernel is the product of two cosine kernels; a product of positive semidefinite kernels is positive semidefinite, making the Gram matrix a valid kernel matrix for kernel methods.",
        complexityRationale:
            "Each kernel entry builds a state vector of 2^q amplitudes with a constant number of gates and takes an inner product, costing O(2^q). Filling the N by N Gram matrix computes N^2 entries, giving O(N^2 * 2^q) time and O(N^2 + 2^q) space.",
        uses: [
            "Quantum machine learning on near-term quantum processors",
            "Kernel ridge regression and support vector machines with quantum features",
            "Studying when quantum feature maps offer an advantage",
        ],
        references: [
            "Havlicek et al., Supervised Learning with Quantum-Enhanced Feature Spaces, 2019",
            "Schuld and Killoran, Quantum Machine Learning in Feature Hilbert Spaces, 2019",
        ],
        workedExample:
            "For x = (0, 0) and y = (1, 0), the closed form gives cos(0.5)^2 times cos(0)^2, about 0.770. The circuit simulation produces the same value from the squared overlap of the two amplitude vectors, and the diagonal entry K(x, x) is exactly one.",
    },
    id: "quantum-kernel",
    name: "Quantum Kernel Estimation",
    category: "quantum",
    complexity: { time: "O(N^2 * 2^q)", space: "O(N^2 + 2^q)" },
    defaultInput: { data: [[0, 0], [1, 0], [0, 1]] },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a set of classical feature vectors",
        "prepare each feature state with Hadamard and rotation gates",
        "entangle the qubits with a controlled not",
        "for every pair of points compute the state overlap",
        "square the overlap magnitude to form the kernel",
        "fill the symmetric Gram matrix entry by entry",
        "verify the unit diagonal and symmetry",
        "pass the Gram matrix to a classical kernel learner",
        "done: report the Gram matrix and its properties",
    ],
};

export default module;
