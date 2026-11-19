/**
 * thomas-algorithm.ts - Thomas Algorithm for Tridiagonal Systems
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Thomas algorithm is a specialized Gaussian elimination for tridiagonal
 * systems. A forward sweep eliminates the subdiagonal by modifying only the
 * diagonal and right-hand side, and a backward substitution then reads off the
 * solution. It runs in linear time and needs only the three diagonals, which
 * makes it the standard solver for one-dimensional diffusion, spline fitting,
 * and finite-difference discretizations.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a system of size n
 *   Space: O(n) for the modified diagonals and solution
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid columns show the lower, main, and upper diagonals, the right-hand
 *     side, and the emerging solution.
 *   - The row currently eliminated or substituted is highlighted.
 *   - meta carries the three diagonals, right-hand side, and the solution.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    lower: number[],
    main: number[],
    upper: number[],
    rhs: number[],
    solution: number[],
    active: number,
    phase: "forward" | "back" | "done",
): VisualEntity[] {
    const n = main.length;
    const cells: VisualEntity[] = [];
    for (let row = 0; row < n; row += 1) {
        const columns: Array<[string, number]> = [
            ["lower", lower[row - 1] ?? 0],
            ["main", main[row] ?? 0],
            ["upper", upper[row] ?? 0],
            ["rhs", rhs[row] ?? 0],
            ["x", solution[row] ?? 0],
        ];
        columns.forEach(([kind, value], col) => {
            let state: EntityState = "unvisited";
            if (row === active && phase !== "done") state = "comparing";
            else if (col === 4 && phase === "done") state = "sorted";
            else if (kind === "main" || kind === "rhs") state = "idle";
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: (kind === "lower" && row === 0) || (kind === "upper" && row === n - 1) ? "" : value.toFixed(3),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, kind },
            });
        });
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { lower?: number[]; main?: number[]; upper?: number[]; rhs?: number[] } | null
    ) ?? {};
    const main: number[] =
        Array.isArray(task.main) && task.main.length > 0
            ? task.main.map(Number)
            : [4, 4, 4, 4, 4];
    const n = main.length;
    const lower: number[] =
        Array.isArray(task.lower) && task.lower.length === n - 1
            ? task.lower.map(Number)
            : Array.from({ length: Math.max(0, n - 1) }, () => -1);
    const upper: number[] =
        Array.isArray(task.upper) && task.upper.length === n - 1
            ? task.upper.map(Number)
            : Array.from({ length: Math.max(0, n - 1) }, () => -1);
    const rhs: number[] =
        Array.isArray(task.rhs) && task.rhs.length === n ? task.rhs.map(Number) : [2, 4, 6, 8, 16].slice(0, n);

    const d = [...main];
    const b = [...rhs];
    const solution: number[] = Array.from({ length: n }, () => 0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(lower, d, upper, b, solution, -1, "forward"),
        edges: [],
        description: `Tridiagonal solve of size ${n}; the forward sweep will eliminate the subdiagonal.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: 5, n, lower: [...lower], main: [...d], upper: [...upper], rhs: [...b], solution: [...solution], residual: 0 },
    };
    step += 1;

    let failed = false;
    for (let i = 1; i < n; i += 1) {
        const pivot = d[i - 1] ?? 0;
        if (Math.abs(pivot) < 1e-14) {
            failed = true;
            break;
        }
        const factor = (lower[i - 1] ?? 0) / pivot;
        d[i] = (d[i] ?? 0) - factor * (upper[i - 1] ?? 0);
        b[i] = (b[i] ?? 0) - factor * (b[i - 1] ?? 0);
        yield {
            stepNumber: step,
            entities: makeCells(lower, d, upper, b, solution, i, "forward"),
            edges: [],
            description: `Forward sweep at row ${i}: multiplier ${factor.toFixed(4)}, updated diagonal ${(d[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: n, cols: 5, n, lower: [...lower], main: [...d], upper: [...upper], rhs: [...b], solution: [...solution], residual: 0 },
        };
        step += 1;
    }

    if (!failed) {
        solution[n - 1] = (b[n - 1] ?? 0) / (d[n - 1] ?? 1);
        for (let i = n - 2; i >= 0; i -= 1) {
            solution[i] = ((b[i] ?? 0) - (upper[i] ?? 0) * (solution[i + 1] ?? 0)) / (d[i] ?? 1);
            yield {
                stepNumber: step,
                entities: makeCells(lower, d, upper, b, solution, i, "back"),
                edges: [],
                description: `Back substitution at row ${i}: x[${i}] = ${(solution[i] ?? 0).toFixed(4)}.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { rows: n, cols: 5, n, lower: [...lower], main: [...d], upper: [...upper], rhs: [...b], solution: [...solution], residual: 0 },
            };
            step += 1;
        }
    }

    let residual = 0;
    if (!failed) {
        for (let i = 0; i < n; i += 1) {
            const value =
                (lower[i - 1] ?? 0) * (solution[i - 1] ?? 0) +
                (main[i] ?? 0) * (solution[i] ?? 0) +
                (upper[i] ?? 0) * (solution[i + 1] ?? 0);
            residual = Math.max(residual, Math.abs(value - (rhs[i] ?? 0)));
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(lower, d, upper, b, solution, -1, failed ? "forward" : "done"),
        edges: [],
        description: failed
            ? "Elimination broke down because a pivot was zero; the system needs pivoting."
            : `Solution complete with maximum equation residual ${residual.toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: n, cols: 5, n, lower: [...lower], main: [...main], upper: [...upper], rhs: [...rhs], solution: [...solution], residual, failed },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A tridiagonal matrix has nonzeros only on the main diagonal and its two neighbors, so a full Gaussian elimination would waste almost all its work on zeros. The Thomas algorithm sweeps forward to remove the subdiagonal, rewriting each diagonal and right-hand side entry in place, then sweeps backward to read off the unknowns. It is the fastest direct solver for banded systems of this shape.",
        invariants: [
            "The subdiagonal entries are logically eliminated after the forward sweep without storing fill-in.",
            "Each forward update only changes the current diagonal and right-hand side using the previous row.",
            "Back substitution solves row i once x[i+1] is already known.",
        ],
        correctness:
            "The forward multiplier lower[i-1] over the modified diagonal d[i-1] subtracted from row i makes its subdiagonal coefficient zero while preserving the equation. Because only diagonal and right-hand side entries change, the modified system is upper bidiagonal. Back substitution then solves from the last row upward; substituting the computed values into the original tridiagonal equations reproduces every right-hand side entry.",
        complexityRationale:
            "The forward sweep and the back substitution each visit each of the n rows once with constant work, giving O(n) time. Only the three diagonals, the right-hand side, and the solution are stored, so space is O(n).",
        uses: [
            "One-dimensional heat and diffusion equation solvers",
            "Cubic spline interpolation systems",
            "Tridiagonal systems from finite-difference and finite-volume methods",
        ],
        references: [
            "Thomas, Elliptic Problems in Linear Differential Equations, 1949",
            "Numerical Recipes, Chapter 2 (Solution of Linear Algebraic Equations)",
        ],
        workedExample:
            "For the system with main diagonal 4, lower and upper diagonals minus one, and right-hand side [2,4,6,8,16], the forward sweep updates each diagonal from the row above and the solution is read back as [1,2,3,4,5]. Substituting each value into its equation reproduces the right-hand side exactly.",
    },
    id: "thomas-algorithm",
    name: "Thomas Algorithm (Tridiagonal Solver)",
    category: "numerical-optimization",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        lower: [-1, -1, -1, -1],
        main: [4, 4, 4, 4, 4],
        upper: [-1, -1, -1, -1],
        rhs: [2, 4, 6, 8, 16],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "copy the main diagonal and right-hand side into working arrays",
        "for each row i from one to n minus one",
        "compute the multiplier lower[i-1] divided by the working diagonal at i-1",
        "subtract the multiplier times upper[i-1] from the diagonal and rhs at i",
        "set the last unknown to its rhs divided by the working diagonal",
        "for each row i from n minus two down to zero",
        "subtract upper[i] times the next unknown and divide by the diagonal",
        "done: report the solution and its maximum equation residual",
    ],
};

export default module;
