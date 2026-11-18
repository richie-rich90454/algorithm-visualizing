/**
 * eigenvalue-power-iteration.ts - Power Iteration for the Dominant Eigenvalue
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Power iteration finds the eigenvalue of largest magnitude and its
 * eigenvector by repeatedly multiplying a vector by the matrix and rescaling.
 * The component of the vector along the dominant eigenvector is multiplied by
 * the dominant eigenvalue each time, so it comes to dominate all other
 * components. A Rayleigh quotient turns the vector into an eigenvalue estimate.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^2) for a dense matrix-vector product
 *   Space: O(n) for the iterate vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current eigenvector estimate is shown as bars.
 *   - Bars are yellow while iterating and green at convergence.
 *   - The metadata reports the eigenvalue estimate and residual norm.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Multiply a square matrix by a vector. */
function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0));
}

function dot(left: number[], right: number[]): number {
    return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function normalize(vector: number[]): number[] {
    const norm = Math.sqrt(dot(vector, vector));
    return norm > 0 ? vector.map((value) => value / norm) : [...vector];
}

function makeBars(vector: number[], state: EntityState): VisualEntity[] {
    return vector.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** The power iteration generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { A?: number[][]; iterations?: number; tolerance?: number } | null) ?? {};
    const A: number[][] =
        Array.isArray(task.A) && task.A.length > 0
            ? task.A.map((row) => (Array.isArray(row) ? [...row] : []))
            : [
                  [2, 1],
                  [1, 2],
              ];
    const n = A.length;
    const iterations =
        typeof task.iterations === "number" && task.iterations >= 1
            ? Math.floor(task.iterations)
            : 50;
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-10;

    let v = normalize(Array.from({ length: n }, (_, index) => index + 1));
    const initialAv = matVec(A, v);
    const initialLambda = dot(v, initialAv) / dot(v, v);
    let eigenvalue = initialLambda;
    let residual = Math.sqrt(
        initialAv.reduce((sum, value, index) => sum + (value - initialLambda * (v[index] ?? 0)) ** 2, 0),
    );
    let converged = false;
    let used = 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(v, "idle"),
        edges: [],
        description: `Estimating the dominant eigenvalue of a ${n} by ${n} matrix by power iteration.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, eigenvalue, residual, vector: [...v], converged: false },
    };
    step += 1;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const w = matVec(A, v);
        const newEigenvalue = dot(v, w) / dot(v, v);
        const newV = normalize(w);
        const Av = matVec(A, newV);
        residual = Math.sqrt(
            Av.reduce((sum, value, index) => sum + (value - newEigenvalue * (newV[index] ?? 0)) ** 2, 0),
        );
        v = newV;
        eigenvalue = newEigenvalue;
        used = iteration + 1;
        converged = residual < tolerance;
        yield {
            stepNumber: step,
            entities: makeBars(v, converged ? "sorted" : "comparing"),
            edges: [],
            description: `Iteration ${used}: eigenvalue estimate ${eigenvalue.toFixed(6)}, residual ${residual.toExponential(2)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { iteration: used, eigenvalue, residual, vector: [...v], converged },
        };
        step += 1;
        if (converged) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(v, "sorted"),
        edges: [],
        description:
            `Dominant eigenvalue approximated as ${eigenvalue.toFixed(8)} after ${used} iteration(s) with residual ${residual.toExponential(2)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { iteration: used, eigenvalue, residual, vector: [...v], converged },
    };
}

/** The power iteration module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Write any starting vector as a mixture of the matrix eigenvectors. Each multiplication by the matrix scales each component by its eigenvalue, so the component belonging to the largest eigenvalue grows fastest relative to the others. After a few multiplications the vector points almost entirely along that dominant eigenvector.",
        invariants: [
            "The iterate is renormalized to unit length after each multiplication.",
            "The Rayleigh quotient v dot A v over v dot v estimates the eigenvalue.",
            "When there is a unique dominant eigenvalue, the residual tends to zero.",
        ],
        correctness:
            "If the eigenvectors form a basis and the dominant eigenvalue is strictly larger in magnitude than the others, the ratio of every other component to the dominant one shrinks by a factor below one each iteration. The vector therefore converges to the dominant eigendirection, and its Rayleigh quotient converges to the corresponding eigenvalue with the residual going to zero.",
        complexityRationale:
            "Each iteration is one matrix-vector product at O(n^2) for a dense matrix plus O(n) vector arithmetic. Only a constant number of length-n vectors are stored, so space is O(n).",
        uses: [
            "Finding the largest eigenvalue in structural dynamics",
            "Ranking nodes with eigenvector centrality",
            "The leading component of spectral analysis methods",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, Chapter 7",
            "Saad, Iterative Methods for Sparse Linear Systems, Chapter 4",
        ],
        workedExample:
            "For A = [[2,1],[1,2]] the eigenvalues are 3 and 1. Starting from (1,1) the vector is already an eigenvector, so the Rayleigh quotient is exactly 3 after the first iteration and the residual is zero.",
    },
    id: "eigenvalue-power-iteration",
    name: "Power Iteration",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^2)", space: "O(n)" },
    defaultInput: {
        A: [
            [2, 1],
            [1, 2],
        ],
        iterations: 50,
        tolerance: 1e-10,
    },
    visualType: "array",
    run,
    pseudocode: [
        "choose a starting vector and scale it to unit length",
        "for each allowed iteration",
        "multiply the matrix by the current vector",
        "estimate the eigenvalue with the Rayleigh quotient",
        "rescale the product to unit length",
        "compute the residual norm of the eigenpair",
        "stop when the residual is below tolerance",
        "done: report the dominant eigenvalue and vector",
    ],
};

export default module;
