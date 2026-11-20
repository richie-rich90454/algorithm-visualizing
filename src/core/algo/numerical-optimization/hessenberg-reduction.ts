/**
 * hessenberg-reduction.ts - Householder Reduction to Upper Hessenberg Form
 *
 * Before a QR eigenvalue iteration, a general matrix is first reduced to upper
 * Hessenberg form, which has zeros below the first subdiagonal. Each Householder
 * reflector zeroes one column below its subdiagonal entry, and applying it on
 * both sides preserves similarity so the eigenvalues are unchanged. The result
 * makes each later QR sweep far cheaper.
 *
 * This is an idealized exact-arithmetic simulation on small real matrices. It
 * assumes the matrix is square and small enough for dense operations; it does
 * not model blocked reflectors, pivoting for numerical stability, or the
 * eigenvalue extraction that normally follows.
 *
 * Time:  O(n^3) for an n by n matrix
 * Space: O(n^2) for the matrix and the accumulated orthogonal factor
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface HessenbergInput {
    matrix?: number[][];
}

interface Reduction {
    hessenberg: number[][];
    q: number[][];
    reflectors: number;
}

/** Reduce a square matrix to upper Hessenberg form and accumulate Q. */
function reduce(matrix: number[][]): Reduction {
    const n = matrix.length;
    const a = matrix.map((row) => [...row]);
    const q: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    let reflectors = 0;

    for (let k = 0; k <= n - 3; k += 1) {
        const x = Array.from({ length: n - k - 1 }, (_, t) => a[k + 1 + t]![k] ?? 0);
        const norm = Math.sqrt(x.reduce((sum, value) => sum + value * value, 0));
        if (norm < 1e-14) {
            continue;
        }
        const alpha = (x[0] ?? 0) >= 0 ? -norm : norm;
        const v = [...x];
        v[0] = (v[0] ?? 0) - alpha;
        const vnorm = v.reduce((sum, value) => sum + value * value, 0);
        if (vnorm < 1e-14) {
            continue;
        }
        const beta = 2 / vnorm;

        for (let col = k; col < n; col += 1) {
            let dot = 0;
            for (let t = 0; t < v.length; t += 1) {
                dot += (v[t] ?? 0) * (a[k + 1 + t]![col] ?? 0);
            }
            dot *= beta;
            for (let t = 0; t < v.length; t += 1) {
                a[k + 1 + t]![col] = (a[k + 1 + t]![col] ?? 0) - dot * (v[t] ?? 0);
            }
        }
        for (let row = 0; row < n; row += 1) {
            let dot = 0;
            for (let t = 0; t < v.length; t += 1) {
                dot += (a[row]![k + 1 + t] ?? 0) * (v[t] ?? 0);
            }
            dot *= beta;
            for (let t = 0; t < v.length; t += 1) {
                a[row]![k + 1 + t] = (a[row]![k + 1 + t] ?? 0) - dot * (v[t] ?? 0);
            }
        }
        for (let row = k + 2; row < n; row += 1) {
            a[row]![k] = 0;
        }
        a[k + 1]![k] = alpha;

        for (let row = 0; row < n; row += 1) {
            let dot = 0;
            for (let t = 0; t < v.length; t += 1) {
                dot += (q[row]![k + 1 + t] ?? 0) * (v[t] ?? 0);
            }
            dot *= beta;
            for (let t = 0; t < v.length; t += 1) {
                q[row]![k + 1 + t] = (q[row]![k + 1 + t] ?? 0) - dot * (v[t] ?? 0);
            }
        }
        reflectors += 1;
    }
    return { hessenberg: a, q, reflectors };
}

function maxBelowSubdiagonal(a: number[][]): number {
    let worst = 0;
    for (let row = 0; row < a.length; row += 1) {
        for (let col = 0; col < row - 1; col += 1) {
            worst = Math.max(worst, Math.abs(a[row]![col] ?? 0));
        }
    }
    return worst;
}

function makeCells(a: number[][], activeColumn: number, final: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < a.length; row += 1) {
        for (let col = 0; col < (a[row]?.length ?? 0); col += 1) {
            const value = a[row]![col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: value.toFixed(3),
                value,
                state: final ? "sorted" : col === activeColumn ? "comparing" : row > col + 1 ? "visited" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HessenbergInput | null) ?? {};
    const raw = Array.isArray(task.matrix) && task.matrix.length >= 3
        ? task.matrix.map((row) => (Array.isArray(row) ? row.map((v) => Number(v) || 0) : []))
        : [
            [4, 1, -2, 2],
            [1, 2, 0, 1],
            [-2, 0, 3, -2],
            [2, 1, -2, -1],
          ];
    const n = raw.length;
    const size = Math.min(10, Math.max(3, n));
    const matrix = Array.from({ length: size }, (_, i) =>
        Array.from({ length: size }, (_, j) => raw[i]?.[j] ?? (i === j ? 1 : 0)),
    );

    yield {
        stepNumber: 0,
        entities: makeCells(matrix, -1, false),
        edges: [],
        description: `Reduce a ${size} by ${size} matrix to upper Hessenberg form with Householder reflectors.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: size, cols: size, size, matrix, belowSub: maxBelowSubdiagonal(matrix), reflectors: 0, done: false },
    };

    const result = reduce(matrix);
    let step = 1;
    yield {
        stepNumber: step,
        entities: makeCells(result.hessenberg, -1, false),
        edges: [],
        description: `Applied ${result.reflectors} reflector(s) to annihilate entries below the first subdiagonal.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: {
            rows: size,
            cols: size,
            size,
            matrix: result.hessenberg,
            belowSub: maxBelowSubdiagonal(result.hessenberg),
            reflectors: result.reflectors,
            done: false,
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(result.hessenberg, -1, true),
        edges: [],
        description: `Upper Hessenberg form reached; largest magnitude below the subdiagonal is ${maxBelowSubdiagonal(result.hessenberg).toExponential(2)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: size,
            cols: size,
            size,
            matrix: result.hessenberg,
            belowSub: maxBelowSubdiagonal(result.hessenberg),
            reflectors: result.reflectors,
            q: result.q,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A dense QR sweep on a full matrix is wasteful because most entries are already known to be irrelevant before eigenvalues are extracted. A Householder reflector can zero an entire column below its second entry in one shot. Applying the same reflector on both sides keeps the matrix similar to the original, so the eigenvalues survive, and repeating column by column leaves only one nonzero subdiagonal to clean up later.",
        invariants: [
            "Each reflector is symmetric and orthogonal, so applying it on both sides is a similarity transform.",
            "A reflector only changes entries at or below the column it is zeroing and the matching rows.",
            "Once a column has been reduced, later reflectors leave its zeros in place.",
        ],
        correctness:
            "For column k the reflector is built from the vector of entries below the diagonal entry and maps that vector to a multiple of the first basis vector, placing the result in the first subdiagonal position. Left multiplication changes rows and right multiplication changes columns, so together they zero the target column while keeping the transform H A H, an orthogonal similarity. Such a transform preserves the characteristic polynomial and hence every eigenvalue; induction over the columns shows all entries below the first subdiagonal vanish at the end.",
        complexityRationale:
            "There are n minus two reflectors, and each updates a trailing block whose size shrinks quadratically, giving O(n^3) arithmetic in total. The matrix plus the accumulated orthogonal factor occupy O(n^2) space.",
        uses: [
            "Preprocessing a matrix for the QR eigenvalue algorithm",
            "Reducing dense matrices before Hessenberg-based solvers",
            "A teaching bridge between Gaussian elimination and eigenvalue methods",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, Chapter 7",
            "Press et al., Numerical Recipes, Chapter 11",
        ],
        workedExample:
            "Starting from a four by four symmetric matrix, the first reflector zeroes entries three and four of column one, the second zeroes entry four of column two, and the third column already needs no work. The result has nonzeros only on and above the first subdiagonal, with the same eigenvalues as the start.",
    },
    id: "hessenberg-reduction",
    name: "Hessenberg Reduction",
    category: "numerical-optimization",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        matrix: [
            [4, 1, -2, 2],
            [1, 2, 0, 1],
            [-2, 0, 3, -2],
            [2, 1, -2, -1],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read a square matrix A and start Q as the identity",
        "for each column index k up to n minus three",
        "build a Householder reflector from the entries below row k plus one",
        "apply the reflector to the trailing columns of A from the left",
        "apply the same reflector to the trailing rows of A from the right",
        "accumulate the reflector into Q",
        "verify entries below the first subdiagonal vanish",
        "done: report the Hessenberg matrix and its orthogonal factor",
    ],
};

export default module;
