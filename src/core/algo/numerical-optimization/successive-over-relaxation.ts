/**
 * successive-over-relaxation.ts - Successive Over-Relaxation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Successive over-relaxation accelerates Gauss-Seidel iteration by extrapolating
 * each new value: the update is the Gauss-Seidel result blended with the old
 * value using a relaxation factor w. With w between one and two the correction
 * is amplified, which often cuts the number of sweeps substantially. The method
 * converges for symmetric positive definite matrices when zero < w < two.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n^2) for an n by n dense system
 *   Space: O(n^2) for the matrix and O(n) for the iterate
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid shows matrix A, right-hand side b, and the iterate x.
 *   - The x column turns yellow during a sweep and green when converged.
 *   - Frame metadata tracks the residual and the relaxation factor.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build the augmented matrix grid: A | b | x. */
function makeCells(
    matrix: number[][],
    rhs: number[],
    x: number[],
    xState: EntityState,
): VisualEntity[] {
    const rows = matrix.length;
    const cols = rows + 2;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
        const row = matrix[i] ?? [];
        for (let j = 0; j < rows; j += 1) {
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
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
            type: "cell" as const,
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
            type: "cell" as const,
            label: (x[i] ?? 0).toFixed(5),
            value: x[i] ?? 0,
            state: xState,
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

/** The successive over-relaxation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { a?: number[][]; b?: number[]; omega?: number; iterations?: number } | null
    ) ?? {};
    const matrix = Array.isArray(task.a) ? task.a.map((row) => [...row]) : [[4, 1], [1, 3]];
    const rhs = Array.isArray(task.b) ? [...task.b] : [1, 2];
    const omega = typeof task.omega === "number" && task.omega > 0 && task.omega < 2
        ? task.omega
        : 1.5;
    const iterations = typeof task.iterations === "number"
        ? Math.max(1, Math.floor(task.iterations))
        : 50;
    const n = matrix.length;
    const cols = n + 2;
    let x = new Array<number>(n).fill(0);
    let frame = 0;

    yield {
        stepNumber: frame,
        entities: makeCells(matrix, rhs, x, "unvisited"),
        edges: [],
        description: `Solving an ${n} by ${n} system with SOR using w = ${omega}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: n,
            cols,
            omega,
            iteration: 0,
            residual: residual(matrix, rhs, x),
            solution: [...x],
        },
    };
    frame += 1;

    let used = 0;
    let converged = false;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const next = [...x];
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
                    sum -= (matrix[i]?.[j] ?? 0) * (j < i ? (next[j] ?? 0) : (x[j] ?? 0));
                }
            }
            const gaussSeidel = sum / diagonal;
            next[i] = (1 - omega) * (x[i] ?? 0) + omega * gaussSeidel;
        }
        if (!valid || next.some((value) => !Number.isFinite(value))) {
            break;
        }
        x = next;
        used = iteration + 1;
        converged = residual(matrix, rhs, x) < 1e-12;
        yield {
            stepNumber: frame,
            entities: makeCells(matrix, rhs, x, "comparing"),
            edges: [],
            description: `Sweep ${used}: each unknown is extrapolated from its Gauss-Seidel update.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: n,
                cols,
                omega,
                iteration: used,
                residual: residual(matrix, rhs, x),
                solution: [...x],
            },
        };
        frame += 1;
        if (converged) {
            break;
        }
    }

    yield {
        stepNumber: frame,
        entities: makeCells(matrix, rhs, x, "sorted"),
        edges: [],
        description: `Solution ${x.map((v) => v.toFixed(6)).join(", ")} with residual ${residual(matrix, rhs, x).toExponential(2)} after ${used} sweep(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: n,
            cols,
            omega,
            iteration: used,
            residual: residual(matrix, rhs, x),
            solution: [...x],
            converged,
        },
    };
}

/** The successive over-relaxation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Gauss-Seidel updates each unknown using the newest values available. Over-relaxation goes a little further in that direction: instead of accepting the new value, move from the old value toward it by a factor greater than one. That extra push often reaches the solution in far fewer sweeps.",
        invariants: [
            "Each sweep uses updated values for earlier unknowns and old values for later ones.",
            "The relaxation factor stays strictly between zero and two for convergence.",
            "An exact solution is a fixed point of the update, so the residual falls to zero there.",
        ],
        correctness:
            "Write the Gauss-Seidel update as x new = L x + U x old + c. Over-relaxation replaces it with x new = (1 - w) x old + w(L x + U x old + c), whose fixed point is the same exact solution. For a symmetric positive definite matrix the iteration matrix has spectral radius below one whenever zero < w < two, so the error contracts every sweep and the iterates converge to the unique solution.",
        complexityRationale:
            "One sweep performs one dot product per row, O(n^2) arithmetic on a dense n by n matrix, and k sweeps cost O(k n^2). Storing the matrix and the current and next iterates uses O(n^2) space.",
        uses: [
            "Accelerating solutions of large sparse linear systems",
            "Iterative solvers for discretized partial differential equations",
            "A teaching bridge between Jacobi and Krylov methods",
        ],
        references: [
            "Young, Iterative Methods for Solving Partial Difference Equations, 1954",
            "Burden and Faires, Numerical Analysis, Section 4.3",
        ],
        workedExample:
            "For 4x + y = 1 and x + 3y = 2 with w = 1.5, starting at (0, 0), the first sweep gives x = 0.375 and y = 0.6875, moving faster toward the exact solution (0.0909, 0.6364) than plain Gauss-Seidel.",
    },
    id: "successive-over-relaxation",
    name: "Successive Over-Relaxation",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^2)", space: "O(n^2)" },
    defaultInput: { a: [[4, 1], [1, 3]], b: [1, 2], omega: 1.5, iterations: 50 },
    visualType: "grid",
    run,
    pseudocode: [
        "start the iterate vector at zero",
        "repeat for a fixed number of sweeps",
        "for each row compute its Gauss-Seidel value",
        "use new values for earlier unknowns and old for later",
        "blend old and new with the relaxation factor",
        "replace the iterate and measure the residual",
        "stop when the residual is tiny",
        "done: report the converged solution",
    ],
};

export default module;
