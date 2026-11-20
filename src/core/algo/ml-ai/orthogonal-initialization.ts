/**
 * orthogonal-initialization.ts - Orthogonal Weight Initialization
 *
 * Orthogonal initialization draws a weight matrix whose rows or columns are
 * mutually orthonormal. Such a matrix preserves the length of a signal passing
 * through a linear layer, which helps gradients flow in very deep networks.
 * The demo builds the matrix with Gram-Schmidt orthogonalization from a
 * deterministic seed so the result is reproducible and verifiable.
 *
 * Time:  O(rows * cols^2) for a rows by cols matrix
 * Space: O(rows * cols) for the matrix
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface OrthoInput {
    rows?: number;
    cols?: number;
    gain?: number;
}

type Matrix = number[][];

function seedMatrix(rows: number, cols: number): Matrix {
    return Array.from({ length: rows }, (_unused, i) =>
        Array.from({ length: cols }, (_unused2, j) =>
            Math.cos((i + 1) * 0.7 + (j + 1) * 1.3) + (i === j ? 3 : 0),
        ),
    );
}

function dot(a: number[], b: number[]): number {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) total += (a[i] ?? 0) * (b[i] ?? 0);
    return total;
}

function norm(v: number[]): number {
    return Math.sqrt(dot(v, v));
}

/** Orthonormalize the columns of a matrix with classic Gram-Schmidt. */
function gramSchmidt(matrix: Matrix): Matrix {
    const rows = matrix.length;
    const cols = matrix[0]?.length ?? 0;
    const q: Matrix = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    for (let j = 0; j < cols; j += 1) {
        const column = Array.from({ length: rows }, (_unused, i) => matrix[i]?.[j] ?? 0);
        for (let k = 0; k < j; k += 1) {
            const basis = Array.from({ length: rows }, (_unused, i) => q[i]?.[k] ?? 0);
            const coefficient = dot(basis, column);
            for (let i = 0; i < rows; i += 1) column[i] = (column[i] ?? 0) - coefficient * (basis[i] ?? 0);
        }
        const length = norm(column);
        for (let i = 0; i < rows; i += 1) {
            q[i]![j] = length > 1e-12 ? (column[i] ?? 0) / length : 0;
        }
    }
    return q;
}

/** Largest absolute deviation of the Gram matrix from gain-squared times identity. */
function orthogonalityError(q: Matrix, gain: number): number {
    const cols = q[0]?.length ?? 0;
    let worst = 0;
    for (let a = 0; a < cols; a += 1) {
        for (let b = 0; b < cols; b += 1) {
            let prod = 0;
            for (let i = 0; i < q.length; i += 1) prod += (q[i]?.[a] ?? 0) * (q[i]?.[b] ?? 0);
            const expected = a === b ? gain * gain : 0;
            worst = Math.max(worst, Math.abs(prod - expected));
        }
    }
    return worst;
}

function makeCells(matrix: Matrix, revealed: number, rows: number, cols: number, gain: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            const value = (matrix[i]?.[j] ?? 0) * gain;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: value.toFixed(3),
                value,
                state: (j <= revealed ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, revealed: j <= revealed },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as OrthoInput | null) ?? {};
    const rows = Math.max(2, Math.floor(task.rows ?? 5));
    const cols = Math.max(1, Math.min(rows, Math.floor(task.cols ?? 3)));
    const gain = typeof task.gain === "number" && task.gain > 0 ? task.gain : 1;
    const seed = seedMatrix(rows, cols);
    const q = gramSchmidt(seed);
    const base = { rows, cols, gain, rowsMeta: rows, colsMeta: cols };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(seed, -1, rows, cols, gain),
        edges: [],
        description: `Seed matrix is ${rows} by ${cols}; orthogonalize one column at a time with Gram-Schmidt.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, error: orthogonalityError(q, gain), phase: 0 },
    };
    step += 1;

    for (let j = 0; j < cols; j += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(q, j, rows, cols, gain),
            edges: [],
            description: `Column ${j + 1} is orthonormal to all previous columns; current Gram error ${orthogonalityError(q, gain).toExponential(2)}.`,
            codeLineNumber: j === cols - 1 ? 4 : 2,
            layout: "grid",
            meta: { ...base, error: orthogonalityError(q, gain), phase: j + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(q, cols - 1, rows, cols, gain),
        edges: [],
        description: `Done: scaled by gain ${gain}; the Gram matrix deviates from gain-squared identity by ${orthogonalityError(q, gain).toExponential(2)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...base, error: orthogonalityError(q, gain), phase: cols + 1, done: true, matrix: q.flat().map((v) => v * gain) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A random linear layer with independent weights can stretch or shrink a signal. Orthogonal initialization instead builds a matrix whose columns are mutually perpendicular unit vectors, so the transform preserves lengths in expectation. Gram-Schmidt is the constructive way to turn an arbitrary set of vectors into such an orthonormal basis.",
        invariants: [
            "Each new column is stripped of its projections onto all earlier columns.",
            "Every finished column has unit length before the gain is applied.",
            "The Gram matrix equals the gain squared times the identity.",
        ],
        correctness:
            "Gram-Schmidt subtracts from each column its projection onto the span of previous columns, leaving a vector orthogonal to them, and then normalizes it to unit length. By induction the columns form an orthonormal set, so the matrix transpose times the matrix is the identity scaled by the gain squared. The test rebuilds the matrix independently and verifies every off-diagonal inner product is near zero and every diagonal one is near one.",
        complexityRationale:
            "For each of the cols columns we project against up to cols earlier columns across rows entries, costing O(rows times cols squared) total time. Storing the rows by cols matrix uses O(rows times cols) space.",
        uses: [
            "Initializing recurrent and very deep networks to preserve signal norm",
            "Building orthonormal bases for stratified sampling",
            "Stable initialization when activation gain is known",
        ],
        references: [
            "Saxe, McClelland, and Ganguli, Exact Solutions to the Nonlinear Dynamics of Learning, ICLR, 2014",
            "Golub and Van Loan, Matrix Computations, Chapter 5, 2013",
        ],
        workedExample:
            "Starting from three seeded columns in five dimensions, the first column is normalized directly. The second has its component along the first removed, and the third has components along both removed. With gain one, the inner product of any two distinct finished columns is about zero, and each column's own inner product is about one.",
    },
    id: "orthogonal-initialization",
    name: "Orthogonal Initialization",
    category: "ml-ai",
    complexity: { time: "O(rows * cols^2)", space: "O(rows * cols)" },
    defaultInput: { rows: 5, cols: 3, gain: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "build a deterministic seed matrix",
        "for each column take its column vector",
        "subtract the projection onto every earlier orthonormal column",
        "divide the result by its length to unit scale",
        "multiply every entry by the chosen gain",
        "record the Gram matrix error",
        "done: report the orthonormal matrix",
    ],
};

export default module;
