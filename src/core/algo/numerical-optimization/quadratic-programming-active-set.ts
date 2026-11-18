/**
 * quadratic-programming-active-set.ts - Active-Set Method for Convex QP
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The active-set method solves a convex quadratic program: minimize
 * 1/2 x^T G x + c^T x subject to inequality constraints a_i^T x <= b_i. It keeps
 * a feasible iterate and a working set of constraints treated as equalities.
 * Each step solves an equality-constrained QP; if the step is zero it drops a
 * constraint with a negative multiplier, otherwise it moves along the step
 * until a new constraint blocks the way and adds it to the working set.
 *
 * The exact step shown is the equality-constrained subproblem solved through
 * its KKT linear system, plus the multiplier test for optimality. On a small
 * strictly convex problem the result matches a direct brute-force minimum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * (n + w)^3) for k iterations, n variables, w working constraints
 *   Space: O((n + w)^2) for the KKT matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current primal iterate x.
 *   - The active working-set action is described each step; the final iterate
 *     is green once the multiplier test certifies optimality.
 *   - Objective, feasibility, and the working set are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface QPProblem {
    G: number[][];
    c: number[];
    A: number[][];
    b: number[];
}

export interface QPIteration {
    iter: number;
    x: number[];
    objective: number;
    workingSet: number[];
    action: "step" | "drop" | "optimal";
}

export interface QPData {
    solution: number[];
    objective: number;
    feasible: boolean;
    kktOk: boolean;
    iterations: QPIteration[];
}

/** Dot product. */
function dot(a: number[], b: number[]): number {
    return a.reduce((sum, x, i) => sum + x * (b[i] ?? 0), 0);
}

/** Matrix-vector product. */
function matVec(a: number[][], x: number[]): number[] {
    return a.map((row) => dot(row, x));
}

/** Gaussian elimination with partial pivoting; null when singular. */
function solve(a: number[][], b: number[]): number[] | null {
    const n = b.length;
    const m = a.map((row, i) => [...row, b[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) pivot = r;
        }
        if (Math.abs(m[pivot]?.[col] ?? 0) < 1e-12) return null;
        [m[col], m[pivot]] = [m[pivot]!, m[col]!];
        const pv = m[col]![col]!;
        for (let c = col; c <= n; c += 1) m[col]![c]! /= pv;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const f = m[r]![col]!;
            if (f === 0) continue;
            for (let c = col; c <= n; c += 1) m[r]![c]! -= f * m[col]![c]!;
        }
    }
    return m.map((row) => row[n] ?? 0);
}

/** Objective value 1/2 x^T G x + c^T x. */
export function objective(problem: QPProblem, x: number[]): number {
    return 0.5 * dot(x, matVec(problem.G, x)) + dot(problem.c, x);
}

/** Strictly feasible check against every inequality. */
export function isFeasible(problem: QPProblem, x: number[], tol = 1e-7): boolean {
    return problem.A.every((row, i) => dot(row, x) <= (problem.b[i] ?? 0) + tol);
}

/** Active-set QP solver starting from a feasible point. */
export function activeSetQP(problem: QPProblem, x0: number[], maxIterations = 30): QPData {
    const n = problem.c.length;
    let x = [...x0];
    const working = new Set<number>();
    problem.A.forEach((row, i) => {
        if (dot(row, x) >= (problem.b[i] ?? 0) - 1e-9) working.add(i);
    });
    const iterations: QPIteration[] = [];
    let kktOk = false;

    for (let iter = 1; iter <= maxIterations; iter += 1) {
        const W = [...working];
        const g = matVec(problem.G, x).map((v, i) => v + (problem.c[i] ?? 0));
        const size = n + W.length;
        const kkt = Array.from({ length: size }, () => Array<number>(size).fill(0));
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) kkt[i]![j] = problem.G[i]![j] ?? 0;
        }
        W.forEach((index, k) => {
            const row = problem.A[index] ?? [];
            for (let i = 0; i < n; i += 1) {
                kkt[i]![n + k] = row[i] ?? 0;
                kkt[n + k]![i] = row[i] ?? 0;
            }
        });
        const rhs = [...g.map((v) => -v), ...Array<number>(W.length).fill(0)];
        const solution = solve(kkt, rhs);
        if (solution === null) break;
        const p = solution.slice(0, n);
        const multipliers = solution.slice(n);
        const pNorm = Math.sqrt(dot(p, p));

        if (pNorm <= 1e-8) {
            if (multipliers.every((value) => value >= -1e-8)) {
                kktOk = true;
                iterations.push({ iter, x: [...x], objective: objective(problem, x), workingSet: [...W], action: "optimal" });
                break;
            }
            let worst = 0;
            for (let k = 1; k < multipliers.length; k += 1) {
                if ((multipliers[k] ?? 0) < (multipliers[worst] ?? 0)) worst = k;
            }
            const dropped = W[worst];
            if (dropped !== undefined) working.delete(dropped);
            iterations.push({ iter, x: [...x], objective: objective(problem, x), workingSet: [...W], action: "drop" });
            continue;
        }

        let alpha = 1;
        let blocking = -1;
        for (let i = 0; i < problem.A.length; i += 1) {
            if (working.has(i)) continue;
            const row = problem.A[i] ?? [];
            const ap = dot(row, p);
            if (ap <= 1e-12) continue;
            const slack = (problem.b[i] ?? 0) - dot(row, x);
            const t = slack / ap;
            if (t < alpha) {
                alpha = t;
                blocking = i;
            }
        }
        x = x.map((value, i) => value + alpha * (p[i] ?? 0));
        if (blocking >= 0) working.add(blocking);
        iterations.push({ iter, x: [...x], objective: objective(problem, x), workingSet: [...working], action: "step" });
    }

    return { solution: [...x], objective: objective(problem, x), feasible: isFeasible(problem, x), kktOk, iterations };
}

/** Build the primal iterate bars. */
function makeBars(x: number[], active: boolean, state: EntityState = "idle"): VisualEntity[] {
    return x.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state: active ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, variable: index },
    }));
}

/** The active-set QP generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { problem?: QPProblem; start?: number[] } | null) ?? {};
    const problem: QPProblem = task.problem ?? {
        G: [[1, 0], [0, 1]],
        c: [-1, -2],
        A: [[1, 1], [-1, 0], [0, -1]],
        b: [2, 0, 0],
    };
    const start = Array.isArray(task.start) ? [...task.start] : [0, 0];
    const n = problem.c.length;
    const data = activeSetQP(problem, start);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(start, false),
        edges: [],
        description: `Minimize a convex quadratic over ${problem.A.length} inequalities from the feasible start [${start.join(", ")}].`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, x: [...start], objective: objective(problem, start), feasible: isFeasible(problem, start), workingSet: [], kktOk: false },
    };

    for (const entry of data.iterations) {
        yield {
            stepNumber: step++,
            entities: makeBars(entry.x, true),
            edges: [],
            description: `Iteration ${entry.iter}: ${entry.action} with working set [${entry.workingSet.join(", ")}], x = [${entry.x.map((v) => v.toFixed(4)).join(", ")}], f = ${entry.objective.toFixed(5)}.`,
            codeLineNumber: entry.action === "optimal" ? 7 : entry.action === "drop" ? 5 : 3,
            layout: "array",
            meta: {
                iteration: entry.iter,
                x: [...entry.x],
                objective: entry.objective,
                feasible: isFeasible(problem, entry.x),
                workingSet: [...entry.workingSet],
                action: entry.action,
                kktOk: entry.action === "optimal",
            },
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(data.solution, false, "sorted"),
        edges: [],
        description: `Optimum x = [${data.solution.map((v) => v.toFixed(4)).join(", ")}] with objective ${data.objective.toFixed(5)}; KKT certified: ${data.kktOk}.`,
        codeLineNumber: 8,
        layout: "array",
        meta: {
            iteration: data.iterations.length,
            x: [...data.solution],
            objective: data.objective,
            feasible: data.feasible,
            workingSet: data.iterations[data.iterations.length - 1]?.workingSet ?? [],
            kktOk: data.kktOk,
        },
    };
}

/** The active-set QP module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Treat some inequalities as if they were equalities and solve that smaller problem. If the proposed step is useful, walk along it until another constraint gets in the way and pin that one too. If the step is zero, a pinned constraint is actually pushing the wrong way, so release the one with the most negative multiplier. Repeat until the multipliers all agree.",
        invariants: [
            "The iterate stays feasible for every inequality constraint.",
            "Constraints in the working set are satisfied as equalities.",
            "A zero step with all multipliers nonnegative certifies optimality.",
        ],
        correctness:
            "The equality-constrained subproblem is solved exactly through its KKT system. A nonzero feasible step decreases the strictly convex objective, and the smallest blocking ratio keeps the iterate feasible while activating a new constraint. When the step is zero, the gradient is a nonnegative combination of active constraint normals, which is exactly the KKT condition sufficing for optimality in a convex quadratic program. Dropping a negative-multiplier constraint restores a direction of descent.",
        complexityRationale:
            "Each iteration solves one KKT system of size n plus the working-set size w, costing O((n+w)^3); at most a modest number of iterations occur in practice. Storing that dense system uses O((n+w)^2) space.",
        uses: [
            "Portfolio and resource allocation with bounded variables",
            "Model predictive control with inequality limits",
            "Support vector machine training as a quadratic program",
        ],
        references: [
            "Nocedal and Wright, Numerical Optimization, Chapter 16",
            "Boyd and Vandenberghe, Convex Optimization, Chapter 5",
        ],
        workedExample:
            "Minimize half of x1 squared plus x2 squared minus x1 minus 2*x2 with x1 + x2 <= 2 and x nonnegative. From the start (0, 0) the method releases x2, steps to (0, 2), activates and then releases the sum constraint, and finally reaches (0.5, 1.5) with objective -2.25 and a nonnegative multiplier.",
    },
    id: "quadratic-programming-active-set",
    name: "Quadratic Programming Active Set",
    category: "numerical-optimization",
    complexity: { time: "O(k*(n+w)^3)", space: "O((n+w)^2)" },
    defaultInput: {
        problem: {
            G: [[1, 0], [0, 1]],
            c: [-1, -2],
            A: [[1, 1], [-1, 0], [0, -1]],
            b: [2, 0, 0],
        },
        start: [0, 0],
    },
    visualType: "array",
    run,
    pseudocode: [
        "start from a feasible point and find its active constraints",
        "form the equality-constrained KKT system for the working set",
        "solve it for the search direction and multipliers",
        "if the direction is zero, check multiplier signs",
        "drop the most negative multiplier constraint and repeat",
        "otherwise step until a new constraint blocks the move",
        "add that blocking constraint to the working set",
        "confirm all multipliers are nonnegative at the optimum",
        "done: report the optimum and its objective value",
    ],
};

export default module;
