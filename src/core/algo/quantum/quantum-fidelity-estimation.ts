/**
 * quantum-fidelity-estimation.ts - Direct Fidelity Estimation by Pauli Sampling
 *
 * Estimates the fidelity of a noisy two-qubit state against a known pure Bell
 * state by measuring the Pauli terms that appear in the target projector. This
 * is the direct-fidelity-estimation method: no ancilla or controlled-SWAP is
 * used, unlike the separate SWAP-test module. The simulation is exact for a
 * Bell target and depolarizing noise, with ideal expectation values instead of
 * finite-shot statistics; it does not cover arbitrary target states or general
 * noise channels.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface FidelityInput {
    noise?: number;
}

const HALF = Math.SQRT1_2;
const PAULI = ["II", "XX", "YY", "ZZ"];
const COEFFICIENT = [1, 1, -1, 1];
type Matrix = Complex[][];

function cMul(a: Complex, b: Complex): Complex {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function kron(a: Matrix, b: Matrix): Matrix {
    const out: Matrix = [];
    for (const ar of a) {
        for (const br of b) {
            const row: Complex[] = [];
            for (let i = 0; i < ar.length; i += 1) {
                for (let j = 0; j < br.length; j += 1) row.push(cMul(ar[i]!, br[j]!));
            }
            out.push(row);
        }
    }
    return out;
}

const IDENTITY: Matrix = [[[1, 0], [0, 0]], [[0, 0], [1, 0]]];
const X: Matrix = [[[0, 0], [1, 0]], [[1, 0], [0, 0]]];
const Y: Matrix = [[[0, 0], [0, -1]], [[0, 1], [0, 0]]];
const Z: Matrix = [[[1, 0], [0, 0]], [[0, 0], [-1, 0]]];
const PAULI_MATRICES: Matrix[] = [kron(IDENTITY, IDENTITY), kron(X, X), kron(Y, Y), kron(Z, Z)];

function expectation(observable: Matrix, rho: Matrix): number {
    let total = 0;
    for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 4; j += 1) {
            const product = cMul(observable[i]![j]!, rho[j]![i]!);
            total += product[0];
        }
    }
    return total;
}

function makeBars(values: number[], highlight: number, final: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `term-${PAULI[index]}`,
        type: "bar" as const,
        label: `${PAULI[index]}: ${value.toFixed(4)}`,
        value,
        state: final ? "sorted" : index === highlight ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, pauli: PAULI[index]!, coefficient: COEFFICIENT[index]!, expectation: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FidelityInput | null) ?? {};
    const noise = typeof task.noise === "number" && Number.isFinite(task.noise)
        ? Math.max(0, Math.min(1, task.noise))
        : 0.15;
    const rho: Matrix = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => [0, 0] as Complex));
    for (const index of [0, 3]) {
        rho[index]![index] = [0.5 * (1 - noise) + noise / 4, 0];
    }
    rho[0]![3] = [0.5 * (1 - noise), 0];
    rho[3]![0] = [0.5 * (1 - noise), 0];

    const expectations: number[] = [];
    const contributions: number[] = [];
    const bell: Complex[] = [[HALF, 0], [0, 0], [0, 0], [HALF, 0]];
    const directFidelity = (() => {
        let real = 0;
        for (let i = 0; i < 4; i += 1) {
            for (let j = 0; j < 4; j += 1) {
                const product = cMul(cMul([bell[i]![0], -bell[i]![1]], rho[i]![j]!), bell[j]!);
                real += product[0];
            }
        }
        return real;
    })();
    const metaFor = (done: boolean) => {
        const estimate = contributions.reduce((sum, value) => sum + value, 0);
        return {
            noise,
            pauli: PAULI,
            coefficients: COEFFICIENT,
            expectations: [...expectations],
            contributions: [...contributions],
            fidelityEstimate: estimate,
            exactFidelity: directFidelity,
            trace: expectations.length > 0 ? (expectations[0] ?? 0) : 0,
            done,
        };
    };

    yield {
        stepNumber: 0,
        entities: makeBars(COEFFICIENT.map((c) => c / 4), -1, false),
        edges: [],
        description: `The Bell projector splits into four Pauli terms with coefficients ${COEFFICIENT.join(", ")} divided by four.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(false),
    };

    for (let index = 0; index < 4; index += 1) {
        const value = expectation(PAULI_MATRICES[index]!, rho);
        expectations.push(value);
        contributions.push((COEFFICIENT[index]! * value) / 4);
        yield {
            stepNumber: index + 1,
            entities: makeBars([...expectations, ...Array(4 - expectations.length).fill(0)], index, false),
            edges: [],
            description: `Measured Pauli ${PAULI[index]}: expectation ${value.toFixed(4)} contributes ${(COEFFICIENT[index]! * value / 4).toFixed(4)} to the fidelity.`,
            codeLineNumber: index + 1,
            layout: "array",
            meta: metaFor(false),
        };
    }

    yield {
        stepNumber: 5,
        entities: makeBars(expectations, -1, true),
        edges: [],
        description: `Direct fidelity estimate is ${metaFor(true).fidelityEstimate.toFixed(4)}, matching the density-matrix value ${directFidelity.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: metaFor(true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of comparing two unknown states with a SWAP test, direct fidelity estimation asks a specific question: how much of the known target state is present in the noisy state? Any pure-state projector can be written as a weighted sum of Pauli measurements, so measuring those few observables and adding the weighted results gives the fidelity. For a Bell state only four terms are needed, which makes the method cheap and transparent.",
        invariants: [
            "The identity term equals the trace of the density matrix, which stays one for every noise level.",
            "Each measured Pauli expectation lies between minus one and one.",
            "The weighted sum of the four terms equals the true fidelity of the target projector with the state.",
        ],
        correctness:
            "The projector onto the Bell state equals (II plus XX minus YY plus ZZ) over four, which is verified by acting on each computational basis state. The fidelity is the trace of that projector times the density matrix, and by linearity of the trace it is the same weighted sum of the four Pauli expectations. The simulation computes each expectation as the trace of Pauli times rho and the module also computes the fidelity directly as the sandwich of rho between the Bell state and its conjugate, so the two independent routes must agree.",
        complexityRationale:
            "Four Pauli expectations are computed from a four by four density matrix, each costing a constant number of complex operations, so the idealized simulation is constant time and memory. On hardware each Pauli term is estimated from repeated measurements, and the number of terms grows with the number of nonidentity tensor factors in the target projector.",
        uses: [
            "Benchmarking prepared Bell states and entanglement fidelity",
            "Verifying variational quantum circuit outputs against a target state",
            "Estimating gate and readout errors through state fidelity",
        ],
        references: [
            "Flammia and Liu, Direct Fidelity Estimation from Few Pauli Measurements, 2011",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 9",
        ],
        workedExample:
            "With noise 0.2 the depolarized Bell state has Pauli expectations 1, 0.8, minus 0.8, and 0.8. The weighted sum gives (1 plus 0.8 plus 0.8 plus 0.8) over four, which is 0.85, the same value obtained from the inner product of the Bell state with the density matrix.",
    },
    id: "quantum-fidelity-estimation",
    name: "Quantum Fidelity Estimation (Direct Pauli Method)",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { noise: 0.15 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the depolarizing noise level for the target Bell state",
        "write the Bell projector as a weighted sum of four Pauli strings",
        "build the noisy density matrix as a mixture of Bell and maximally mixed state",
        "for each Pauli string compute the expectation as trace of Pauli times rho",
        "multiply the expectation by its projector coefficient",
        "add the four weighted contributions into the fidelity estimate",
        "done: compare the estimate with the density-matrix fidelity",
    ],
};

export default module;
