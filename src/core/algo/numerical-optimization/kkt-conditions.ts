/**
 * kkt-conditions.ts - KKT Conditions via the Active-Set QP Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Karush-Kuhn-Tucker conditions characterize the optimum of a smooth
 * convex problem with constraints: stationarity of the Lagrangian, primal
 * feasibility, dual feasibility of the inequality multipliers, and
 * complementary slackness. This module solves the convex quadratic program
 * minimize 0.5 x^T Q x + c^T x subject to A x = b and x >= 0 with the active-set
 * method. It repeatedly solves the equality-constrained KKT system for a guess
 * of which inequalities are tight, adding variables that go negative and
 * dropping multipliers that go negative, until all four conditions hold.
 *
 * The model is exact small-scale linear algebra. It is not a general nonlinear
 * optimizer, assumes Q is positive definite and A has full row rank, and does
 * not implement a warm start or degeneracy cycling safeguards.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * (d+m)^3) for d variables and m equality constraints
 *   Space: O((d+m)^2) for the KKT linear system
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per variable shows the current KKT point estimate.
 *   - Trial points are yellow; the verified KKT point is green.
 *   - meta carries the iterate, active set, multipliers, and four residuals.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

/** Solve a small dense linear system by Gaussian elimination with partial pivoting. */
function solveLinear(matrix: number[][], rhs: number[]): number[] | null {
    const n = rhs.length;
    const a = matrix.map((row, i) => [...row, rhs[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(a[row]![col] ?? 0) > Math.abs(a[pivot]![col] ?? 0)) {
                pivot = row;
            }
        }
        if (Math.abs(a[pivot]![col] ?? 0) < 1e-12) {
            return null;
        }
        [a[col], a[pivot]] = [a[pivot]!, a[col]!];
        const pivotValue = a[col]![col]!;
        for (let j = col; j <= n; j += 1) {
            a[col]![j] = (a[col]![j] ?? 0) / pivotValue;
        }
        for (let row = 0; row < n; row += 1) {
            if (row === col) {
                continue;
            }
            const factor = a[row]![col] ?? 0;
            if (factor === 0) {
                continue;
            }
            for (let j = col; j <= n; j += 1) {
                a[row]![j] = (a[row]![j] ?? 0) - factor * (a[col]![j] ?? 0);
            }
        }
    }
    return a.map((row) => row[n] ?? 0);
}

/** Build bars for the current iterate. */
function makeBars(vector: number[], state: EntityState): VisualEntity[] {
    return vector.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `x${index}=${value.toFixed(4)}`,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** The active-set KKT generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { Q?: number[][]; c?: number[]; A?: number[][]; b?: number[]; start?: number[]; maxIter?: number }
        | null
    ) ?? {};
    const Q: number[][] =
        Array.isArray(task.Q) && task.Q.length > 0
            ? task.Q.map((row) => (Array.isArray(row) ? [...row] : []))
            : [
                  [2, 0],
                  [0, 2],
              ];
    const d = Q.length;
    const c: number[] = Array.isArray(task.c) && task.c.length === d ? [...task.c] : [-2, -4];
    const A: number[][] = Array.isArray(task.A) && task.A.length > 0
        ? task.A.map((row) => (Array.isArray(row) ? [...row] : []))
        : [[1, 1]];
    const m = A.length;
    const b: number[] = Array.isArray(task.b) && task.b.length === m ? [...task.b] : [2];
    const start: number[] = Array.isArray(task.start) && task.start.length === d ? [...task.start] : Array.from({ length: d }, () => 0);
    const maxIter = Math.min(50, Math.max(1, Math.floor(Number(task.maxIter ?? 20)) || 20));

    // The gradient is Q x + c componentwise.
    const gradient = (x: number[]) => Q.map((row, i) => dot(row, x) + (c[i] ?? 0));

    let x = [...start];
    let lambda: number[] = Array.from({ length: m }, () => 0);
    let mu: number[] = Array.from({ length: d }, () => 0);
    let active: boolean[] = Array.from({ length: d }, () => false);
    let converged = false;
    let used = 0;

    const residuals = () => {
        const g = gradient(x);
        let stationarity = 0;
        for (let i = 0; i < d; i += 1) {
            let eq = g[i] ?? 0;
            for (let e = 0; e < m; e += 1) {
                eq += (A[e]?.[i] ?? 0) * (lambda[e] ?? 0);
            }
            eq -= mu[i] ?? 0;
            stationarity = Math.max(stationarity, Math.abs(eq));
        }
        let primalEq = 0;
        for (let e = 0; e < m; e += 1) {
            primalEq = Math.max(primalEq, Math.abs(dot(A[e] ?? [], x) - (b[e] ?? 0)));
        }
        let primalIneq = 0;
        let dual = 0;
        let comp = 0;
        for (let i = 0; i < d; i += 1) {
            primalIneq = Math.max(primalIneq, Math.max(0, -(x[i] ?? 0)));
            dual = Math.max(dual, Math.max(0, -(mu[i] ?? 0)));
            comp = Math.max(comp, Math.abs((mu[i] ?? 0) * (x[i] ?? 0)));
        }
        return { stationarity, primalEq, primalIneq, dual, comp };
    };

    const meta = (done: boolean) => {
        const r = residuals();
        return {
            d,
            m,
            iteration: used,
            x: [...x],
            lambda: [...lambda],
            mu: [...mu],
            active: active.map((flag) => (flag ? 1 : 0)),
            stationarity: r.stationarity,
            primalEq: r.primalEq,
            primalIneq: r.primalIneq,
            dual: r.dual,
            comp: r.comp,
            maxResidual: Math.max(r.stationarity, r.primalEq, r.primalIneq, r.dual, r.comp),
            converged: done,
        };
    };

    yield {
        stepNumber: 0,
        entities: makeBars(x, "idle"),
        edges: [],
        description: `Solving a convex QP with ${d} variables and ${m} equality constraint(s); check four KKT residual families.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(false),
    };
    let step = 1;

    for (let iteration = 0; iteration < maxIter && !converged; iteration += 1) {
        // Build the equality-constrained KKT system for the current active set.
        const activeIndices: number[] = [];
        for (let i = 0; i < d; i += 1) {
            if (active[i]) {
                activeIndices.push(i);
            }
        }
        const na = activeIndices.length;
        const size = d + m + na;
        const matrix: number[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
        const rhs: number[] = Array.from({ length: size }, () => 0);

        for (let i = 0; i < d; i += 1) {
            for (let j = 0; j < d; j += 1) {
                matrix[i]![j] = Q[i]?.[j] ?? 0;
            }
            for (let e = 0; e < m; e += 1) {
                matrix[i]![d + e] = A[e]?.[i] ?? 0;
                matrix[d + e]![i] = A[e]?.[i] ?? 0;
            }
            for (let k = 0; k < na; k += 1) {
                if (i === activeIndices[k]) {
                    // Stationarity is Qx + A^T lambda - mu = -c, so mu enters with a minus sign.
                    matrix[i]![d + m + k] = -1;
                    matrix[d + m + k]![i] = 1;
                }
            }
            rhs[i] = -(c[i] ?? 0);
        }
        for (let e = 0; e < m; e += 1) {
            rhs[d + e] = b[e] ?? 0;
        }

        const solution = solveLinear(matrix, rhs);
        if (!solution) {
            break;
        }
        const nextX = solution.slice(0, d);
        const nextLambda = solution.slice(d, d + m);
        const nextMu = Array.from({ length: d }, () => 0);
        for (let k = 0; k < na; k += 1) {
            nextMu[activeIndices[k]!] = solution[d + m + k] ?? 0;
        }

        x = nextX;
        lambda = nextLambda;
        mu = nextMu;
        used = iteration + 1;

        // Add an inactive variable that went negative.
        let addIndex = -1;
        let mostNegative = -1e-12;
        for (let i = 0; i < d; i += 1) {
            if (!active[i] && (x[i] ?? 0) < mostNegative) {
                mostNegative = x[i] ?? 0;
                addIndex = i;
            }
        }
        if (addIndex >= 0) {
            active[addIndex] = true;
        } else {
            // Otherwise drop an active multiplier that went negative.
            let dropIndex = -1;
            let worstMu = -1e-12;
            for (let k = 0; k < na; k += 1) {
                const i = activeIndices[k]!;
                if ((mu[i] ?? 0) < worstMu) {
                    worstMu = mu[i] ?? 0;
                    dropIndex = i;
                }
            }
            if (dropIndex >= 0) {
                active[dropIndex] = false;
            } else {
                converged = true;
            }
        }

        const r = residuals();
        yield {
            stepNumber: step,
            entities: makeBars(x, converged ? "sorted" : "comparing"),
            edges: [],
            description: `Iteration ${used}: active set {${activeIndices.join(",")}}, max KKT residual ${Math.max(r.stationarity, r.primalEq, r.primalIneq, r.dual, r.comp).toExponential(2)}${converged ? " - all conditions satisfied" : ""}.`,
            codeLineNumber: converged ? 6 : 3,
            layout: "array",
            meta: meta(converged),
        };
        step += 1;
    }

    // Final verification of the four KKT families.
    const r = residuals();
    converged = Math.max(r.stationarity, r.primalEq, r.primalIneq, r.dual, r.comp) < 1e-7;
    yield {
        stepNumber: step,
        entities: makeBars(x, converged ? "sorted" : "idle"),
        edges: [],
        description: converged
            ? `KKT point found at x = (${x.map((v) => v.toFixed(6)).join(", ")}); stationarity, primal, dual, and slackness residuals are all below tolerance.`
            : `No verified KKT point after ${used} iteration(s).`,
        codeLineNumber: 7,
        layout: "array",
        meta: meta(converged),
    };
}

/** The KKT conditions module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The KKT conditions are the checklist an optimum of a constrained smooth problem must pass. Stationarity says the gradients balance, primal feasibility says the point obeys the constraints, dual feasibility says the inequality multipliers are nonnegative, and complementary slackness says a multiplier is nonzero only when its inequality is tight. The active-set method guesses which inequalities are tight, solves the resulting equality problem, and revises the guess until every check passes.",
        invariants: [
            "The equality constraints A x = b hold at every linear-system solve.",
            "Variables in the active set are held at zero by an explicit multiplier.",
            "The active set changes only by adding a negative variable or dropping a negative multiplier.",
        ],
        correctness:
            "For convex Q with full-rank A, each active-set solve gives the unique minimizer over the current equality set. If a variable is negative, fixing it at zero cannot exclude the true optimum because the true optimum is nonnegative, so adding it preserves feasibility. If an active multiplier is negative, relaxing that bound lowers the objective, so dropping it is the correct move. When no variable is negative and all active multipliers are nonnegative, the four KKT conditions hold, which for a convex problem are sufficient for global optimality.",
        complexityRationale:
            "Each iteration solves one dense KKT system of size d plus m plus the active count, costing cubic time in that size. Storing the matrix and vectors uses quadratic space. The number of iterations is typically small and bounded here by a cap.",
        uses: [
            "Checking optimality of constrained engineering designs",
            "The theoretical foundation of support vector machines and portfolio optimization",
            "Subproblem solving in sequential quadratic programming",
        ],
        references: [
            "Karush, Minima of Functions of Several Variables with Inequalities as Side Conditions, 1939",
            "Nocedal and Wright, Numerical Optimization, Chapters 5 and 16",
        ],
        workedExample:
            "Minimize (x-1)^2 + (y-2)^2 with x + y = 2 and x, y >= 0. The projection of (1, 2) onto the line is (0.5, 1.5), where the gradient is (-1, -1). With multiplier lambda = 1 the stationarity residual is zero, both inequalities are inactive with zero multipliers, and all four KKT checks pass.",
    },
    id: "kkt-conditions",
    name: "KKT Conditions (Active-Set QP)",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * (d+m)^3)", space: "O((d+m)^2)" },
    defaultInput: {
        Q: [
            [2, 0],
            [0, 2],
        ],
        c: [-2, -4],
        A: [[1, 1]],
        b: [2],
        start: [0, 0],
        maxIter: 20,
    },
    visualType: "array",
    run,
    pseudocode: [
        "start with an empty active set and a trial point",
        "state the KKT system for the equality constraints and active bounds",
        "solve the linear system for the point and multipliers",
        "if any variable is negative add it to the active set",
        "otherwise if any active multiplier is negative drop that bound",
        "otherwise all four KKT conditions hold",
        "check stationarity, primal, dual, and complementary slackness",
        "repeat until every residual is below tolerance",
        "done: report the verified KKT point and residuals",
    ],
};

export default module;
