/**
 * gauss-jordan-elimination.ts - Gauss-Jordan Elimination
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gauss-Jordan elimination solves a linear system by row-reducing the augmented
 * matrix all the way to reduced row echelon form. At each column a pivot row is
 * chosen by partial pivoting, scaled to make the pivot one, and then used to
 * eliminate every other entry in that column, both above and below. The right
 * hand side of the augmented matrix becomes the solution vector.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) for an n by n system
 *   Space: O(n^2) for the augmented matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The augmented matrix is drawn as a grid of editable cells.
 *   - The active pivot row is highlighted while eliminating.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LinearSystem {
    matrix: number[][];
    rhs: number[];
}

function makeMatrixCells(matrix: number[][], pivot: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const cols = matrix[0]?.length ?? 0;
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const value = matrix[row]?.[col] ?? 0;
            const isAugmented = col === cols - 1;
            let state: EntityState = "idle";
            if (row === pivot) {
                state = "comparing";
            } else if (isAugmented) {
                state = "active";
            }
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: Number.isInteger(value) ? String(value) : value.toFixed(3),
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

/** Replay Gauss-Jordan elimination with partial pivoting on a small system. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input ?? {}) as Partial<LinearSystem>;
    const source: number[][] = Array.isArray(task.matrix) ? task.matrix : [
        [2, 1, -1],
        [-3, -1, 2],
        [-2, 1, 2],
    ];
    const sourceRhs: number[] = Array.isArray(task.rhs) ? task.rhs : [8, -11, -3];
    const n = Math.min(source.length, sourceRhs.length);
    const rows = source.slice(0, n).map((row, i) => {
        const augmented = row.slice(0, n);
        while (augmented.length < n) {
            augmented.push(0);
        }
        augmented.push(sourceRhs[i] ?? 0);
        return augmented;
    });

    yield {
        stepNumber: 0,
        entities: makeMatrixCells(rows, -1),
        edges: [],
        description: `Starting augmented matrix for a ${n} by ${n} system.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n + 1, pivot: -1, solution: [], n },
    };

    let step = 1;
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(rows[row]?.[col] ?? 0) > Math.abs(rows[pivot]?.[col] ?? 0)) {
                pivot = row;
            }
        }
        if (Math.abs(rows[pivot]?.[col] ?? 0) < 1e-12) {
            yield {
                stepNumber: step,
                entities: makeMatrixCells(rows, -1),
                edges: [],
                description: `Column ${col} has no usable pivot; the matrix may be singular.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { rows: n, cols: n + 1, pivot: -1, solution: [], n },
            };
            step += 1;
            return;
        }
        const temp = rows[col];
        rows[col] = rows[pivot] as number[];
        rows[pivot] = temp as number[];
        yield {
            stepNumber: step,
            entities: makeMatrixCells(rows, col),
            edges: [],
            description: `Column ${col}: partial pivoting selects row ${pivot} with pivot value ${(rows[col]?.[col] ?? 0).toFixed(3)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: n, cols: n + 1, pivot: col, solution: [], n },
        };
        step += 1;

        const pivotRow = rows[col] as number[];
        const pivotValue = pivotRow[col] as number;
        for (let j = col; j <= n; j += 1) {
            pivotRow[j] = (pivotRow[j] ?? 0) / pivotValue;
        }
        for (let row = 0; row < n; row += 1) {
            if (row === col) {
                continue;
            }
            const factor = rows[row]?.[col] ?? 0;
            if (factor === 0) {
                continue;
            }
            for (let j = col; j <= n; j += 1) {
                rows[row]![j] = (rows[row]?.[j] ?? 0) - factor * (pivotRow[j] ?? 0);
            }
        }
        yield {
            stepNumber: step,
            entities: makeMatrixCells(rows, col),
            edges: [],
            description: `Column ${col} normalized and eliminated from every other row.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { rows: n, cols: n + 1, pivot: col, solution: [], n },
        };
        step += 1;
    }

    const solution = rows.map((row) => row[n] ?? 0);
    yield {
        stepNumber: step,
        entities: makeMatrixCells(rows, -1),
        edges: [],
        description: `Reduced row echelon form gives solution [${solution.map((v) => v.toFixed(4)).join(", ")}].`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: n, cols: n + 1, pivot: -1, solution, n },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Extend ordinary elimination by wiping out each pivot column both below and above the pivot. When the augmented matrix reaches reduced row echelon form, the coefficient part is the identity and the final column is already the answer. Choosing the largest available entry as pivot keeps the divisions numerically well behaved.",
        invariants: [
            "After processing column k, columns zero through k are unit columns.",
            "Row operations never change the solution set of the system.",
            "Partial pivoting chooses the largest magnitude entry in the current column.",
        ],
        correctness:
            "Each row operation is reversible and therefore preserves the solution set. Partial pivoting guarantees a nonzero pivot whenever the matrix has full rank. After n columns the coefficient block is the identity matrix, so the augmented column equals the unique solution vector. A zero pivot column means the system is rank deficient and no unique solution exists.",
        complexityRationale:
            "For each of n columns the method scales one row and updates the remaining rows across O(n) columns, giving O(n^3) arithmetic. Storing the augmented matrix of size n by (n+1) uses O(n^2) space.",
        uses: [
            "Solving dense linear systems in scientific computing",
            "Computing a matrix inverse by augmenting with the identity",
            "Teaching the mechanics of row reduction and rank",
        ],
        references: [
            "Strang, Introduction to Linear Algebra, Chapter 2",
            "Burden and Faires, Numerical Analysis, Chapter 6",
        ],
        workedExample:
            "For the system 2x + y - z = 8, -3x - y + 2z = -11, -2x + y + 2z = -3, Gauss-Jordan row reduction produces the identity on the left and the solution x = 2, y = 3, z = -1 on the right.",
    },
    id: "gauss-jordan-elimination",
    name: "Gauss-Jordan Elimination",
    category: "numerical-optimization",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        matrix: [
            [2, 1, -1],
            [-3, -1, 2],
            [-2, 1, 2],
        ],
        rhs: [8, -11, -3],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "form the augmented matrix from coefficients and right hand side",
        "for each column from left to right",
        "select the largest magnitude entry as pivot and swap it into place",
        "divide the pivot row so the pivot becomes one",
        "subtract multiples of the pivot row from all other rows",
        "after all columns the left block is the identity",
        "done: read the solution from the final column",
    ],
};

export default module;
