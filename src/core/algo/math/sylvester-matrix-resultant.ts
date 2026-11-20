/**
 * sylvester-matrix-resultant.ts - Resultant via the Sylvester Matrix.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The resultant of two polynomials f (degree m) and g (degree n) is the
 * determinant of their (m+n)-by-(m+n) Sylvester matrix, built from shifted
 * copies of the coefficient lists. The resultant is zero exactly when f and g
 * share a common root, and otherwise equals the product of pairwise root
 * differences scaled by the leading coefficients.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((m+n)^3) for the determinant of the Sylvester matrix
 *   Space: O((m+n)^2) for the matrix displayed in the grid
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows the Sylvester matrix; each frame shades the current row.
 *   - The final frame reports the determinant, which is the resultant.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ResultantInput {
    f?: number[];
    g?: number[];
}

/** All size-k subsets of 0..n-1 (used only for small expansion fallback). */
function determinant(matrix: bigint[][]): bigint {
    const n = matrix.length;
    const a = matrix.map((row) => row.slice());
    let sign = 1n;
    let previous = 1n;
    for (let k = 0; k < n - 1; k += 1) {
        if (a[k]![k] === 0n) {
            let swap = -1;
            for (let r = k + 1; r < n; r += 1) {
                if (a[r]![k] !== 0n) {
                    swap = r;
                    break;
                }
            }
            if (swap === -1) {
                return 0n;
            }
            [a[k], a[swap]] = [a[swap]!, a[k]!];
            sign = -sign;
        }
        const pivot = a[k]![k]!;
        for (let i = k + 1; i < n; i += 1) {
            for (let j = k + 1; j < n; j += 1) {
                a[i]![j] = (pivot * a[i]![j]! - a[i]![k]! * a[k]![j]!) / previous;
            }
            a[i]![k] = 0n;
        }
        previous = pivot;
    }
    return sign * (a[n - 1]![n - 1] ?? 0n);
}

function trim(poly: number[]): number[] {
    const copy = poly.slice();
    while (copy.length > 1 && copy[0] === 0) {
        copy.shift();
    }
    return copy;
}

/** Build the Sylvester matrix of f (length m+1) and g (length n+1). */
function sylvester(f: number[], g: number[]): bigint[][] {
    const m = f.length - 1;
    const n = g.length - 1;
    const size = m + n;
    const matrix: bigint[][] = Array.from({ length: size }, () => new Array<bigint>(size).fill(0n));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j <= m; j += 1) {
            matrix[i]![i + j] = BigInt(f[j] ?? 0);
        }
    }
    for (let i = 0; i < m; i += 1) {
        for (let j = 0; j <= n; j += 1) {
            matrix[n + i]![i + j] = BigInt(g[j] ?? 0);
        }
    }
    return matrix;
}

function makeEntities(matrix: bigint[][], currentRow: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < matrix.length; c += 1) {
            const value = matrix[r]![c]!;
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: value.toString(),
                value: value.toString(),
                state: (done ? "sorted" : r === currentRow ? "highlight" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ResultantInput | null) ?? {};
    const f = trim(Array.isArray(task.f) && task.f.length >= 2 && task.f[0] !== 0 ? task.f.slice() : [1, 0, -1]);
    const g = trim(Array.isArray(task.g) && task.g.length >= 2 && task.g[0] !== 0 ? task.g.slice() : [1, -2]);
    const matrix = sylvester(f, g);

    yield {
        stepNumber: 0,
        entities: makeEntities(matrix, -1, false),
        edges: [],
        description: `Built the ${matrix.length}x${matrix.length} Sylvester matrix for degrees ${f.length - 1} and ${g.length - 1}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: matrix.length, cols: matrix.length, size: matrix.length },
    };

    for (let r = 0; r < matrix.length; r += 1) {
        yield {
            stepNumber: r + 1,
            entities: makeEntities(matrix, r, false),
            edges: [],
            description: `Examining row ${r} of the Sylvester matrix before evaluating its determinant.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: matrix.length, cols: matrix.length, size: matrix.length, row: r },
        };
    }

    const resultant = determinant(matrix);
    yield {
        stepNumber: matrix.length + 1,
        entities: makeEntities(matrix, -1, true),
        edges: [],
        description: `Done: the determinant is ${resultant.toString()}, so the resultant is ${resultant.toString()}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: matrix.length, cols: matrix.length, size: matrix.length, resultant: resultant.toString() },
    };
}

const module: AlgorithmModule = {
    id: "sylvester-matrix-resultant",
    name: "Sylvester Matrix Resultant",
    category: "math",
    complexity: { time: "O((m+n)^3)", space: "O((m+n)^2)" },
    defaultInput: { f: [1, 0, -1], g: [1, -2] },
    visualType: "grid",
    run,
    pseudocode: [
        "let m and n be the degrees of f and g",
        "build an (m+n)-by-(m+n) matrix of shifted coefficients",
        "place n shifted rows of f starting at the first column",
        "place m shifted rows of g starting at the first column",
        "compute the determinant of the Sylvester matrix",
        "done: report the determinant as the resultant",
    ],
    education: {
        intuition:
            "The resultant packages the question 'do these two polynomials share a root?' into a single determinant. By stacking shifted copies of the coefficient lists into the Sylvester matrix, the construction encodes the existence of a nontrivial common factor: the determinant vanishes precisely when such a factor exists.",
        invariants: [
            "The Sylvester matrix is square with side m+n.",
            "Its first n rows hold shifted coefficient lists of f.",
            "Its last m rows hold shifted coefficient lists of g.",
            "The determinant is computed exactly with fraction-free elimination.",
        ],
        correctness:
            "The Sylvester matrix maps the coefficients of two candidate polynomials u and v with f*u + g*v = 0. A nontrivial solution exists exactly when f and g share a common factor, which happens exactly when the matrix is singular. Hence its determinant, the resultant, is zero iff a common root exists, and otherwise equals the leading-coefficient-scaled product of pairwise root differences.",
        complexityRationale:
            "The Sylvester matrix has side m+n, so building it is quadratic and computing its determinant by elimination is cubic in that side. The visualization stores the full matrix, giving O((m+n)^2) space.",
        uses: [
            "Testing whether two polynomials share a root without factoring",
            "Eliminating a variable from two polynomial equations",
            "Computing discriminants and resultants in computer algebra",
        ],
        references: [
            "Cox, Little and O'Shea, Using Algebraic Geometry, resultants",
            "Wikipedia, Resultant and Sylvester matrix",
        ],
        workedExample:
            "For f=x^2-1 with coefficients [1,0,-1] and g=x-2 with [1,-2], the Sylvester matrix is [[1,0,-1],[1,-2,0],[0,1,-2]] whose determinant is 3, matching the product (1-2)(-1-2).",
    },
};

export default module;
