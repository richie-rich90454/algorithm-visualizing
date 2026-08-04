/**
 * gaussian-elimination.ts – Gaussian Elimination (linear systems)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gaussian elimination solves a system of linear equations A·x = b by turning
 * the augmented matrix [A | b] into row-echelon form. For each column it finds
 * a pivot (a non-zero entry), swaps it to the diagonal, normalizes the pivot
 * row, and eliminates the variable from all rows below. Back-substitution then
 * yields the solution vector.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n³) for an n×n system
 *   Space: O(n²) for the augmented matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The pivot cell is YELLOW (comparing).
 *   - The pivot row is PINK (highlight).
 *   - Rows being eliminated are RED (swapped).
 *   - The final row-echelon matrix is shown.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The foundational linear-algebra algorithm.
 *   - Variants include Gauss-Jordan and LU decomposition.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a matrix of cell entities for a frame.
 *
 * @param matrix The augmented matrix.
 * @param states Optional `row,col` → state overrides.
 * @returns Cell entities with row/col metadata (grid layout).
 */
function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const matrixRow = matrix[row];
        if (!matrixRow) {
            continue;
        }
        for (let col = 0; col < matrixRow.length; col += 1) {
            const value = matrixRow[col];
            if (value === undefined) {
                continue;
            }
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: value.toFixed(1),
                value,
                state: states.get(`${row},${col}`) ?? "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return cells;
}

/**
 * The Gaussian Elimination generator.
 *
 * @param input `{ matrix, b }` – the coefficient matrix and constant vector.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; b?: number[] } | null) ?? {};
    const A: number[][] = task.matrix ?? [
        [2, 1, -1],
        [-3, -1, 2],
        [-2, 1, 2],
    ];
    const b: number[] = task.b ?? [8, -11, -3];

    const n = A.length;

    // The augmented matrix [A | b].
    const M: number[][] = A.map((row, i) => [...row, b[i] ?? 0]);

    let step = 0;

    // Frame 0: the augmented matrix.
    yield {
        stepNumber: step,
        entities: makeCells(M),
        edges: [],
        description: "Gaussian elimination on the augmented matrix [A | b].",
        codeLineNumber: 0,
        layout: "matrix",
        meta: { rows: n, cols: n + 1 },
    };
    step += 1;

    // Forward elimination: reach row-echelon form.
    for (let col = 0; col < n; col += 1) {
        // Find a pivot (a non-zero entry) in this column at or below the diag.
        let pivotRow = -1;
        for (let row = col; row < n; row += 1) {
            if (Math.abs(M[row]?.[col] ?? 0) > 1e-9) {
                pivotRow = row;
                break;
            }
        }
        if (pivotRow < 0) {
            continue; // No pivot in this column (underdetermined or singular).
        }

        // Swap the pivot row up to the diagonal.
        if (pivotRow !== col) {
            const tmp = M[pivotRow];
            M[pivotRow] = M[col] ?? [];
            M[col] = tmp ?? [];

            const states = new Map<string, EntityState>();
            for (let c = 0; c <= n; c += 1) {
                states.set(`${col},${c}`, "swapped");
                states.set(`${pivotRow},${c}`, "swapped");
            }
            yield {
                stepNumber: step,
                entities: makeCells(M, states),
                edges: [],
                description: `Swapped row ${pivotRow} up to row ${col} (pivot row).`,
                codeLineNumber: 2,
                layout: "matrix",
                meta: { rows: n, cols: n + 1 },
            };
            step += 1;
        }

        // Normalize the pivot row to make the diagonal entry 1.
        const pivot = M[col]?.[col] ?? 1;
        const pivotRowData = M[col];
        if (pivotRowData) {
            for (let c = col; c <= n; c += 1) {
                pivotRowData[c] = (pivotRowData[c] ?? 0) / pivot;
            }
        }

        const states = new Map<string, EntityState>();
        for (let c = col; c <= n; c += 1) {
            states.set(`${col},${c}`, "highlight");
        }
        yield {
            stepNumber: step,
            entities: makeCells(M, states),
            edges: [],
            description: `Normalized pivot row ${col}.`,
            codeLineNumber: 3,
            layout: "matrix",
            meta: { rows: n, cols: n + 1 },
        };
        step += 1;

        // Eliminate this variable from all rows below.
        for (let row = col + 1; row < n; row += 1) {
            const factor = M[row]?.[col] ?? 0;
            const rowData = M[row];
            const pivotRowData2 = M[col];
            if (!rowData || !pivotRowData2) {
                continue;
            }
            for (let c = col; c <= n; c += 1) {
                rowData[c] = (rowData[c] ?? 0) - factor * (pivotRowData2[c] ?? 0);
            }

            const elimStates = new Map<string, EntityState>([[`${row},${col}`, "swapped"]]);
            yield {
                stepNumber: step,
                entities: makeCells(M, elimStates),
                edges: [],
                description: `Eliminated x${col} from row ${row}.`,
                codeLineNumber: 4,
                layout: "matrix",
                meta: { rows: n, cols: n + 1 },
            };
            step += 1;
        }
    }

    // Back-substitution to read off the solution.
    const solution = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i -= 1) {
        const rowData = M[i];
        if (!rowData) {
            continue;
        }
        let sum = rowData[n] ?? 0;
        for (let j = i + 1; j < n; j += 1) {
            sum -= (rowData[j] ?? 0) * solution[j];
        }
        const denom = rowData[i] ?? 1;
        solution[i] = denom !== 0 ? sum / denom : 0;
    }

    yield {
        stepNumber: step,
        entities: makeCells(M),
        edges: [],
        description: `Row-echelon form reached. Solution: x = [${solution.map((v) => v.toFixed(1)).join(", ")}].`,
        codeLineNumber: 5,
        layout: "matrix",
        meta: { rows: n, cols: n + 1, solution },
    };
}

/** The Gaussian Elimination module, registered with the engine. */
const module: AlgorithmModule = {
    id: "gaussian-elimination",
    name: "Gaussian Elimination",
    category: "math",
    complexity: { time: "O(n³)", space: "O(n²)" },
    // A 3×3 system with a clean solution.
    defaultInput: {
        matrix: [
            [2, 1, -1],
            [-3, -1, 2],
            [-2, 1, 2],
        ],
        b: [8, -11, -3],
    },
    visualType: "matrix",
    run,
};

export default module;
