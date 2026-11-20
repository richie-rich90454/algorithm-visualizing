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

    education: {
        "intuition": "Matrix exponentiation computes M^k by applying binary exponentiation to matrices. It squares the matrix at every step and folds the current power into a result whenever the exponent's bit is 1. Because matrix multiplication is associative, this gives M^k in O(log k) multiplications, which is the standard trick for fast linear recurrences.",
        "invariants": [
            "The factor matrix equals M raised to 2^t after t bits.",
            "The result equals M raised to the value of the exponent bits processed so far.",
            "The identity matrix is the neutral starting value for the result."
        ],
        "correctness": "Associativity of matrix multiplication lets the binary expansion of k be used exactly as for scalars: the result accumulates M raised to the selected powers of two. Induction over the bits keeps result equal to M to the partial exponent. When the last bit is processed the result is M^k.",
        "complexityRationale": "There are O(log k) squarings, each a d-by-d matrix multiplication costing O(d^3), so time is O(d^3 log k). Holding the result and factor matrices uses O(d^2) space.",
        "uses": [
            "Computing Fibonacci and other linear recurrences in O(log n)",
            "Graph reachability and path counting via adjacency powers",
            "Discrete dynamical system simulation"
        ],
        "references": [
            "Cormen et al., Introduction to Algorithms, Section 31.6",
            "Knuth, The Art of Computer Programming, Vol. 2, Section 4.6.4"
        ],
        "workedExample": "For the Fibonacci matrix [[1,1],[1,0]] to the 7th power, binary exponentiation squares the matrix three times and multiplies on the set bits of 7 = 111. The top-left entry of the result is F_8 = 21."
    },
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
    pseudocode: [
        "set result ← I and factor ← matrix; read exponent bits",
        "scan the exponent bits low to high",
        "on a 1 bit: result ← result × factor",
        "square the factor matrix each round",
        "done: matrix^exponent with answer on top",
    ],
};

export default module;
