/**
 * gauss-seidel-iteration.ts - Gauss-Seidel Iteration for Linear Systems
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gauss-Seidel solves a square linear system Ax = b by rearranging each row
 * for its unknown and sweeping through the rows in order. Unlike Jacobi, each
 * new value is written back immediately, so later rows in the same sweep use
 * already-updated values. This usually converges faster than Jacobi. The
 * method converges for strictly diagonally dominant matrices and for symmetric
 * positive definite matrices.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^2) for a dense n by n system
 *   Space: O(n^2) for the matrix and O(n) for the iterate
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows matrix A, the right-hand side b, and the iterate x.
 *   - The row being updated is yellow; its x cell is highlighted.
 *   - The final x column is green and the residual is reported.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    matrix: number[][],
    rhs: number[],
    x: number[],
    activeRow = -1,
    xState: EntityState = "unvisited",
): VisualEntity[] {
    const n = matrix.length;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        const row = matrix[i] ?? [];
        for (let j = 0; j < n; j += 1) {
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: (row[j] ?? 0).toFixed(2),
                value: row[j] ?? 0,
                state: i === activeRow ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
        entities.push({
            id: `cell-${i}-${n}`,
            type: "cell",
            label: (rhs[i] ?? 0).toFixed(2),
            value: rhs[i] ?? 0,
            state: i === activeRow ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: i, col: n },
        });
        entities.push({
            id: `cell-${i}-${n + 1}`,
            type: "cell",
            label: (x[i] ?? 0).toFixed(5),
            value: x[i] ?? 0,
            state: i === activeRow ? "comparing" : xState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: i, col: n + 1 },
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
        for (let j = 0; j < row.length; j += 1) sum += (row[j] ?? 0) * (x[j] ?? 0);
        worst = Math.max(worst, Math.abs(sum - (rhs[i] ?? 0)));
    }
    return worst;
}

/** The Gauss-Seidel iteration generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { a?: number[][]; b?: number[]; iterations?: number; tolerance?: number } | null
    ) ?? {};
    const matrix = Array.isArray(task.a) ? task.a.map((row) => [...row]) : [[4, 1], [1, 3]];
    const rhs = Array.isArray(task.b) ? [...task.b] : [1, 2];
    const iterations =
        typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 15;
    const tolerance =
        typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-12;
    const n = matrix.length;
    const cols = n + 2;
    const x = new Array<number>(n).fill(0);
    let step = 0;

    const baseMeta = { rows: n, cols, n };

    yield {
        stepNumber: step,
        entities: makeCells(matrix, rhs, x),
        edges: [],
        description: `Solving an ${n} by ${n} system with Gauss-Seidel; x starts at zero.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...baseMeta, sweep: 0, row: -1, x: [...x], residual: residual(matrix, rhs, x) },
    };
    step += 1;

    let converged = false;
    let used = 0;
    for (let sweep = 0; sweep < iterations && !converged; sweep += 1) {
        for (let i = 0; i < n; i += 1) {
            const diagonal = matrix[i]?.[i] ?? 0;
            if (diagonal === 0) {
                yield {
                    stepNumber: step,
                    entities: makeCells(matrix, rhs, x, i, "error"),
                    edges: [],
                    description: `Row ${i} has a zero diagonal and cannot be solved for its unknown.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: { ...baseMeta, sweep: sweep + 1, row: i, x: [...x], residual: residual(matrix, rhs, x) },
                };
                return;
            }
            let sum = rhs[i] ?? 0;
            for (let j = 0; j < n; j += 1) {
                if (j !== i) sum -= (matrix[i]?.[j] ?? 0) * (x[j] ?? 0);
            }
            x[i] = sum / diagonal;
            used = sweep + 1;
            converged = residual(matrix, rhs, x) < tolerance;
            yield {
                stepNumber: step,
                entities: makeCells(matrix, rhs, x, i),
                edges: [],
                description: `Sweep ${used}, row ${i}: x[${i}] updated to ${(x[i] ?? 0).toFixed(6)} using the newest values already in x.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: {
                    ...baseMeta,
                    sweep: used,
                    row: i,
                    x: [...x],
                    residual: residual(matrix, rhs, x),
                },
            };
            step += 1;
            if (converged) {
                break;
            }
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(matrix, rhs, x, -1, "sorted"),
        edges: [],
        description: `Solution ${x.map((value) => value.toFixed(6)).join(", ")} with residual ${residual(matrix, rhs, x).toExponential(2)} after ${used} sweep(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...baseMeta, sweep: used, row: -1, x: [...x], residual: residual(matrix, rhs, x), converged },
    };
}

/** The Gauss-Seidel iteration module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Rewrite each equation so its unknown stands alone, then sweep down the rows. When you compute a new value, write it straight back into the shared guess. Later equations in the same sweep therefore use fresher numbers than earlier ones, which typically makes the guesses settle faster than Jacobi's simultaneous updates.",
        invariants: [
            "When row i is updated, columns j < i already hold current-sweep values and columns j > i hold previous-sweep values.",
            "A row with a zero diagonal cannot be solved and stops the iteration.",
            "The residual measures how far the current iterate is from satisfying every equation.",
        ],
        correctness:
            "Write the system as x = (b - (L + U)x) restricted by D, where D is the diagonal, L the strictly lower triangle, and U the strictly upper triangle. One sweep applies (D - L) inverse times (U x + b). The exact solution is a fixed point of this map. When the spectral radius of the iteration matrix (D - L) inverse times U is below one, which diagonal dominance guarantees, the error contracts each sweep and the iterates converge to the unique solution.",
        complexityRationale:
            "Each row update forms one dot product of length n, so a sweep costs O(n^2) arithmetic and k sweeps cost O(k n^2). Only the matrix, the right-hand side, and one iterate vector are stored, using O(n^2) space.",
        uses: [
            "Iterative solution of sparse linear systems in scientific computing",
            "Powerflow and circuit simulation solvers",
            "A faster in-place alternative to Jacobi for teaching convergence",
        ],
        references: [
            "Gauss, unpublished letters to Bessel, 1823",
            "Seidel, On the Solution of Systems of Equations by Successive Approximations, 1874",
            "Burden and Faires, Numerical Analysis, Section 4.3",
        ],
        workedExample:
            "For 4x + y = 1 and x + 3y = 2 starting at (0, 0), the first sweep gives x = 0.25 and then y = (2 - 0.25)/3 = 0.5833, already closer than Jacobi's y = 0.6667. Further sweeps approach x = 0.0909 and y = 0.6364.",
    },
    id: "gauss-seidel-iteration",
    name: "Gauss-Seidel Iteration",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^2)", space: "O(n^2)" },
    defaultInput: { a: [[4, 1], [1, 3]], b: [1, 2], iterations: 15, tolerance: 1e-12 },
    visualType: "grid",
    run,
    pseudocode: [
        "start the iterate vector at zero",
        "repeat for a fixed number of sweeps",
        "for each row compute its unknown from the current x",
        "use updated values for earlier rows and old values for later rows",
        "write the new value back immediately",
        "stop when the maximum residual is below the tolerance",
        "done: report the solution and its residual",
    ],
};

export default module;
