/**
 * quantum-linear-regression.ts - Quantum Linear Regression (Small Spectral Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quantum linear regression fits a straight line by encoding the least-squares
 * normal equations into a two by two symmetric Gram matrix, decomposing that
 * matrix into eigenvalues and eigenvectors, scaling each component of the
 * target by the inverse eigenvalue (the spectral core of a quantum linear
 * solver), and reconstructing the fitted coefficients. Predictions follow from
 * the fitted line.
 *
 * This is an exact small spectral simulation. It computes the real linear
 * algebra that a fault-tolerant quantum linear solver would encode in
 * amplitudes; it does not model phase estimation, ancilla registers, or
 * measurement sampling. The model is limited to two regression coefficients
 * and any number of input points.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) to assemble the normal equations plus O(1) for the spectral fit
 *   Space: O(n) for the data and predictions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the data, Gram entries, eigenvalues, inverse eigenvalues, and
 *     fitted coefficients in successive phases.
 *   - The phase currently being computed is highlighted yellow.
 *   - meta carries all intermediate spectra and the final fitted line.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RegressionInput {
    x?: number[];
    y?: number[];
}

type Vec2 = [number, number];

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        const state: EntityState = done ? "sorted" : index === active ? "active" : "idle";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RegressionInput | null) ?? {};
    const x: number[] = Array.isArray(task.x) && task.x.length > 0
        ? task.x.map((value) => Number(value) || 0)
        : [0, 1, 2, 3, 4];
    const y: number[] = Array.isArray(task.y) && task.y.length === x.length
        ? task.y.map((value) => Number(value) || 0)
        : [1, 3, 5, 7, 9];
    const n = Math.min(x.length, 32);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(y.slice(0, n), -1, false),
        edges: [],
        description: `Loaded ${n} observations for a two-coefficient linear fit.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, x: x.slice(0, n), y: y.slice(0, n), gram: [], eigenvalues: [], inverses: [], projections: [], weights: [], predictions: [], done: false },
    };
    step += 1;

    // Assemble the normal equations: G = A^T A and c = A^T y for A = [1, x].
    let g00 = 0;
    let g01 = 0;
    let g11 = 0;
    let c0 = 0;
    let c1 = 0;
    for (let index = 0; index < n; index += 1) {
        const xi = x[index] ?? 0;
        const yi = y[index] ?? 0;
        g00 += 1;
        g01 += xi;
        g11 += xi * xi;
        c0 += yi;
        c1 += xi * yi;
    }
    const gram = [g00, g01, g01, g11];
    const c: Vec2 = [c0, c1];
    yield {
        stepNumber: step,
        entities: makeBars(gram, -1, false),
        edges: [],
        description: `Normal equations: Gram matrix [[${g00}, ${g01}], [${g01}, ${g11}]], target [${c0}, ${c1}].`,
        codeLineNumber: 2,
        layout: "array",
        meta: { n, x: x.slice(0, n), y: y.slice(0, n), gram, c, eigenvalues: [], inverses: [], projections: [], weights: [], predictions: [], done: false },
    };
    step += 1;

    // Exact symmetric eigendecomposition via a Jacobi rotation angle.
    const theta = 0.5 * Math.atan2(2 * g01, g00 - g11);
    const v1: Vec2 = [Math.cos(theta), Math.sin(theta)];
    const v2: Vec2 = [-Math.sin(theta), Math.cos(theta)];
    const rayleigh = (v: Vec2) =>
        g00 * v[0] * v[0] + 2 * g01 * v[0] * v[1] + g11 * v[1] * v[1];
    const lambda1 = rayleigh(v1);
    const lambda2 = rayleigh(v2);
    const eigenvalues = [lambda1, lambda2];
    yield {
        stepNumber: step,
        entities: makeBars(eigenvalues, -1, false),
        edges: [],
        description: `Eigenvalues of the Gram matrix are ${lambda1.toFixed(4)} and ${lambda2.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, x: x.slice(0, n), y: y.slice(0, n), gram, c, eigenvalues, eigenvectors: [v1, v2], inverses: [], projections: [], weights: [], predictions: [], done: false },
    };
    step += 1;

    const inverses = eigenvalues.map((lambda) => (Math.abs(lambda) > 1e-12 ? 1 / lambda : 0));
    yield {
        stepNumber: step,
        entities: makeBars(inverses, -1, false),
        edges: [],
        description: `Inverse eigenvalues used by the spectral rotation: ${inverses.map((value) => value.toFixed(4)).join(", ")}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, x: x.slice(0, n), y: y.slice(0, n), gram, c, eigenvalues, inverses, projections: [], weights: [], predictions: [], done: false },
    };
    step += 1;

    const beta: Vec2 = [
        c[0] * v1[0] + c[1] * v1[1],
        c[0] * v2[0] + c[1] * v2[1],
    ];
    const projections = [beta[0] * inverses[0], beta[1] * inverses[1]];
    yield {
        stepNumber: step,
        entities: makeBars(projections, -1, false),
        edges: [],
        description: `Projected target onto each eigenvector and applied the inverse eigenvalue scaling.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, x: x.slice(0, n), y: y.slice(0, n), gram, c, eigenvalues, inverses, projections: [beta[0], beta[1]], scaled: projections, weights: [], predictions: [], done: false },
    };
    step += 1;

    const weights: Vec2 = [
        projections[0] * v1[0] + projections[1] * v2[0],
        projections[0] * v1[1] + projections[1] * v2[1],
    ];
    yield {
        stepNumber: step,
        entities: makeBars([weights[0], weights[1]], -1, false),
        edges: [],
        description: `Fitted coefficients: intercept ${weights[0].toFixed(6)}, slope ${weights[1].toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, x: x.slice(0, n), y: y.slice(0, n), gram, c, eigenvalues, inverses, projections: [beta[0], beta[1]], weights: [weights[0], weights[1]], predictions: [], done: false },
    };
    step += 1;

    const predictions = Array.from({ length: n }, (_, index) => weights[0] + weights[1] * (x[index] ?? 0));
    let residual = 0;
    for (let index = 0; index < n; index += 1) {
        residual += ((y[index] ?? 0) - (predictions[index] ?? 0)) ** 2;
    }
    yield {
        stepNumber: step,
        entities: makeBars(predictions, -1, true),
        edges: [],
        description: `Predictions match the observations with residual sum of squares ${residual.toExponential(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, x: x.slice(0, n), y: y.slice(0, n), gram, c, eigenvalues, inverses, projections: [beta[0], beta[1]], weights: [weights[0], weights[1]], predictions, residual, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Fitting a line means solving two normal equations. A quantum linear solver would encode those equations as a matrix and amplify the components of the answer through that matrix's eigenvalues. This small model performs exactly that spectral step: rotate the target into the eigenvector basis, divide each piece by its eigenvalue, and rotate back to recover the intercept and slope.",
        invariants: [
            "The Gram matrix is symmetric and positive semidefinite, so its eigenvalues are nonnegative.",
            "The eigenvectors form an orthonormal basis of the two-dimensional coefficient space.",
            "Reconstructing from the scaled eigencomponents solves the normal equations exactly.",
        ],
        correctness:
            "Because the Gram matrix is real symmetric, the Jacobi rotation angle diagonalizes it exactly, giving orthonormal eigenvectors and eigenvalues whose product is the determinant. Expanding the right-hand side in that basis and multiplying each component by the inverse eigenvalue produces the unique solution of the nonsingular normal equations; rotating back yields the least-squares coefficients. The fitted values then minimize the residual sum of squares by the standard normal-equations argument.",
        complexityRationale:
            "Assembling the normal equations scans the n observations once, which is O(n). The two by two eigendecomposition and reconstruction are constant time, and forming predictions is O(n) time and space.",
        uses: [
            "Teaching the bridge between classical least squares and quantum linear solvers",
            "Small-data regression demonstrations on quantum emulators",
            "A subroutine sketch inside quantum machine-learning pipelines",
        ],
        references: [
            "Harrow, Hassidim and Lloyd, Quantum Algorithm for Linear Systems of Equations, 2009",
            "Wang, Quantum Linear Regression Algorithm, 2017",
        ],
        workedExample:
            "For points (0,1), (1,3), (2,5), (3,7), (4,9) the Gram matrix is [[5,10],[10,30]] and the target is [25,75]. Its eigenvectors and eigenvalues split the target, the inverse-eigenvalue rotation reconstructs the coefficients intercept 1 and slope 2, and every prediction equals its observation with zero residual.",
    },
    id: "quantum-linear-regression",
    name: "Quantum Linear Regression",
    category: "quantum",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        x: [0, 1, 2, 3, 4],
        y: [1, 3, 5, 7, 9],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the observations and form the design matrix",
        "assemble the normal equations G equals A transpose A and c equals A transpose y",
        "diagonalize the symmetric two by two Gram matrix",
        "project c onto each eigenvector",
        "scale each projection by the inverse of its eigenvalue",
        "rotate the scaled components back to coefficient space",
        "predict the response at each input and report the fit",
    ],
};

export default module;
