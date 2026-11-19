/**
 * quantum-process-tomography.ts - Process Tomography of a Single-Qubit Channel
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Process tomography reconstructs what a quantum channel does by preparing a
 * complete set of input states and measuring a complete set of observables.
 * Here the unknown channel is a rotation about the y axis followed by
 * depolarizing noise. Preparing the positive eigenstates of X, Y, and Z and
 * measuring X, Y, and Z after the channel fills the three by three Pauli
 * transfer matrix. Applying that matrix to any Bloch vector then predicts the
 * channel output. The model is exact for one qubit and assumes the channel is
 * unital, which holds for rotations and depolarizing noise.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(9) measurements for three inputs and three observables
 *   Space: O(9) for the reconstructed transfer matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid rows are measurement bases X, Y, Z; columns are prepared states.
 *   - The column being probed is yellow; finished columns are green.
 *   - The final frame reports the largest prediction error of the reconstruction.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vec3 = [number, number, number];
const LABELS = ["X", "Y", "Z"];

function channel(v: Vec3, theta: number, noise: number): Vec3 {
    const scale = 1 - noise;
    const x = v[0] * scale;
    const z = v[2] * scale;
    return [Math.cos(theta) * x + Math.sin(theta) * z, v[1] * scale, -Math.sin(theta) * x + Math.cos(theta) * z];
}

function matVec(m: number[], v: Vec3): Vec3 {
    return [
        (m[0] ?? 0) * v[0] + (m[1] ?? 0) * v[1] + (m[2] ?? 0) * v[2],
        (m[3] ?? 0) * v[0] + (m[4] ?? 0) * v[1] + (m[5] ?? 0) * v[2],
        (m[6] ?? 0) * v[0] + (m[7] ?? 0) * v[1] + (m[8] ?? 0) * v[2],
    ];
}

const TEST_VECTORS: Vec3[] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [0.3, -0.5, 0.8],
];

function makeCells(matrix: number[], prepared: number, finished: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
            const value = matrix[r * 3 + c] ?? 0;
            const state: EntityState = finished ? "sorted" : c === prepared ? "comparing" : c < prepared ? "active" : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: value.toFixed(5),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, measure: LABELS[r] ?? "", prepare: LABELS[c] ?? "" },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { theta?: number; noise?: number } | null) ?? {};
    const theta = typeof task.theta === "number" && Number.isFinite(task.theta) ? task.theta : 0.7;
    const noise = typeof task.noise === "number" && Number.isFinite(task.noise)
        ? Math.max(0, Math.min(0.9, task.noise))
        : 0.15;
    const matrix = Array.from({ length: 9 }, () => 0);
    const meta = (prepared: number, done: boolean) => {
        const predictions = TEST_VECTORS.map((v) => matVec(matrix, v));
        const direct = TEST_VECTORS.map((v) => channel(v, theta, noise));
        const maxError = Math.max(...predictions.flatMap((p, i) => p.map((value, j) => Math.abs(value - direct[i]![j]!))));
        const gram = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (let r = 0; r < 3; r += 1) {
            for (let c = 0; c < 3; c += 1) {
                let sum = 0;
                for (let k = 0; k < 3; k += 1) sum += (matrix[k * 3 + r] ?? 0) * (matrix[k * 3 + c] ?? 0);
                gram[r * 3 + c] = sum - (r === c ? 1 : 0);
            }
        }
        return {
            theta,
            noise,
            rows: 3,
            cols: 3,
            matrix: [...matrix],
            testVectors: TEST_VECTORS.map((v) => v.join(",")),
            predictions: predictions.map((p) => p.join(",")),
            direct: direct.map((d) => d.join(",")),
            maxError,
            orthogonalityError: Math.max(...gram.map(Math.abs)),
            prepared,
            done,
        };
    };

    yield {
        stepNumber: 0,
        entities: makeCells(matrix, -1, false),
        edges: [],
        description: `Tomographing a y rotation of ${theta.toFixed(3)} with depolarizing noise ${noise.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(-1, false),
    };

    let step = 1;
    for (let c = 0; c < 3; c += 1) {
        const prepared: Vec3 = [c === 0 ? 1 : 0, c === 1 ? 1 : 0, c === 2 ? 1 : 0];
        const output = channel(prepared, theta, noise);
        for (let r = 0; r < 3; r += 1) matrix[r * 3 + c] = output[r] ?? 0;
        yield {
            stepNumber: step,
            entities: makeCells(matrix, c, false),
            edges: [],
            description: `Prepared the ${LABELS[c]} eigenstate and measured X, Y, Z after the channel to fill column ${LABELS[c]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta(c, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(matrix, -1, true),
        edges: [],
        description: `Reconstructed matrix predicts all test states with maximum error ${meta(3, true).maxError.toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: meta(3, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A quantum channel is like a black box that transforms states. Probe it with three known input states that point along X, Y, and Z, and after each probe measure along all three axes. The nine numbers you collect form a matrix that tells you how the box moves any Bloch vector, which is enough to predict its behavior on a state you never prepared.",
        invariants: [
            "The prepared states are the positive eigenstates of X, Y, and Z, forming a basis for Bloch vectors.",
            "Each measured expectation equals the corresponding entry of the Pauli transfer matrix for a unital channel.",
            "With zero noise the reconstructed matrix is an orthogonal rotation with determinant one.",
        ],
        correctness:
            "A unital qubit channel sends the identity to itself and acts linearly on the traceless Pauli components. Writing E(P_j) as the sum over i of R_ij P_i, the expectation of P_i on the output of the positive P_j eigenstate is exactly R_ij because the identity contribution has zero trace with P_i. Measuring all nine pairs therefore determines R. Since channel action on any Bloch vector is linear, applying R to that vector predicts the output; comparing with direct simulation verifies the reconstruction. For a pure rotation R transposed times R is the identity.",
        complexityRationale:
            "Three preparations times three observables give nine measurements, each a constant amount of work, so time is O(9). The transfer matrix and small result record use O(9) space. General d-dimensional process tomography needs O(d squared) preparations and measurements.",
        uses: [
            "Characterizing gates and noise on quantum processors",
            "Verifying that a compiled circuit implements the intended channel",
            "Benchmarking before and after error mitigation",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, chapter on quantum process tomography",
            "Chuang and Nielsen, Prescriptive Quantum Process Tomography, 1997",
        ],
        workedExample:
            "For a rotation by 0.7 radians with noise 0.1 the channel scales every Bloch vector by 0.9 and turns it. Preparing X gives output (0.9 cos 0.7, 0, -0.9 sin 0.7), so the first matrix column is filled with those three numbers. Repeating for Y and Z completes the matrix, and applying it to (0.3, -0.5, 0.8) reproduces the directly simulated output exactly.",
    },
    id: "quantum-process-tomography",
    name: "Quantum Process Tomography",
    category: "quantum",
    complexity: { time: "O(9)", space: "O(9)" },
    defaultInput: { theta: 0.7, noise: 0.15 },
    visualType: "grid",
    run,
    pseudocode: [
        "list the X, Y, and Z eigenstates as known inputs",
        "for each input prepare the state and send it through the channel",
        "measure the X, Y, and Z expectations on the output",
        "place each expectation in the corresponding matrix row and column",
        "after all inputs the nine entries form the transfer matrix",
        "apply the matrix to test vectors and compare with direct simulation",
        "done: report the reconstruction error and orthogonality",
    ],
};

export default module;
