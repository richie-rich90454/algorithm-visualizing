/**
 * jacobi-iteration.ts - Jacobi Iteration for Linear Systems
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Jacobi iteration solves a square linear system Ax = b by repeatedly
 * rearranging each equation for its own unknown and evaluating the right-hand
 * side using the previous iterate for every other unknown. Because all updates
 * read the same old vector, they can be performed in parallel. The method
 * converges for strictly diagonally dominant matrices and many other common
 * cases.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^2) for an n by n dense system
 *   Space: O(n^2) for the matrix and O(n) for the iterates
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows matrix A, the right-hand side b, and the iterate x.
 *   - The x column is yellow while it is recomputed.
 *   - The final x column is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build the matrix, right-hand side, and iterate cells for one frame. */
function makeCells(
    matrix: number[][],
    rhs: number[],
    x: number[],
    active: Set<number> = new Set(),
    xState: EntityState = "unvisited",
): VisualEntity[] {
    const rows = matrix.length;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
        const row = matrix[i] ?? [];
        for (let j = 0; j < rows; j += 1) {
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: (row[j] ?? 0).toFixed(2),
                value: row[j] ?? 0,
                state: "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
        entities.push({
            id: `cell-${i}-${rows}`,
            type: "cell",
            label: (rhs[i] ?? 0).toFixed(2),
            value: rhs[i] ?? 0,
            state: "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: i, col: rows },
        });
        entities.push({
            id: `cell-${i}-${rows + 1}`,
            type: "cell",
            label: (x[i] ?? 0).toFixed(4),
            value: x[i] ?? 0,
            state: active.has(i) ? "comparing" : xState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: i, col: rows + 1 },
        });
    }
    return entities;
}

/** Maximum absolute residual of the current iterate. */
function residual(matrix: number[][], rhs: number[], x: number[]): number {
    let worst = 0;
    for (let i = 0; i < matrix.length; i += 1) {
        const row = matrix[i] ?? [];
        let sum = 0;
        for (let j = 0; j < row.length; j += 1) {
            sum += (row[j] ?? 0) * (x[j] ?? 0);
        }
        worst = Math.max(worst, Math.abs(sum - (rhs[i] ?? 0)));
    }
    return worst;
}

/** The Jacobi iteration generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { a?: number[][]; b?: number[]; iterations?: number } | null
    ) ?? {};
    const matrix = Array.isArray(task.a) ? task.a.map((row) => [...row]) : [[4, 1], [1, 3]];
    const rhs = Array.isArray(task.b) ? [...task.b] : [1, 2];
    const iterations =
        typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 20;
    const n = matrix.length;
    const cols = n + 2;
    let x = new Array<number>(n).fill(0);

    yield {
        stepNumber: 0,
        entities: makeCells(matrix, rhs, x),
        edges: [],
        description: `Solving an ${n} by ${n} system with Jacobi iteration; x starts at zero.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols, iteration: 0, residual: residual(matrix, rhs, x), solution: [...x] },
    };
    let step = 1;

    let converged = false;
    let used = 0;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const next = new Array<number>(n).fill(0);
        let valid = true;
        for (let i = 0; i < n; i += 1) {
            const diagonal = matrix[i]?.[i] ?? 0;
            if (diagonal === 0) {
                valid = false;
                break;
            }
            let sum = rhs[i] ?? 0;
            for (let j = 0; j < n; j += 1) {
                if (j !== i) {
                    sum -= (matrix[i]?.[j] ?? 0) * (x[j] ?? 0);
                }
            }
            next[i] = sum / diagonal;
        }
        if (!valid || next.some((value) => !Number.isFinite(value))) {
            break;
        }
        used = iteration + 1;
        x = next;
        converged = residual(matrix, rhs, x) < 1e-12;
        yield {
            stepNumber: step,
            entities: makeCells(matrix, rhs, x, new Set(x.map((_, i) => i))),
            edges: [],
            description: `Iteration ${used}: every unknown is updated from the previous iterate.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: n, cols, iteration: used, residual: residual(matrix, rhs, x), solution: [...x] },
        };
        step += 1;
        if (converged) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(matrix, rhs, x, new Set(), "sorted"),
        edges: [],
        description: `Solution ${x.map((value) => value.toFixed(5)).join(", ")} with residual ${residual(matrix, rhs, x).toExponential(2)} after ${used} iteration(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: n,
            cols,
            iteration: used,
            residual: residual(matrix, rhs, x),
            solution: [...x],
            converged,
        },
    };
}

/** The Jacobi iteration module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Rewrite each equation so its own unknown is alone on the left, then plug the current guesses for all the other unknowns into the right side. Every unknown gets a fresh value at the same time, using only values from the previous round.",
        invariants: [
            "Each update reads the previous iterate, never a value computed in the current round.",
            "A row with a zero diagonal cannot be updated and stops the iteration.",
            "Each sweep solves one equation exactly for its unknown given the others.",
        ],
        correctness:
            "Write the system as x = D inverse times (b minus the off-diagonal part of A times x). Any exact solution is a fixed point of this equation. When the iteration matrix has spectral radius below one, which strict diagonal dominance guarantees, the error contracts on every sweep and the iterates converge to the unique solution.",
        complexityRationale:
            "One sweep performs one dot product per row, so O(n^2) arithmetic for a dense n by n matrix. Iterating k times costs O(k n^2). Storing A, b, and the two iterate vectors uses O(n^2) space.",
        uses: [
            "Solving large sparse systems from discretized partial differential equations",
            "Iterative refinement in scientific computing",
            "A baseline for comparison with Gauss-Seidel and conjugate gradient",
        ],
        references: [
            "Jacobi, On a New Method for Solving Certain Approximation Problems, 1845",
            "Burden and Faires, Numerical Analysis, Section 4.2",
        ],
        workedExample:
            "For 4x + y = 1 and x + 3y = 2, start at (0, 0). The first sweep gives x = 0.25 and y = 0.6667; later sweeps approach x = 0.0909 and y = 0.6364, which satisfy both equations.",
    },
    id: "jacobi-iteration",
    name: "Jacobi Iteration",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^2)", space: "O(n^2)" },
    defaultInput: { a: [[4, 1], [1, 3]], b: [1, 2], iterations: 20 },
    visualType: "grid",
    run,
    pseudocode: [
        "start the iterate vector at zero",
        "repeat for a fixed number of sweeps",
        "for each row solve its equation for that unknown",
        "use the previous iterate for every off-diagonal term",
        "replace the whole iterate at once",
        "stop when the maximum residual is tiny",
        "done: report the solution and its residual",
    ],
};

export default module;
