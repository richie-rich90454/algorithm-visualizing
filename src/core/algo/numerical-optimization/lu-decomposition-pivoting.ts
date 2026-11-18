/**
 * lu-decomposition-pivoting.ts - LU Decomposition with Partial Pivoting
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gaussian elimination factors a square matrix A into a unit lower-triangular
 * L and an upper-triangular U, with a permutation P recording the row swaps:
 * P A = L U. At each column, partial pivoting swaps in the row with the
 * largest absolute entry in that column. This keeps the divisor away from zero
 * and limits the growth of rounding error. The same in-place array stores L
 * below the diagonal and U on and above it.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) for an n by n matrix
 *   Space: O(n^2) for the in-place factors and the permutation
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The matrix is drawn as a grid of cells; the active pivot row and column
 *     are highlighted at each step.
 *   - Frames alternate between choosing the pivot and eliminating below it.
 *   - Frame metadata holds the working matrix, the row permutation, and the
 *     extracted L and U factors for checking P A = L U.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

function makeCells(matrix: Matrix, n: number, pivotRow: number, pivotCol: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const isPivot = i === pivotRow && j === pivotCol;
            const inPivotRow = i === pivotRow;
            const inCol = j === pivotCol && i > pivotRow;
            const state: EntityState = isPivot ? "pivot" : inPivotRow || inCol ? "comparing" : i < j ? "idle" : "sorted";
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: Number(matrix[i]?.[j] ?? 0).toFixed(2),
                value: matrix[i]?.[j] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

function splitFactors(a: Matrix, n: number) {
    const l = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : i > j ? (a[i]?.[j] ?? 0) : 0)),
    );
    const u = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i <= j ? (a[i]?.[j] ?? 0) : 0)),
    );
    return { l, u };
}

/** The LU-with-pivoting generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: Matrix } | null) ?? {};
    const source: Matrix = Array.isArray(task.matrix) && task.matrix.length > 0
        ? task.matrix
        : [
              [0, 2, 1],
              [1, -2, -3],
              [3, -1, 2],
          ];
    const n = Math.min(source.length, 6);
    const a: Matrix = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => Number(source[i]?.[j] ?? 0)),
    );
    const perm = Array.from({ length: n }, (_, i) => i);
    let singular = false;
    let step = 0;

    const emit = (description: string, codeLine: number, pivotRow: number, pivotCol: number, extra: object = {}) => {
        const frame: VisualFrame = {
            stepNumber: step,
            entities: makeCells(a, n, pivotRow, pivotCol),
            edges: [],
            description,
            codeLineNumber: codeLine,
            layout: "grid",
            meta: {
                n,
                rows: n,
                cols: n,
                matrix: a.flat(),
                perm: [...perm],
                ...extra,
            },
        };
        step += 1;
        return frame;
    };

    yield emit("Starting LU decomposition; the working matrix will hold L below and U above the diagonal.", 0, -1, -1);

    for (let k = 0; k < n; k += 1) {
        let pivotRow = k;
        for (let i = k + 1; i < n; i += 1) {
            if (Math.abs(a[i]?.[k] ?? 0) > Math.abs(a[pivotRow]?.[k] ?? 0)) {
                pivotRow = i;
            }
        }
        if (Math.abs(a[pivotRow]?.[k] ?? 0) < 1e-12) {
            singular = true;
            yield emit(`Column ${k} has no usable pivot; the matrix is singular.`, 2, pivotRow, k, { singular: true });
            break;
        }
        if (pivotRow !== k) {
            const tmp = a[k]!;
            a[k] = a[pivotRow]!;
            a[pivotRow] = tmp;
            const p = perm[k]!;
            perm[k] = perm[pivotRow]!;
            perm[pivotRow] = p;
        }
        yield emit(`Chose pivot ${a[k]?.[k]?.toFixed(3)} in row ${pivotRow}; swapped it into row ${k}.`, 3, k, k);

        for (let i = k + 1; i < n; i += 1) {
            a[i]![k] = (a[i]![k] ?? 0) / (a[k]![k] ?? 1);
            const factor = a[i]![k] ?? 0;
            for (let j = k + 1; j < n; j += 1) {
                a[i]![j] = (a[i]![j] ?? 0) - factor * (a[k]![j] ?? 0);
            }
        }
        yield emit(`Eliminated below the diagonal in column ${k}; multipliers now occupy L.`, 5, k, k);
    }

    if (!singular) {
        const { l, u } = splitFactors(a, n);
        yield emit("Factored A into a unit lower-triangular L and an upper-triangular U with permutation P.", 7, -1, -1, {
            l: l.flat(),
            u: u.flat(),
            singular: false,
            done: true,
        });
    } else {
        yield emit("Decomposition stopped: no full factorization exists for a singular matrix.", 7, -1, -1, { singular: true, done: true });
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Gaussian elimination can be recorded as a matrix factorization. Each step picks the largest available entry in the current column as a pivot, swaps it into place, then subtracts multiples of the pivot row from the rows below so they acquire zeros. The multipliers it uses are stored in the zeros below the diagonal, forming L, while the pivot row results form U. Recording the swaps gives a permutation P.",
        invariants: [
            "The product of the permutation, L, and U reproduces the original matrix.",
            "L is unit lower triangular and U is upper triangular after completion.",
            "Each pivot is the largest-magnitude entry available in its column.",
        ],
        correctness:
            "A row swap is left multiplication by a permutation matrix, and eliminating below a pivot is left multiplication by a unit lower-triangular elementary matrix. The product of those elementary matrices inverted is exactly the unit lower-triangular L built from the multipliers, so A = P inverse times L U, equivalently P A = L U. Partial pivoting only changes the permutation and cannot change the product, and a nonzero pivot guarantees each division is defined.",
        complexityRationale:
            "For each of n columns the algorithm scans up to n rows for a pivot and updates a trailing (n-k) by (n-k) block, giving a sum proportional to n cubed. The in-place factors and the permutation use n squared plus n storage.",
        uses: [
            "Solving dense linear systems without recomputing the elimination",
            "Computing matrix inverses and determinants via the factors",
            "Reusing factors for many right-hand sides in engineering simulations",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, Chapter 3",
            "Trefethen and Bau, Numerical Linear Algebra, Lecture 21",
        ],
        workedExample:
            "For the matrix with rows (0,2,1), (1,-2,-3), (3,-1,2), the first pivot is the 3 in the third row, so rows one and three swap. Elimination then produces a unit lower L and an upper U whose product, after undoing the swap, reconstructs the original matrix.",
    },
    id: "lu-decomposition-pivoting",
    name: "LU Decomposition with Partial Pivoting",
    category: "numerical-optimization",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        matrix: [
            [0, 2, 1],
            [1, -2, -3],
            [3, -1, 2],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "copy the input matrix into the working array and record the identity permutation",
        "for each column k from zero to n minus one",
        "find the row p at or below k with the largest absolute entry in column k",
        "swap rows k and p in the working array and in the permutation",
        "for each row i below k, divide the pivot column entry by the pivot",
        "subtract that multiplier times the pivot row from the trailing entries of row i",
        "extract unit lower L and upper U from the working array",
        "done: report L, U, and P with P A equal to L U",
    ],
};

export default module;
