/**
 * gaussian-elimination-gf2.ts – Gaussian Elimination over GF(2)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gaussian elimination over GF(2) works on bits: all arithmetic is modulo 2
 * (XOR for addition, AND for multiplication). It solves systems like M·x = b
 * where M is a binary matrix. Because addition is XOR, eliminating a variable
 * means XOR-ing one row into another. This is the engine behind linear algebra
 * over bits (e.g. XOR basis problems, error-correcting codes).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n² · word) or O(n³) naive over n rows
 *   Space: O(n²)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The pivot row is PINK (highlight).
 *   - Rows being XOR-eliminated are RED (swapped).
 *   - The final row-echelon matrix is shown.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - XOR replaces addition, which keeps every entry in {0, 1}.
 *   - The GF(2) structure is pervasive in competitive programming
 *     (XOR-basis, linear matroids).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a matrix of cell entities for a frame.
 *
 * @param matrix The binary augmented matrix.
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
                label: String(value),
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
 * The Gaussian Elimination (GF(2)) generator.
 *
 * @param input `{ matrix, b }` – a binary coefficient matrix and constant
 *        vector.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; b?: number[] } | null) ?? {};
    const A: number[][] = task.matrix ?? [
        [1, 1, 0],
        [0, 1, 1],
        [1, 0, 1],
    ];
    const b: number[] = task.b ?? [1, 0, 1];

    const n = A.length;
    const M: number[][] = A.map((row, i) => [...row, b[i] ?? 0]);
    const cols = n + 1;

    let step = 0;

    // Frame 0: the augmented matrix.
    yield {
        stepNumber: step,
        entities: makeCells(M),
        edges: [],
        description: "Gaussian elimination over GF(2) – XOR row operations.",
        codeLineNumber: 0,
        layout: "matrix",
        meta: { rows: n, cols },
    };
    step += 1;

    // Forward elimination.
    for (let col = 0; col < n; col += 1) {
        // Find a pivot row with a 1 in this column.
        let pivotRow = -1;
        for (let row = col; row < n; row += 1) {
            if ((M[row]?.[col] ?? 0) === 1) {
                pivotRow = row;
                break;
            }
        }
        if (pivotRow < 0) {
            continue;
        }

        // Swap the pivot row to the diagonal.
        if (pivotRow !== col) {
            const tmp = M[pivotRow];
            M[pivotRow] = M[col] ?? [];
            M[col] = tmp ?? [];

            const states = new Map<string, EntityState>();
            for (let c = 0; c < cols; c += 1) {
                states.set(`${col},${c}`, "swapped");
                states.set(`${pivotRow},${c}`, "swapped");
            }
            yield {
                stepNumber: step,
                entities: makeCells(M, states),
                edges: [],
                description: `Swapped row ${pivotRow} to row ${col}.`,
                codeLineNumber: 2,
                layout: "matrix",
                meta: { rows: n, cols },
            };
            step += 1;
        }

        // Highlight the pivot row.
        const pivotStates = new Map<string, EntityState>();
        for (let c = 0; c < cols; c += 1) {
            pivotStates.set(`${col},${c}`, "highlight");
        }
        yield {
            stepNumber: step,
            entities: makeCells(M, pivotStates),
            edges: [],
            description: `Pivot found at row ${col}, column ${col}.`,
            codeLineNumber: 3,
            layout: "matrix",
            meta: { rows: n, cols },
        };
        step += 1;

        // Eliminate the variable from rows below by XOR-ing the pivot row.
        for (let row = col + 1; row < n; row += 1) {
            const rowData = M[row];
            const pivotRowData = M[col];
            if (!rowData || !pivotRowData) {
                continue;
            }
            if ((rowData[col] ?? 0) === 1) {
                for (let c = col; c < cols; c += 1) {
                    rowData[c] = (rowData[c] ?? 0) ^ (pivotRowData[c] ?? 0);
                }

                const elimStates = new Map<string, EntityState>([[`${row},${col}`, "swapped"]]);
                yield {
                    stepNumber: step,
                    entities: makeCells(M, elimStates),
                    edges: [],
                    description: `XOR-ed pivot row into row ${row}.`,
                    codeLineNumber: 4,
                    layout: "matrix",
                    meta: { rows: n, cols },
                };
                step += 1;
            }
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(M),
        edges: [],
        description: "Row-echelon form over GF(2) reached.",
        codeLineNumber: 5,
        layout: "matrix",
        meta: { rows: n, cols },
    };
}

/** The Gaussian Elimination (GF(2)) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "gaussian-elimination-gf2",
    name: "Gaussian Elimination (GF(2))",
    category: "math",
    complexity: { time: "O(n³)", space: "O(n²)" },
    // A small binary system that exercises XOR row operations.
    defaultInput: {
        matrix: [
            [1, 1, 0],
            [0, 1, 1],
            [1, 0, 1],
        ],
        b: [1, 0, 1],
    },
    visualType: "matrix",
    run,
};

export default module;
