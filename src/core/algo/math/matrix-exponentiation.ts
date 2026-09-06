/**
 * matrix-exponentiation.ts – Matrix Exponentiation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Matrix exponentiation computes M^k for a square matrix M in O(d³ log k)
 * time using the same binary-exponentiation trick as scalar powers: square
 * the matrix at every step and fold it into the result for set bits. Its
 * signature use is fast linear recurrences – for example, Fibonacci numbers
 * are F(n) via the 2×2 matrix [[1,1],[1,0]]^n.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d³ log k) where d is the matrix dimension
 *   Space: O(d²)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The matrix cells are shown in a grid.
 *   - The cells being multiplied/squared are YELLOW (comparing).
 *   - The final result matrix is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The Fibonacci matrix is the classic teaching example.
 *   - Generalizes "recurrence → matrix → fast exponentiation".
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a matrix of cell entities for a frame.
 *
 * @param matrix The matrix to display.
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

/** Multiply two square matrices. */
function multiply(a: number[][], b: number[][]): number[][] {
    const n = a.length;
    const result: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let sum = 0;
            for (let k = 0; k < n; k += 1) {
                sum += (a[i]?.[k] ?? 0) * (b[k]?.[j] ?? 0);
            }
            result[i][j] = sum;
        }
    }
    return result;
}

/**
 * The Matrix Exponentiation generator.
 *
 * @param input `{ matrix, exponent }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; exponent?: number } | null) ?? {};
    // The Fibonacci matrix by default.
    const base: number[][] = task.matrix ?? [
        [1, 1],
        [1, 0],
    ];
    const exponent = typeof task.exponent === "number" ? Math.max(0, Math.floor(task.exponent)) : 7;

    const n = base.length;
    const bits = exponent.toString(2).split("").reverse().map(Number);

    let step = 0;

    // Result starts as the identity matrix.
    const result: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    let factor = base.map((row) => [...row]);

    // Frame 0: the base matrix.
    yield {
        stepNumber: step,
        entities: makeCells(base),
        edges: [],
        description: `Matrix exponentiation of the ${n}×${n} matrix to power ${exponent}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n },
    };
    step += 1;

    // Binary exponentiation over the bits (LSB first).
    for (let i = 0; i < bits.length; i += 1) {
        if (bits[i] === 1) {
            // Fold the factor into the result.
            const newResult = multiply(result, factor);
            for (let r = 0; r < n; r += 1) {
                for (let c = 0; c < n; c += 1) {
                    result[r][c] = newResult[r]?.[c] ?? 0;
                }
            }

            const states = new Map<string, EntityState>();
            for (let r = 0; r < n; r += 1) {
                for (let c = 0; c < n; c += 1) {
                    states.set(`${r},${c}`, "comparing");
                }
            }
            yield {
                stepNumber: step,
                entities: makeCells(result, states),
                edges: [],
                description: `Bit ${i} = 1 → result = result × factor.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { rows: n, cols: n },
            };
            step += 1;
        }

        // Square the factor.
        factor = multiply(factor, factor);

        yield {
            stepNumber: step,
            entities: makeCells(factor),
            edges: [],
            description: `Squared the factor matrix.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: n, cols: n },
        };
        step += 1;
    }

    const finalStates = new Map<string, EntityState>();
    for (let r = 0; r < n; r += 1) {
        for (let c = 0; c < n; c += 1) {
            finalStates.set(`${r},${c}`, "sorted");
        }
    }
    yield {
        stepNumber: step,
        entities: makeCells(result, finalStates),
        edges: [],
        description: `Matrix^${exponent} computed – Fibonacci-like result in the top-left.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: n, cols: n },
    };
}

/** The Matrix Exponentiation module, registered with the engine. */
const module: AlgorithmModule = {
    id: "matrix-exponentiation",
    name: "Matrix Exponentiation",
    category: "math",
    complexity: { time: "O(d³ log k)", space: "O(d²)" },
    // The Fibonacci matrix to the 7th power.
    defaultInput: {
        matrix: [
            [1, 1],
            [1, 0],
        ],
        exponent: 7,
    },
    visualType: "grid",
    run,
};

export default module;
