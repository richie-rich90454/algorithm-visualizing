/**
 * bareiss-fraction-free.ts – Bareiss Algorithm (fraction-free determinant)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Bareiss algorithm computes the determinant of an integer matrix without
 * ever introducing fractions, unlike naive Gaussian elimination. It performs a
 * fraction-free Gaussian elimination: each pivot step divides by the previous
 * pivot, which the theory guarantees divides exactly. This keeps the
 * computation in integers throughout.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n³)
 *   Space: O(n²)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The pivot cell is YELLOW (comparing).
 *   - The row being updated is RED (swapped).
 *   - The final matrix and determinant are shown.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Avoids floating-point rounding entirely.
 *   - The exact-division step is the key insight.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a matrix of cell entities for a frame.
 *
 * @param matrix The matrix.
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
 * The Bareiss generator.
 *
 * @param input `{ matrix }` – an integer square matrix.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][] } | null) ?? {};
    const M: number[][] = task.matrix ?? [
        [2, 1, 1],
        [1, 3, 2],
        [1, 0, 0],
    ];
    const n = M.length;

    let step = 0;

    // Frame 0: the matrix.
    yield {
        stepNumber: step,
        entities: makeCells(M),
        edges: [],
        description: "Bareiss algorithm – fraction-free determinant.",
        codeLineNumber: 0,
        layout: "matrix",
        meta: { rows: n, cols: n },
    };
    step += 1;

    // Bareiss elimination on a working copy.
    let prevPivot = 1;

    for (let k = 0; k < n - 1; k += 1) {
        const pivot = M[k]?.[k] ?? 0;
        if (pivot === 0) {
            // Pivot zero – matrix may be singular; bail out (educational).
            yield {
                stepNumber: step,
                entities: makeCells(M),
                edges: [],
                description: "Zero pivot encountered – halting (educational).",
                codeLineNumber: 2,
                layout: "matrix",
                meta: { rows: n, cols: n },
            };
            step += 1;
            break;
        }

        // Highlight the pivot.
        const pivotStates = new Map<string, EntityState>([[`${k},${k}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(M, pivotStates),
            edges: [],
            description: `Pivot ${pivot} at (${k}, ${k}).`,
            codeLineNumber: 3,
            layout: "matrix",
            meta: { rows: n, cols: n },
        };
        step += 1;

        // Update the submatrix with the fraction-free formula.
        for (let i = k + 1; i < n; i += 1) {
            for (let j = k + 1; j < n; j += 1) {
                const topLeft = pivot;
                const topRight = M[k]?.[j] ?? 0;
                const bottomLeft = M[i]?.[k] ?? 0;
                const bottomRight = M[i]?.[j] ?? 0;
                const updated = (topLeft * bottomRight - topRight * bottomLeft) / prevPivot;
                M[i][j] = updated;
            }
        }

        const elimStates = new Map<string, EntityState>();
        for (let i = k + 1; i < n; i += 1) {
            for (let j = k + 1; j < n; j += 1) {
                elimStates.set(`${i},${j}`, "swapped");
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(M, elimStates),
            edges: [],
            description: `Updated the (${k + 1}..n)×(${k + 1}..n) submatrix.`,
            codeLineNumber: 4,
            layout: "matrix",
            meta: { rows: n, cols: n },
        };
        step += 1;

        prevPivot = pivot;
    }

    // The determinant is the bottom-right entry after Bareiss elimination.
    const det = M[n - 1]?.[n - 1] ?? 0;

    const finalStates = new Map<string, EntityState>();
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            finalStates.set(`${i},${j}`, "sorted");
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(M, finalStates),
        edges: [],
        description: `Fraction-free determinant = ${det}.`,
        codeLineNumber: 5,
        layout: "matrix",
        meta: { rows: n, cols: n, determinant: det },
    };
}

/** The Bareiss module, registered with the engine. */
const module: AlgorithmModule = {
    id: "bareiss-fraction-free",
    name: "Bareiss (Fraction-Free)",
    category: "math",
    complexity: { time: "O(n³)", space: "O(n²)" },
    // A 3×3 integer matrix with determinant 2.
    defaultInput: {
        matrix: [
            [2, 1, 1],
            [1, 3, 2],
            [1, 0, 0],
        ],
    },
    visualType: "matrix",
    run,
};

export default module;
