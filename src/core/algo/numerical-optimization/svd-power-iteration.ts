/**
 * svd-power-iteration.ts - Power Iteration for the Dominant Singular Value
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The largest singular value of a matrix A is the square root of the largest
 * eigenvalue of A transpose times A. Power iteration repeatedly multiplies a
 * vector by that symmetric positive semidefinite matrix and renormalizes. The
 * vector converges to the dominant right singular vector and the Rayleigh
 * quotient converges to the square of the dominant singular value.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^2) for an n by n matrix
 *   Space: O(n^2) to hold A transpose times A and O(n) for the vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current right singular vector components.
 *   - Bars turn yellow while the vector is being updated and green at the end.
 *   - Frame metadata reports the singular value and eigenvalue residual.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Compute A transpose times A for a square matrix. */
function normalMatrix(matrix: number[][]): number[][] {
    const n = matrix.length;
    const result = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let sum = 0;
            for (let k = 0; k < n; k += 1) {
                sum += (matrix[k]?.[i] ?? 0) * (matrix[k]?.[j] ?? 0);
            }
            result[i] = result[i] ?? new Array<number>(n).fill(0);
            result[i]![j] = sum;
        }
    }
    return result;
}

/** Multiply a square matrix by a vector. */
function multiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, value, j) => sum + value * (vector[j] ?? 0), 0));
}

/** Euclidean norm of a vector. */
function norm(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

/** Scale a vector to unit length, guarding against a zero norm. */
function normalize(vector: number[]): number[] {
    const length = norm(vector);
    if (length === 0) {
        return vector.map(() => 0);
    }
    return vector.map((value) => value / length);
}

/** Build bars for the iterate vector. */
function makeBars(vector: number[], state: EntityState): VisualEntity[] {
    return vector.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, component: index },
    }));
}

/** The SVD power iteration generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number[][]; iterations?: number } | null) ?? {};
    const matrix = Array.isArray(task.a) ? task.a.map((row) => [...row]) : [[3, 1], [1, 2]];
    const iterations = typeof task.iterations === "number"
        ? Math.max(1, Math.floor(task.iterations))
        : 30;
    const n = matrix.length;
    const ata = normalMatrix(matrix);
    let vector = normalize(new Array<number>(n).fill(1));
    let singularValue = 0;
    let eigenvalueResidual = 0;
    let frame = 0;

    yield {
        stepNumber: frame,
        entities: makeBars(vector, "unvisited"),
        edges: [],
        description: `Finding the dominant singular value of an ${n} by ${n} matrix by power iteration.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { vector: [...vector], singularValue: 0, eigenvalueResidual: 0, iteration: 0 },
    };
    frame += 1;

    let used = 0;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const next = normalize(multiply(ata, vector));
        if (next.every((value) => value === 0)) {
            break;
        }
        vector = next;
        const image = multiply(ata, vector);
        const lambda = vector.reduce((sum, value, i) => sum + value * (image[i] ?? 0), 0);
        singularValue = Math.sqrt(Math.max(0, lambda));
        eigenvalueResidual = Math.max(...image.map((value, i) => Math.abs(value - lambda * (vector[i] ?? 0))));
        used = iteration + 1;
        yield {
            stepNumber: frame,
            entities: makeBars(vector, "comparing"),
            edges: [],
            description: `Iteration ${used}: the Rayleigh quotient gives singular value ${singularValue.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                vector: [...vector],
                singularValue,
                eigenvalueResidual,
                iteration: used,
            },
        };
        frame += 1;
        if (eigenvalueResidual < 1e-14) {
            break;
        }
    }

    yield {
        stepNumber: frame,
        entities: makeBars(vector, "sorted"),
        edges: [],
        description: `Dominant singular value ${singularValue.toFixed(6)} after ${used} iteration(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { vector: [...vector], singularValue, eigenvalueResidual, iteration: used },
    };
}

/** The SVD power iteration module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Repeated multiplication by a matrix stretches a vector most along its dominant direction. Because A transpose times A is symmetric and positive, that direction is the leading right singular vector, and the stretch factor is its squared singular value. Renormalizing after each multiplication keeps the numbers well behaved.",
        invariants: [
            "The iterate is rescaled to unit length after every multiplication.",
            "A transpose times A is symmetric positive semidefinite, so its eigenvalues are nonnegative.",
            "The Rayleigh quotient converges to the largest eigenvalue from below.",
        ],
        correctness:
            "Expand the start vector in the orthonormal eigenbasis of A transpose times A. Each multiplication scales the i-th component by eigenvalue i to the power k. After normalization the component with the largest eigenvalue dominates, so the vector tends to the leading eigenvector and the Rayleigh quotient tends to its eigenvalue. Taking the square root gives the largest singular value of A.",
        complexityRationale:
            "Multiplying an n by n matrix by a vector costs O(n^2), and the iteration repeats k times, so O(k n^2) time. Forming and storing A transpose times A uses O(n^2) space plus O(n) for the iterate.",
        uses: [
            "Truncated singular value decomposition for small matrices",
            "Principal component analysis via the covariance matrix",
            "Rank and spectral-norm estimation",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, Chapter 8",
            "Power, On Systems of Linear Equations with Coefficients having a Dominant Diagonal, 1951",
        ],
        workedExample:
            "For A = [[3,1],[1,2]], A transpose times A is [[10,5],[5,5]]. Its largest eigenvalue is about 13.09, so the dominant singular value is about 3.619 and the leading right singular vector is close to (0.851, 0.526).",
    },
    id: "svd-power-iteration",
    name: "SVD Power Iteration",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^2)", space: "O(n^2)" },
    defaultInput: { a: [[3, 1], [1, 2]], iterations: 30 },
    visualType: "array",
    run,
    pseudocode: [
        "form the matrix A transpose times A",
        "start the vector at equal components and normalize",
        "repeat for a fixed number of iterations",
        "multiply the matrix by the current vector",
        "normalize the result to unit length",
        "compute the Rayleigh quotient and take its square root",
        "stop when the eigenvalue residual is tiny",
        "done: report the dominant singular value and vector",
    ],
};

export default module;
