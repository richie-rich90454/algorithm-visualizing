/**
 * revised-simplex.ts - Revised Simplex Method for a Small Linear Program
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The revised simplex solves maximize c^T x subject to A x <= b, x >= 0 more
 * efficiently than the tableau form: instead of carrying the whole tableau it
 * stores only the current basis and its inverse. Each iteration computes
 * reduced costs, picks the most negative one as the entering variable, performs
 * a minimum-ratio test to choose the leaving variable, and updates the basis.
 *
 * This teaching implementation assumes b >= 0 so the slack variables form an
 * initial feasible basis (no Phase I); it solves small dense problems only.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(K * m^3 + K * m * n) for K iterations, m constraints, n variables
 *   Space: O(m^2 + m * n) for the basis inverse and the constraint matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per variable (original plus slack) shows its current value.
 *   - The entering variable is highlighted and the leaving one is marked swapped.
 *   - Metadata reports the basis, reduced costs, and the optimal objective.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SimplexInput {
    A?: number[][];
    b?: number[];
    c?: number[];
}

function matVec(M: number[][], v: number[]): number[] {
    return M.map((row) => row.reduce((sum, x, j) => sum + x * (v[j] ?? 0), 0));
}

/** Gauss-Jordan inverse of a small square matrix, or null if singular. */
function inverse(M: number[][]): number[][] | null {
    const n = M.length;
    const aug = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(aug[r]![col]!) > Math.abs(aug[pivot]![col]!)) pivot = r;
        }
        if (Math.abs(aug[pivot]![col]!) < 1e-12) return null;
        [aug[col], aug[pivot]] = [aug[pivot]!, aug[col]!];
        const div = aug[col]![col]!;
        for (let c = 0; c < 2 * n; c += 1) aug[col]![c] = aug[col]![c]! / div;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const factor = aug[r]![col]!;
            for (let c = 0; c < 2 * n; c += 1) aug[r]![c] = aug[r]![c]! - factor * aug[col]![c]!;
        }
    }
    return aug.map((row) => row.slice(n));
}

function makeEntities(values: number[], entering: number, leaving: number, n: number): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (index === entering) state = "comparing";
        else if (index === leaving) state = "swapped";
        return {
            id: `var-${index}`,
            type: "cell",
            label: index < n ? `x${index + 1}=${value.toFixed(2)}` : `s${index - n + 1}=${value.toFixed(2)}`,
            value,
            state,
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { col: index, row: 0, index, kind: index < n ? "original" : "slack", value },
        };
    });
}

/** The revised simplex generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SimplexInput | null) ?? {};
    const A = Array.isArray(task.A) && task.A.length > 0
        ? task.A.map((row) => [...row])
        : [[1, 1], [1, 0], [0, 1]];
    const m = A.length;
    const n = A[0]?.length ?? 2;
    const b = Array.isArray(task.b) && task.b.length === m ? [...task.b] : [4, 3, 3];
    const c = Array.isArray(task.c) && task.c.length === n ? [...task.c] : [3, 5];
    const totalVars = n + m;

    // Build the standard-form matrix [A | I] and cost [c | 0].
    const Abar = Array.from({ length: m }, (_, i) =>
        Array.from({ length: totalVars }, (_, j) => {
            if (j < n) return A[i]![j] ?? 0;
            return j - n === i ? 1 : 0;
        }),
    );
    const cbar = [...c, ...Array.from({ length: m }, () => 0)];
    const basis = Array.from({ length: m }, (_, i) => n + i);
    const values = Array.from({ length: totalVars }, () => 0);

    const column = (j: number) => Abar.map((row) => row[j] ?? 0);
    let optimal = false;
    let unbounded = false;
    let objective = 0;
    let iterations = 0;

    yield {
        stepNumber: 0,
        entities: makeEntities(values, -1, -1, n),
        edges: [],
        description: `Standard form: ${totalVars} variables (${n} original, ${m} slack); the slacks start as the feasible basis.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, m, totalVars, basis: [...basis], entering: -1, leaving: -1, objective: 0, optimal: false, rows: 1, cols: totalVars },
    };
    let step = 1;

    if (b.some((v) => v < 0)) {
        yield {
            stepNumber: step,
            entities: makeEntities(values, -1, -1, n),
            edges: [],
            description: "A negative right-hand-side entry needs a Phase I setup; this teaching version assumes b >= 0.",
            codeLineNumber: 5,
            layout: "grid",
            meta: { n, m, totalVars, basis: [...basis], entering: -1, leaving: -1, objective: 0, optimal: false, needsPhaseOne: true, rows: 1, cols: totalVars },
        };
        return;
    }

    for (let iter = 0; iter < 100; iter += 1) {
        iterations = iter + 1;
        const B = transpose(basis.map((j) => column(j)));
        const Binv = inverse(B);
        if (!Binv) {
            unbounded = true;
            break;
        }
        const xB = matVec(Binv, b);
        for (let i = 0; i < m; i += 1) values[basis[i]!] = xB[i]!;
        const cB = basis.map((j) => cbar[j]!);
        const y = matVec(transpose(Binv), cB);

        const reduced = Array.from({ length: totalVars }, () => 0);
        const inBasis = new Set(basis);
        for (let j = 0; j < totalVars; j += 1) {
            if (inBasis.has(j)) continue;
            const col = column(j);
            reduced[j] = cbar[j]! - y.reduce((sum, yi, i) => sum + yi * col[i]!, 0);
        }
        let entering = -1;
        for (let j = 0; j < totalVars; j += 1) {
            if (inBasis.has(j)) continue;
            if (entering === -1 || (reduced[j] ?? 0) > (reduced[entering] ?? 0) + 1e-12) entering = j;
        }
        if (entering === -1 || (reduced[entering] ?? 0) <= 1e-12) {
            optimal = true;
            objective = basis.reduce((sum, j, i) => sum + cbar[j]! * (xB[i] ?? 0), 0);
            break;
        }

        const d = matVec(Binv, column(entering));
        let leavingRow = -1;
        let bestRatio = Number.POSITIVE_INFINITY;
        for (let i = 0; i < m; i += 1) {
            if (d[i]! > 1e-12) {
                const ratio = (xB[i] ?? 0) / d[i]!;
                if (ratio < bestRatio) {
                    bestRatio = ratio;
                    leavingRow = i;
                }
            }
        }
        if (leavingRow === -1) {
            unbounded = true;
            break;
        }
        const leaving = basis[leavingRow]!;
        basis[leavingRow] = entering;
        values[entering] = bestRatio;
        values[leaving] = 0;

        yield {
            stepNumber: step,
            entities: makeEntities(values, entering, leaving, n),
            edges: [],
            description: `Iteration ${iterations}: variable ${labelVar(entering, n)} enters, ${labelVar(leaving, n)} leaves (ratio ${bestRatio.toFixed(3)}).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                n,
                m,
                totalVars,
                basis: [...basis],
                entering,
                leaving,
                objective,
                optimal: false,
                reducedCosts: reduced,
                rows: 1,
                cols: totalVars,
            },
        };
        step += 1;
    }

    if (optimal) {
        const originalX = Array.from({ length: n }, (_, j) => values[j] ?? 0);
        yield {
            stepNumber: step,
            entities: makeEntities(values, -1, -1, n),
            edges: [],
            description: `Optimal solution found in ${iterations} pivot(s): objective ${objective.toFixed(6)}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                n,
                m,
                totalVars,
                basis: [...basis],
                entering: -1,
                leaving: -1,
                objective,
                optimal: true,
                solution: originalX,
                iterations,
                rows: 1,
                cols: totalVars,
                done: true,
            },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeEntities(values, -1, -1, n),
            edges: [],
            description: unbounded
                ? "The objective is unbounded above in this direction."
                : "Stopped at the iteration limit without reaching optimality.",
            codeLineNumber: 5,
            layout: "grid",
            meta: { n, m, totalVars, basis: [...basis], entering: -1, leaving: -1, objective, optimal: false, unbounded, rows: 1, cols: totalVars, done: true },
        };
    }
}

function transpose(M: number[][]): number[][] {
    const rows = M.length;
    const cols = M[0]?.length ?? 0;
    return Array.from({ length: cols }, (_, j) => Array.from({ length: rows }, (_, i) => M[i]![j]!));
}

function labelVar(j: number, n: number): string {
    return j < n ? `x${j + 1}` : `s${j - n + 1}`;
}

/** The revised simplex module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A linear program's optimum sits at a corner of the feasible region, which corresponds to a set of basic variables. Revised simplex walks from corner to corner: it uses the reduced costs to decide which variable should enter, a ratio test to decide which one must leave, and keeps only the current basis inverse rather than a full tableau.",
        invariants: [
            "Every basis matrix is invertible and its basic solution is feasible with nonnegative values.",
            "The reduced cost of a variable measures how much the objective would improve per unit increase.",
            "A pivot keeps feasibility while strictly increasing the objective for a nondegenerate step.",
        ],
        correctness:
            "When no reduced cost is positive no nonbasic variable can improve the objective, so the current basic feasible solution is optimal by the simplex optimality condition. The minimum-ratio test keeps every basic variable nonnegative, so each pivot lands on another feasible corner. With a nondegenerate problem and anticycling, the objective increases each step and the finite set of corners guarantees termination at the optimum.",
        complexityRationale:
            "Each iteration inverts an m-by-m basis matrix, O(m^3), and computes reduced costs from m-by-m and m-by-n products, O(m*n). With K pivots the total is O(K*(m^3 + m*n)) time and O(m^2 + m*n) space.",
        uses: [
            "Resource allocation and production planning",
            "Supply-chain and transportation optimization",
            "The LP relaxation inside branch-and-bound integer programming",
        ],
        references: [
            "Dantzig, Linear Programming and Extensions, Chapter 5",
            "Nocedal and Wright, Numerical Optimization, Chapter 13",
        ],
        workedExample:
            "Maximize 3x1 + 5x2 with x1 + x2 <= 4, x1 <= 3, x2 <= 3. Starting from slacks, the most negative reduced cost brings x2 in, then x1, reaching x1 = 1, x2 = 3 and objective 18 after the final reduced costs all turn nonnegative.",
    },
    id: "revised-simplex",
    name: "Revised Simplex",
    category: "numerical-optimization",
    complexity: { time: "O(K * (m^3 + m * n))", space: "O(m^2 + m * n)" },
    defaultInput: {
        A: [[1, 1], [1, 0], [0, 1]],
        b: [4, 3, 3],
        c: [3, 5],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "add slack variables to convert inequalities to equalities",
        "start with the slack variables as the basis",
        "compute the basis inverse and the reduced costs",
        "choose the entering variable with the largest positive reduced cost",
        "use the minimum-ratio test to pick the leaving variable",
        "pivot by replacing the leaving variable in the basis",
        "stop when no reduced cost is positive",
        "done: report the optimal basic solution",
    ],
};

export default module;
