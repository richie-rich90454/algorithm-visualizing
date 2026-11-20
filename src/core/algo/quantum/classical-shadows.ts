/**
 * classical-shadows.ts - Classical Shadows of a Bell State by Pauli Sampling
 *
 * Builds the classical shadow estimator of a two-qubit state. For each random
 * Pauli measurement basis, measuring a pure product outcome |phi> produces the
 * single-copy estimator (3|phi0><phi0| - I) tensor (3|phi1><phi1| - I). Averaged
 * over all bases and all Born-rule outcomes this estimator equals the true
 * density matrix exactly. The simulation enumerates every configuration, so
 * the expectation identity is checked with ideal probabilities rather than
 * finite-shot sampling.
 *
 * This is an idealized exact small simulation limited to a two-qubit Bell
 * state and random single-qubit Pauli measurements. It does not model finite
 * shot noise, general Clifford measurements, or more than two qubits.
 *
 * Time:  O(bases * outcomes * dim^2) with dim = 4
 * Space: O(dim^2)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type C = [number, number];
type Matrix = C[][];

const BASES = ["X", "Y", "Z"] as const;
type Basis = (typeof BASES)[number];
const SIGNS = [1, -1];
const LABELS = ["II", "XX", "YY", "ZZ"];

function cAdd(a: C, b: C): C {
    return [a[0] + b[0], a[1] + b[1]];
}

function cMul(a: C, b: C): C {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function cConj(a: C): C {
    return [a[0], -a[1]];
}

function kron2(a: Matrix, b: Matrix): Matrix {
    const out: Matrix = [];
    for (let i = 0; i < 2; i += 1) {
        for (let k = 0; k < 2; k += 1) {
            const row: C[] = [];
            for (let j = 0; j < 2; j += 1) {
                for (let l = 0; l < 2; l += 1) row.push(cMul(a[i]![j]!, b[k]![l]!));
            }
            out.push(row);
        }
    }
    return out;
}

const I2: Matrix = [[[1, 0], [0, 0]], [[0, 0], [1, 0]]];
const PX: Matrix = [[[0, 0], [1, 0]], [[1, 0], [0, 0]]];
const PY: Matrix = [[[0, 0], [0, -1]], [[0, 1], [0, 0]]];
const PZ: Matrix = [[[1, 0], [0, 0]], [[0, 0], [-1, 0]]];
const PAULI: Record<Basis, Matrix> = { X: PX, Y: PY, Z: PZ };

function eigen(basis: Basis, sign: number): C[] {
    if (basis === "Z") return sign > 0 ? [[1, 0], [0, 0]] : [[0, 0], [1, 0]];
    const r = Math.SQRT1_2;
    if (basis === "X") return [[r, 0], [sign * r, 0]];
    return [[r, 0], [0, sign * r]];
}

function kronVec(a: C[], b: C[]): C[] {
    const out: C[] = [];
    for (const x of a) for (const y of b) out.push(cMul(x, y));
    return out;
}

function projector(v: C[]): Matrix {
    return [
        [cMul(v[0]!, cConj(v[0]!)), cMul(v[0]!, cConj(v[1]!))],
        [cMul(v[1]!, cConj(v[0]!)), cMul(v[1]!, cConj(v[1]!))],
    ];
}

function shadowFactor(v: C[]): Matrix {
    const p = projector(v);
    return [
        [
            [3 * p[0]![0]![0] - 1, 3 * p[0]![0]![1]],
            [3 * p[0]![1]![0], 3 * p[0]![1]![1]],
        ],
        [
            [3 * p[1]![0]![0], 3 * p[1]![0]![1]],
            [3 * p[1]![1]![0] - 1, 3 * p[1]![1]![1]],
        ],
    ];
}

/** Bell state density matrix (|00> + |11>)(bra)/2. */
function bellState(): Matrix {
    const rho: Matrix = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => [0, 0] as C));
    const h = 0.5;
    rho[0]![0] = [h, 0];
    rho[0]![3] = [h, 0];
    rho[3]![0] = [h, 0];
    rho[3]![3] = [h, 0];
    return rho;
}

/** Born probability of a product outcome under rho. */
function born(rho: Matrix, psi: C[]): number {
    let total = 0;
    for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 4; j += 1) {
            const term = cMul(cMul(cConj(psi[i]!), rho[i]![j]!), psi[j]!);
            total += term[0];
        }
    }
    return Math.max(0, total);
}

function addScaled(acc: Matrix, term: Matrix, scale: number): void {
    for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 4; j += 1) {
            acc[i]![j] = cAdd(acc[i]![j]!, [scale * term[i]![j]![0], scale * term[i]![j]![1]]);
        }
    }
}

function observable(matrix: Matrix, pauli: Matrix): number {
    let total = 0;
    for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 4; j += 1) {
            const term = cMul(pauli[i]![j]!, matrix[j]![i]!);
            total += term[0];
        }
    }
    return total;
}

function expectationVector(matrix: Matrix): number[] {
    return [
        observable(matrix, kron2(I2, I2)),
        observable(matrix, kron2(PX, PX)),
        observable(matrix, kron2(PY, PY)),
        observable(matrix, kron2(PZ, PZ)),
    ];
}

function makeBars(values: number[], active: number): VisualEntity[] {
    return values.map((value, i) => ({
        id: `obs-${LABELS[i]}`,
        type: "bar" as const,
        label: `${LABELS[i]}=${value.toFixed(4)}`,
        value,
        state: i === active ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, pauli: LABELS[i], expectation: value },
    }));
}

function zeroMatrix(): Matrix {
    return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => [0, 0] as C));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    void input;
    const rho = bellState();
    const trueExpectations = expectationVector(rho);
    const basisContributions: Matrix[] = [];

    for (const b0 of BASES) {
        for (const b1 of BASES) {
            const contribution = zeroMatrix();
            for (const s0 of SIGNS) {
                for (const s1 of SIGNS) {
                    const v0 = eigen(b0, s0);
                    const v1 = eigen(b1, s1);
                    const psi = kronVec(v0, v1);
                    const p = born(rho, psi);
                    const estimator = kron2(shadowFactor(v0), shadowFactor(v1));
                    addScaled(contribution, estimator, p);
                }
            }
            basisContributions.push(contribution);
        }
    }

    let sum = zeroMatrix();
    let maxError = 0;

    yield {
        stepNumber: 0,
        entities: makeBars([0, 0, 0, 0], -1),
        edges: [],
        description: "Enumerate all two-qubit Pauli bases and Born outcomes to build the classical shadow estimator of the Bell state.",
        codeLineNumber: 0,
        layout: "array",
        meta: {
            bases: [...BASES],
            basisIndex: -1,
            currentBasis: "",
            expectation: [0, 0, 0, 0],
            trueExpectation: trueExpectations,
            estimate: [],
            maxError: 0,
            done: false,
        },
    };

    for (let index = 0; index < basisContributions.length; index += 1) {
        addScaled(sum, basisContributions[index]!, 1 / basisContributions.length);
        maxError = 0;
        for (let i = 0; i < 4; i += 1) {
            for (let j = 0; j < 4; j += 1) {
                maxError = Math.max(maxError, Math.abs(sum[i]![j]![0] - rho[i]![j]![0]), Math.abs(sum[i]![j]![1] - rho[i]![j]![1]));
            }
        }
        const values = expectationVector(sum);
        yield {
            stepNumber: index + 1,
            entities: makeBars(values, index % 4),
            edges: [],
            description: `Averaged ${index + 1} of ${basisContributions.length} Pauli bases; shadow estimate of ZZ is ${values[3]!.toFixed(4)} and matrix error is ${maxError.toExponential(2)}.`,
            codeLineNumber: index === 0 ? 2 : 4,
            layout: "array",
            meta: {
                bases: [...BASES],
                basisIndex: index,
                currentBasis: `${BASES[Math.floor(index / 3)]}${BASES[index % 3]}`,
                expectation: values,
                trueExpectation: trueExpectations,
                estimate: sum.map((row) => row.map((z) => [z[0], z[1]])),
                maxError,
                done: false,
            },
        };
    }

    yield {
        stepNumber: basisContributions.length + 1,
        entities: makeBars(expectationVector(sum), -1),
        edges: [],
        description: `Classical shadow reconstructs the Bell state exactly; largest matrix entry error ${maxError.toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            bases: [...BASES],
            basisIndex: basisContributions.length - 1,
            currentBasis: "average",
            expectation: expectationVector(sum),
            trueExpectation: trueExpectations,
            estimate: sum.map((row) => row.map((z) => [z[0], z[1]])),
            maxError,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Tomography usually needs many carefully chosen measurements. Classical shadows use a simpler recipe: pick a random Pauli basis for each qubit, measure, and record a small matrix built from the outcome. Averaging these single-shot matrices over the random choices reconstructs the state. For a Bell pair only nine basis pairs are possible, so the whole average can be enumerated exactly.",
        invariants: [
            "Each single-shot estimator is Hermitian because it is a tensor product of terms three times a projector minus the identity.",
            "The Born probabilities over the four outcomes of a fixed basis sum to one.",
            "Averaging the estimators over all bases and outcomes returns the original density matrix.",
        ],
        correctness:
            "For one qubit, averaging three times the measured eigen-projector minus the identity over the three Pauli bases and both outcomes gives the identity map on density matrices; this is the Pauli twirl identity. Tensoring two copies gives the same result for two qubits. The simulation verifies the identity directly by enumerating every basis pair, weighting each estimator by its exact Born probability, and checking that the sum equals the Bell density matrix entry by entry.",
        complexityRationale:
            "There are nine basis pairs and four outcomes each, and every estimator is a four by four matrix, so the exhaustive computation is O(bases * outcomes * dim squared) with small constants. Only one running four by four matrix is stored, giving O(dim squared) space.",
        uses: [
            "Estimating many observables from few randomized measurements",
            "Efficient tomography of quantum processors and simulators",
            "Predicting properties of quantum states without full reconstruction",
        ],
        references: [
            "Huang, Kueng, and Preskill, Predicting Many Properties of a Quantum System from Very Few Measurements, 2020",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 8",
        ],
        workedExample:
            "For the Bell state the exact expectations of XX, YY, and ZZ are plus one, minus one, and plus one. Averaging the shadow estimators over all nine basis pairs reproduces the Bell density matrix and therefore returns those same three values.",
    },
    id: "classical-shadows",
    name: "Classical Shadows (Bell State Simulation)",
    category: "quantum",
    complexity: { time: "O(bases * outcomes * dim^2)", space: "O(dim^2)" },
    defaultInput: {},
    visualType: "array",
    run,
    pseudocode: [
        "prepare the two-qubit Bell density matrix",
        "for each pair of single-qubit Pauli bases",
        "for each pair of measurement outcomes",
        "compute the product outcome state and its Born probability",
        "build the tensor-product single-shot shadow estimator",
        "add the estimator weighted by that probability",
        "divide by the number of basis pairs to average",
        "compare the reconstruction with the true density matrix",
        "done: report the reconstructed observable expectations",
    ],
};

export default module;
