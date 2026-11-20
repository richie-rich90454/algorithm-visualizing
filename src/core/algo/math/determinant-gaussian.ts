/**
 * determinant-gaussian.ts - Determinant by Gaussian Elimination
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This method computes a determinant by reducing the matrix to upper triangular
 * form with row operations. Adding a multiple of one row to another leaves the
 * determinant unchanged, while swapping two rows flips its sign. Once the
 * matrix is triangular, its determinant is the product of the diagonal entries
 * multiplied by the sign accumulated from row swaps. The same work is O(n^3),
 * in contrast to the factorial cost of expanding by permutations.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) for the elimination on an n by n matrix
 *   Space: O(n^2) for the working copy of the matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The working matrix is drawn as a grid of cells.
 *   - The current pivot is highlighted while its column is processed.
 *   - Cells below the pivot turn active as they are eliminated to zero.
 *   - The final frame reports the determinant and the number of row swaps.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Flatten a matrix so it fits the primitive meta value type. */
function flatten(matrix: number[][]): number[] {
    const flat: number[] = [];
    for (const row of matrix) {
        for (const value of row) {
            flat.push(value);
        }
    }
    return flat;
}

/** Build cell entities, optionally marking a pivot and a row being eliminated. */
function makeCells(
    matrix: number[][],
    pivotRow: number,
    pivotCol: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const cols = matrix[0]?.length ?? 0;
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const value = matrix[row]?.[col] ?? 0;
            let state: EntityState = "idle";
            if (done) {
                state = "sorted";
            } else if (row === pivotRow && col === pivotCol) {
                state = "pivot";
            } else if (col === pivotCol && row > pivotRow) {
                state = Math.abs(value) < 1e-12 ? "sorted" : "comparing";
            } else if (row === pivotRow) {
                state = "active";
            }
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: Math.abs(value) < 1e-12 ? "0" : value.toFixed(2),
                value,
                state,
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
    const task = (input as { matrix?: number[][] } | null) ?? {};
    const raw = Array.isArray(task.matrix) ? task.matrix : [
        [2, 1, 3],
        [1, 3, 2],
        [3, 1, 4],
    ];
    const n = raw.length;
    const matrix: number[][] = raw.slice(0, n).map((row, index) => {
        const source = Array.isArray(row) ? row : [];
        const working: number[] = [];
        for (let col = 0; col < n; col += 1) {
            const value = source[col];
            working.push(typeof value === "number" && Number.isFinite(value) ? value : 0);
        }
        if (working.length === 0 && index >= 0) {
            return new Array<number>(n).fill(0);
        }
        return working;
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(matrix, -1, -1, false),
        edges: [],
        description: `Reducing a ${n} by ${n} matrix to triangular form to compute its determinant.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n, matrix: flatten(matrix), det: 1, swaps: 0, pivot: -1 },
    };
    step += 1;

    let product = 1;
    let sign = 1;
    let swaps = 0;

    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(matrix[row]?.[col] ?? 0) > Math.abs(matrix[pivot]?.[col] ?? 0)) {
                pivot = row;
            }
        }

        if (pivot !== col) {
            const temp = matrix[col];
            matrix[col] = matrix[pivot] as number[];
            matrix[pivot] = temp as number[];
            sign *= -1;
            swaps += 1;
            yield {
                stepNumber: step,
                entities: makeCells(matrix, col, col, false),
                edges: [],
                description: `Column ${col}: swapped rows ${col} and ${pivot} to bring the largest pivot into place, flipping the sign.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: {
                    rows: n,
                    cols: n,
                    matrix: flatten(matrix),
                    det: product * sign,
                    swaps,
                    pivot: col,
                },
            };
            step += 1;
        }

        const pivotValue = matrix[col]?.[col] ?? 0;
        if (Math.abs(pivotValue) < 1e-12) {
            yield {
                stepNumber: step,
                entities: makeCells(matrix, col, col, false),
                edges: [],
                description: `Column ${col} has a zero pivot, so the matrix is singular and its determinant is zero.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { rows: n, cols: n, matrix: flatten(matrix), det: 0, swaps, pivot: col },
            };
            step += 1;
            yield {
                stepNumber: step,
                entities: makeCells(matrix, -1, -1, true),
                edges: [],
                description: "Done: the zero pivot makes the determinant exactly zero.",
                codeLineNumber: 7,
                layout: "grid",
                meta: { rows: n, cols: n, matrix: flatten(matrix), det: 0, swaps, pivot: -1 },
            };
            return;
        }

        product *= pivotValue;
        for (let row = col + 1; row < n; row += 1) {
            const factor = (matrix[row]?.[col] ?? 0) / pivotValue;
            for (let c = col; c < n; c += 1) {
                matrix[row]![c] = (matrix[row]?.[c] ?? 0) - factor * (matrix[col]?.[c] ?? 0);
            }
        }

        yield {
            stepNumber: step,
            entities: makeCells(matrix, -1, -1, false),
            edges: [],
            description: `Column ${col}: pivot ${pivotValue.toFixed(2)}, multiplied into the product and eliminated below; partial product ${(product * sign).toFixed(4)}.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: {
                rows: n,
                cols: n,
                matrix: flatten(matrix),
                det: product * sign,
                swaps,
                pivot: col,
            },
        };
        step += 1;
    }

    const determinant = product * sign;
    yield {
        stepNumber: step,
        entities: makeCells(matrix, -1, -1, true),
        edges: [],
        description: `Done: the triangular diagonal product ${Math.abs(product).toFixed(4)} with ${swaps} row swap(s) gives determinant ${determinant.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: n,
            cols: n,
            matrix: flatten(matrix),
            det: determinant,
            swaps,
            pivot: -1,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A determinant measures how much a matrix scales space, and row reduction reveals it one pivot at a time. Adding a multiple of one row to another does not change the determinant, so eliminating entries below the diagonal is free. Swapping two rows flips the sign, and once the matrix is triangular the determinant is simply the product of its diagonal entries times that sign.",
        invariants: [
            "Eliminating below a pivot with row addition preserves the determinant.",
            "Each row swap flips the sign of the determinant.",
            "After processing column k, every entry below the diagonal in that column is zero.",
        ],
        correctness:
            "The elementary row operations used here have known determinant effects: adding a multiple of one row to another changes nothing, and swapping two rows negates the determinant. Partial pivoting only swaps rows and eliminates below the pivot, never scaling a row, so the accumulated sign times the diagonal product of the final triangular matrix equals the determinant of the original. A zero pivot means a zero row in the reduced form and therefore a zero determinant.",
        complexityRationale:
            "For each of n columns the algorithm scans O(n) rows for a pivot and updates O(n) entries in each of the O(n) rows below it, giving O(n^3) arithmetic. Only one working copy of the n by n matrix is kept, so space is O(n^2).",
        uses: [
            "Testing whether a matrix is invertible in linear algebra software",
            "Computing Jacobians and change-of-volume factors in scientific code",
            "Solving systems and analyzing rank as a subroutine of elimination methods",
        ],
        references: [
            "Strang, Introduction to Linear Algebra, Chapter 4",
            "Golub and Van Loan, Matrix Computations, Chapter 3",
        ],
        workedExample:
            "For the matrix [[2,1,3],[1,3,2],[3,1,4]], pivoting swaps rows to place 3 first, then eliminates below. The triangular diagonal multiplies to 2 and one swap flips the sign, giving a determinant of -2, which matches expansion by the Leibniz formula.",
    },
    id: "determinant-gaussian",
    name: "Determinant by Gaussian Elimination",
    category: "math",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        matrix: [
            [2, 1, 3],
            [1, 3, 2],
            [3, 1, 4],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "copy the matrix and set the product and sign to one",
        "for each column from left to right",
        "select the largest magnitude entry as the pivot",
        "if the pivot is zero, the determinant is zero",
        "if rows were swapped, negate the sign",
        "multiply the running product by the pivot value",
        "eliminate every entry below the pivot with row operations",
        "done: report the product times the sign as the determinant",
    ],
};

export default module;
