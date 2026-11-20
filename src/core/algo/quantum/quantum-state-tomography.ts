/**
 * quantum-state-tomography.ts - Single-Qubit State Tomography by Pauli Measurements
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A single-qubit state is fully described by its Bloch vector (rx, ry, rz).
 * Measuring the Pauli observables X, Y, and Z gives those three components
 * exactly in expectation, and the density matrix is then reconstructed as
 * rho = (I + rx X + ry Y + rz Z) / 2.
 *
 * This is an exact small simulation that uses ideal expectation values instead
 * of finite-shot sampling. It is limited to one qubit, three Pauli bases, and
 * no measurement or state-preparation error; real tomography estimates the
 * same quantities from many noisy shots and then fits a physical density
 * matrix.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for three observables on one qubit
 *   Space: O(1) for the three Bloch components and four matrix entries
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the measured expectation of X, Y, and Z.
 *   - The bar for the current measurement basis is highlighted.
 *   - The final frame is green and carries the reconstructed density matrix.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TomographyInput {
    rx?: number;
    ry?: number;
    rz?: number;
}

const NAMES = ["X", "Y", "Z"];

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${NAMES[index] ?? "?"} expectation ${value.toFixed(4)}`,
        value,
        state: done ? "sorted" : index === active ? "comparing" : "idle",
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, observable: NAMES[index] ?? "?", expectation: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TomographyInput | null) ?? {};
    let rx = Number(task.rx ?? 0);
    let ry = Number(task.ry ?? 0);
    let rz = Number(task.rz ?? 0);
    const rawRadius = Math.hypot(rx, ry, rz);
    if (rawRadius > 1) {
        rx /= rawRadius;
        ry /= rawRadius;
        rz /= rawRadius;
    }
    const radius = Math.hypot(rx, ry, rz);
    const measurements = [rx, ry, rz];
    const density = [
        [(1 + rz) / 2, 0] as [number, number],
        [rx / 2, -ry / 2] as [number, number],
        [rx / 2, ry / 2] as [number, number],
        [(1 - rz) / 2, 0] as [number, number],
    ];
    const trace = density[0]![0] + density[3]![0];
    const purity = (1 + rx * rx + ry * ry + rz * rz) / 2;
    const minEigenvalue = (1 - radius) / 2;

    yield {
        stepNumber: 0,
        entities: makeBars([0, 0, 0], -1, false),
        edges: [],
        description: `Preparing a qubit with Bloch vector (${rx.toFixed(3)}, ${ry.toFixed(3)}, ${rz.toFixed(3)}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rx, ry, rz, estimates: [0, 0, 0], density: [], trace: 0, purity: 0 },
    };

    for (let basis = 0; basis < 3; basis += 1) {
        const estimates = measurements.map((value, index) => (index <= basis ? value : 0));
        yield {
            stepNumber: basis + 1,
            entities: makeBars(estimates, basis, false),
            edges: [],
            description: `Measuring the ${NAMES[basis]} observable gives expectation ${measurements[basis]!.toFixed(4)}.`,
            codeLineNumber: basis + 1,
            layout: "array",
            meta: { rx, ry, rz, estimates, density: [], trace: 0, purity: 0, basis: NAMES[basis] },
        };
    }

    yield {
        stepNumber: 4,
        entities: makeBars(measurements, -1, true),
        edges: [],
        description: `Reconstructed density matrix has trace ${trace.toFixed(4)}, purity ${purity.toFixed(4)}, and minimum eigenvalue ${minEigenvalue.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            rx,
            ry,
            rz,
            estimates: measurements,
            density: density.flatMap((z) => [z[0], z[1]]),
            trace,
            purity,
            minEigenvalue,
            physical: minEigenvalue >= -1e-12,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A qubit is described by three numbers that say how strongly it leans along each of the X, Y, and Z axes. Measuring each Pauli observable in turn reads out one of those numbers. Once all three are known, the density matrix is a simple linear combination of the identity and the three Pauli matrices.",
        invariants: [
            "The expectation of a Pauli observable equals the matching Bloch component.",
            "The reconstructed density matrix has trace one.",
            "A physical state has a Bloch vector of length at most one, so both eigenvalues are nonnegative.",
        ],
        correctness:
            "Any single-qubit density matrix can be written as half the identity plus half the dot product of its Bloch vector with the Pauli vector. This follows because the identity and the three Pauli matrices form an orthogonal basis for two-by-two Hermitian matrices under the Hilbert-Schmidt inner product. Taking the trace with each Pauli picks out its coefficient, so measuring X, Y, and Z recovers exactly the coefficients used in the reconstruction.",
        complexityRationale:
            "Only three observables are measured and each reconstruction entry is one arithmetic expression, giving constant time and constant space. Tomography on n qubits would need three to the n settings and is exponential.",
        uses: [
            "Verifying the output state of a quantum processor",
            "Characterizing noise in a qubit calibration routine",
            "A teaching example of linear inversion estimation",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 8",
            "Paris and Rehacek, Quantum State Estimation, 2004",
        ],
        workedExample:
            "For the state with Bloch vector (0, 1, 0), the measurements are zero for X, one for Y, and zero for Z. The reconstruction gives rho entries (0.5, 0), (0, -0.5i), (0, 0.5i), (0.5, 0), which is the plus-i eigenstate of Y.",
    },
    id: "quantum-state-tomography",
    name: "Quantum State Tomography",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { rx: 0, ry: 0.6, rz: 0.8 },
    visualType: "array",
    run,
    pseudocode: [
        "clamp the Bloch vector to the unit ball",
        "measure the X observable to estimate rx",
        "measure the Y observable to estimate ry",
        "measure the Z observable to estimate rz",
        "form rho as half of identity plus half of r dot Pauli",
        "check trace, purity, and positivity",
        "done: report the reconstructed density matrix",
    ],
};

export default module;
