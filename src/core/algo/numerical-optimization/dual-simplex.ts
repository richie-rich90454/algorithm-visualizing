/**
 * dual-simplex.ts - Dual Simplex Method for Linear Programming
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The dual simplex method solves a linear program while keeping the dual
 * solution feasible and working toward primal feasibility. It is the method
 * of choice when a problem starts dual feasible but primal infeasible, as is
 * the case for min c^T x subject to A x >= b with c >= 0 and b >= 0. Each pivot
 * removes one negative basic variable while preserving nonpositive reduced
 * costs, until every basic variable is nonnegative.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(pivots * m * (n + m)) for tableau row operations
 *   Space: O(m * (n + m)) for the tableau
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current basic solution (structural variables first).
 *   - The leaving variable is red and the entering variable is yellow.
 *   - The metadata reports the objective value and pivot count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const EPS = 1e-9;

interface Lp {
    c: number[];
    A: number[][];
    b: number[];
}

function validLp(lp: Lp): boolean {
    if (!Array.isArray(lp.c) || lp.c.length === 0) return false;
    if (!Array.isArray(lp.b) || lp.b.length === 0) return false;
    if (!Array.isArray(lp.A) || lp.A.length !== lp.b.length) return false;
    return lp.A.every((row) => Array.isArray(row) && row.length === lp.c.length && row.every(Number.isFinite))
        && lp.c.every(Number.isFinite)
        && lp.b.every(Number.isFinite);
}

function makeBars(
    solution: number[],
    leaving: number,
    entering: number,
    optimal: boolean,
): VisualEntity[] {
    return solution.map((value, index) => {
        let state: EntityState = "idle";
        if (optimal) state = "sorted";
        else if (index === leaving) state = "error";
        else if (index === entering) state = "comparing";
        else if (value > EPS) state = "visited";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index },
        };
    });
}

/** The dual simplex generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { c?: number[]; A?: number[][]; b?: number[] } | null) ?? {};
    const candidate: Lp = {
        c: Array.isArray(task.c) ? [...task.c] : [],
        A: Array.isArray(task.A) ? task.A.map((row) => (Array.isArray(row) ? [...row] : [])) : [],
        b: Array.isArray(task.b) ? [...task.b] : [],
    };
    const lp = validLp(candidate)
        ? candidate
        : {
              c: [2, 3],
              A: [
                  [1, 1],
                  [1, 2],
              ],
              b: [4, 6],
          };
    const n = lp.c.length;
    const m = lp.b.length;
    const width = n + m + 1;
    const T: number[][] = Array.from({ length: m + 1 }, () => Array.from({ length: width }, () => 0));
    for (let row = 0; row < m; row += 1) {
        for (let col = 0; col < n; col += 1) {
            T[row]![col] = -(lp.A[row]![col] ?? 0);
        }
        T[row]![n + row] = 1;
        T[row]![width - 1] = -(lp.b[row] ?? 0);
    }
    for (let col = 0; col < n; col += 1) {
        T[m]![col] = lp.c[col] ?? 0;
    }
    const basicVars: number[] = Array.from({ length: m }, (_, index) => n + index);

    function currentSolution(): number[] {
        const solution = Array.from({ length: n + m }, () => 0);
        for (let row = 0; row < m; row += 1) {
            solution[basicVars[row]!] = T[row]![width - 1]!;
        }
        return solution;
    }

    let step = 0;
    let pivots = 0;
    let optimal = false;
    let infeasible = false;
    let leavingCol = -1;
    let enteringCol = -1;
    yield {
        stepNumber: step,
        entities: makeBars(currentSolution(), -1, -1, false),
        edges: [],
        description: `Setting up the dual simplex tableau for a problem with ${n} variable(s) and ${m} constraint(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, objective: 0, pivots: 0, infeasible: false, optimal: false, solution: currentSolution() },
    };
    step += 1;

    for (let iteration = 0; iteration < 200; iteration += 1) {
        let leavingRow = -1;
        let smallest = -EPS;
        for (let row = 0; row < m; row += 1) {
            if ((T[row]![width - 1] ?? 0) < smallest) {
                smallest = T[row]![width - 1]!;
                leavingRow = row;
            }
        }
        if (leavingRow === -1) {
            optimal = true;
            break;
        }

        leavingCol = basicVars[leavingRow]!;
        let bestRatio = Number.POSITIVE_INFINITY;
        enteringCol = -1;
        for (let col = 0; col < n + m; col += 1) {
            const coefficient = T[leavingRow]![col] ?? 0;
            if (coefficient < -EPS) {
                const ratio = (T[m]![col] ?? 0) / -coefficient;
                if (ratio < bestRatio - EPS || (Math.abs(ratio - bestRatio) < EPS && col < enteringCol)) {
                    bestRatio = ratio;
                    enteringCol = col;
                }
            }
        }
        if (enteringCol === -1) {
            infeasible = true;
            yield {
                stepNumber: step,
                entities: makeBars(currentSolution(), leavingCol, -1, false),
                edges: [],
                description: `No entering column can repair negative basic variable ${leavingCol}; the problem is infeasible.`,
                codeLineNumber: 4,
                layout: "array",
                meta: { iteration: iteration + 1, objective: -T[m]![width - 1]!, pivots, infeasible: true, optimal: false, solution: currentSolution() },
            };
            step += 1;
            break;
        }

        const pivot = T[leavingRow]![enteringCol]!;
        for (let col = 0; col < width; col += 1) {
            T[leavingRow]![col] = T[leavingRow]![col]! / pivot;
        }
        for (let row = 0; row <= m; row += 1) {
            if (row === leavingRow) continue;
            const factor = T[row]![enteringCol] ?? 0;
            if (Math.abs(factor) < EPS) continue;
            for (let col = 0; col < width; col += 1) {
                T[row]![col] = T[row]![col]! - factor * T[leavingRow]![col]!;
            }
        }
        basicVars[leavingRow] = enteringCol;
        pivots += 1;
        const solution = currentSolution();
        yield {
            stepNumber: step,
            entities: makeBars(solution, -1, enteringCol, false),
            edges: [],
            description: `Pivot ${pivots}: variable ${enteringCol} enters and variable ${leavingCol} leaves; objective estimate ${(-T[m]![width - 1]!).toFixed(4)}.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { iteration: iteration + 1, objective: -T[m]![width - 1]!, pivots, infeasible: false, optimal: false, solution },
        };
        step += 1;
    }

    const objective = -T[m]![width - 1]!;
    yield {
        stepNumber: step,
        entities: makeBars(currentSolution(), -1, -1, optimal),
        edges: [],
        description: infeasible
            ? "The dual simplex run detected infeasibility."
            : `Optimal solution found with objective ${objective.toFixed(6)} after ${pivots} pivot(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { iteration: pivots, objective, pivots, infeasible, optimal, solution: currentSolution() },
    };
}

/** The dual simplex module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The dual simplex method is a mirror image of the primal simplex method. It keeps a solution that is optimal for the dual problem but temporarily infeasible for the primal problem. Each pivot chooses the most violated constraint and trades it for a variable that repairs feasibility without destroying dual optimality, until a genuine feasible optimum appears.",
        invariants: [
            "All reduced costs in the objective row remain nonnegative, so the dual stays feasible.",
            "Each pivot makes the chosen leaving basic variable nonnegative.",
            "The objective estimate stays bounded and converges to the primal optimum.",
        ],
        correctness:
            "The leaving-row rule selects a negative basic variable. The minimum-ratio test over columns with a negative pivot element picks an entering variable whose reduced-cost ratio is smallest, which is exactly the step that preserves dual feasibility while driving the leaving variable to a nonnegative value. This is primal simplex applied to the dual linear program, so when all basic variables are nonnegative both primal and dual are feasible and their equal objectives certify optimality by strong duality.",
        complexityRationale:
            "Each pivot updates every row of the tableau, costing O(m * (n + m)) arithmetic. The number of pivots is small in practice but can be exponential in the worst case. The tableau itself occupies O(m * (n + m)) space.",
        uses: [
            "Reoptimizing a linear program after adding a constraint",
            "Branch-and-bound nodes in mixed-integer programming",
            "Solving cover and set-covering relaxations in operations research",
        ],
        references: [
            "Dantzig, Linear Programming and Extensions, Chapter 8",
            "Bertsimas and Tsitsiklis, Introduction to Linear Optimization, Chapter 5",
        ],
        workedExample:
            "Minimize 2x1 + 3x2 subject to x1 + x2 >= 4 and x1 + 2x2 >= 6. The starting basis makes both slack variables negative. Two dual simplex pivots bring basic variables to x1 = 2 and x2 = 2 with objective 10, which is the known optimum.",
    },
    id: "dual-simplex",
    name: "Dual Simplex",
    category: "numerical-optimization",
    complexity: { time: "O(pivots * m * (n + m))", space: "O(m * (n + m))" },
    defaultInput: {
        c: [2, 3],
        A: [
            [1, 1],
            [1, 2],
        ],
        b: [4, 6],
    },
    visualType: "array",
    run,
    pseudocode: [
        "build a tableau with surplus variables as the initial basis",
        "find the most negative basic variable as the leaving row",
        "if none is negative, the current solution is optimal",
        "among negative entries in that row pick the smallest reduced-cost ratio",
        "pivot to bring the entering variable into the basis",
        "repeat until every basic variable is nonnegative",
        "done: report the basic solution and optimal objective",
    ],
};

export default module;
