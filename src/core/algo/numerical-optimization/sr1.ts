/**
 * sr1.ts - Symmetric Rank-One Quasi-Newton Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The symmetric rank-one method builds an approximate Hessian for unconstrained
 * minimization using only gradients. After a step s with gradient change y, it
 * adds the single rank-one matrix r r^T over r^T s, where r = y minus the old
 * Hessian estimate times s. That update is the smallest symmetric change to the
 * Hessian that satisfies the secant equation B s = y. The search direction is
 * minus the inverse of B times the gradient, with an exact line search. On a
 * quadratic objective it reproduces the true Hessian in at most two dimensions
 * and reaches the minimizer in a few steps.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d^2) per iteration for a d by d Hessian, O(1) here for d = 2
 *   Space: O(d^2) for the dense Hessian estimate
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid holds one row per iteration with the point, gradient norm,
 *     update denominator, and whether the update was applied or skipped.
 *   - The current iteration is yellow; finished rows are green.
 *   - The final frame reports the minimizer and the secant residual.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix2 = [number, number, number, number];
type Vec2 = [number, number];

function matVec(m: Matrix2, v: Vec2): Vec2 {
    return [m[0] * v[0] + m[1] * v[1], m[2] * v[0] + m[3] * v[1]];
}

function dot(a: Vec2, b: Vec2): number {
    return a[0] * b[0] + a[1] * b[1];
}

function solve2(m: Matrix2, rhs: Vec2): Vec2 | null {
    const det = m[0] * m[3] - m[1] * m[2];
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
    return [(rhs[0] * m[3] - m[1] * rhs[1]) / det, (m[0] * rhs[1] - rhs[0] * m[2]) / det];
}

function makeCells(rows: Array<Array<number | string>>, active: number, finished: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const roles = ["iter", "x0", "x1", "grad", "denom", "action"];
    for (let r = 0; r < rows.length; r += 1) {
        for (let c = 0; c < roles.length; c += 1) {
            const value = rows[r]?.[c] ?? 0;
            const state: EntityState = finished ? "sorted" : r === active ? "comparing" : r < active ? "sorted" : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: typeof value === "string" ? value : value.toFixed(5),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, role: roles[c] ?? "value" },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { A?: number[][]; b?: number[]; x0?: number[]; iterations?: number } | null
    ) ?? {};
    const aRows = task.A;
    const a00 = aRows?.[0]?.[0];
    const a01 = aRows?.[0]?.[1];
    const a10 = aRows?.[1]?.[0];
    const a11 = aRows?.[1]?.[1];
    const validA = [a00, a01, a10, a11].every((v) => typeof v === "number" && Number.isFinite(v));
    const off = validA ? ((a01 as number) + (a10 as number)) / 2 : 1;
    const A: Matrix2 = validA ? [a00 as number, off, off, a11 as number] : [4, 1, 1, 3];
    const b: Vec2 = [
        typeof task.b?.[0] === "number" && Number.isFinite(task.b[0]) ? task.b[0] : 1,
        typeof task.b?.[1] === "number" && Number.isFinite(task.b[1]) ? task.b[1] : 2,
    ];
    const x0: Vec2 = [
        typeof task.x0?.[0] === "number" && Number.isFinite(task.x0[0]) ? task.x0[0] : 2,
        typeof task.x0?.[1] === "number" && Number.isFinite(task.x0[1]) ? task.x0[1] : -1,
    ];
    let x: Vec2 = [x0[0], x0[1]];
    const iterations = typeof task.iterations === "number" && Number.isFinite(task.iterations)
        ? Math.max(1, Math.min(12, Math.floor(task.iterations)))
        : 6;
    let B: Matrix2 = [1, 0, 0, 1];
    let gradNorm = Number.POSITIVE_INFINITY;
    let secantResidual = 0;
    let converged = false;
    let steps = 0;
    const rows: Array<Array<number | string>> = Array.from({ length: iterations }, (_, i) => [
        i,
        x[0],
        x[1],
        0,
        0,
        "pending",
    ]);
    const meta = (done: boolean) => ({
        A: [...A],
        b: [...b],
        x0: [...x0],
        iterations,
        x: [...x],
        gradientNorm: gradNorm,
        B: [...B],
        converged,
        secantResidual,
        steps,
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(rows, -1, false),
        edges: [],
        description: `Minimizing the quadratic with symmetric rank-one updates from (${x[0]}, ${x[1]}) for up to ${iterations} iterations.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(false),
    };

    let step = 1;
    for (let i = 0; i < iterations; i += 1) {
        const g: Vec2 = [A[0] * x[0] + A[1] * x[1] - b[0], A[2] * x[0] + A[3] * x[1] - b[1]];
        gradNorm = Math.hypot(g[0], g[1]);
        if (gradNorm < 1e-10) {
            converged = true;
            rows[i] = [i, x[0], x[1], gradNorm, 0, "converged"];
            yield {
                stepNumber: step,
                entities: makeCells(rows, i, false),
                edges: [],
                description: `Iteration ${i + 1}: gradient norm ${gradNorm.toExponential(2)} is already below tolerance.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: meta(false),
            };
            step += 1;
            break;
        }
        const direction = solve2(B, [-g[0], -g[1]]);
        const p: Vec2 = direction ?? [-g[0], -g[1]];
        const ap = matVec(A, p);
        const curvature = dot(p, ap);
        const alpha = curvature > 1e-12 ? -dot(g, p) / curvature : 0;
        const s: Vec2 = [alpha * p[0], alpha * p[1]];
        const y: Vec2 = [A[0] * s[0] + A[1] * s[1], A[2] * s[0] + A[3] * s[1]];
        const Bs = matVec(B, s);
        const r: Vec2 = [y[0] - Bs[0], y[1] - Bs[1]];
        const denom = dot(r, s);
        let action = "skipped";
        if (Math.abs(denom) > 1e-12 * Math.max(1, Math.hypot(r[0], r[1]) * Math.hypot(s[0], s[1]))) {
            B = [
                B[0] + (r[0] * r[0]) / denom,
                B[1] + (r[0] * r[1]) / denom,
                B[2] + (r[1] * r[0]) / denom,
                B[3] + (r[1] * r[1]) / denom,
            ];
            action = "rank-one";
        }
        const updated = matVec(B, s);
        secantResidual = Math.hypot(updated[0] - y[0], updated[1] - y[1]);
        x = [x[0] + s[0], x[1] + s[1]];
        steps += 1;
        rows[i] = [i, x[0], x[1], gradNorm, denom, action];
        yield {
            stepNumber: step,
            entities: makeCells(rows, i, false),
            edges: [],
            description: `Iteration ${i + 1}: gradient ${gradNorm.toExponential(2)}, step ${s.map((v) => v.toFixed(4)).join(", ")}, ${action} update.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: meta(false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, true),
        edges: [],
        description: `Best point (${x[0].toFixed(6)}, ${x[1].toFixed(6)}), gradient ${gradNorm.toExponential(2)}, secant residual ${secantResidual.toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: meta(true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Newton's method needs the exact Hessian and its inverse, which is expensive. A quasi-Newton method instead learns the Hessian from the changes in gradient seen during the search. Rank-one means the correction matrix is a single outer product: it changes the estimate in one direction only, the direction of the last step, and leaves everything orthogonal to that step untouched.",
        invariants: [
            "Each applied update makes the Hessian estimate satisfy B s = y for the latest step.",
            "The update matrix is symmetric because it is an outer product r r transposed.",
            "When r is parallel to s the denominator vanishes and the update is skipped rather than divided by zero.",
        ],
        correctness:
            "The rank-one correction r r^T over r^T s is symmetric. Applied to s it gives r, so the new matrix times s equals the old matrix times s plus r, which is y by the definition of r. Hence the secant equation holds after every applied update. With an exact line search on a quadratic, the successive steps span the space and the estimate matches the true Hessian within d updates, so the minimizer is reached in at most d iterations.",
        complexityRationale:
            "Forming the outer product and multiplying a matrix by a vector cost O(d squared) per iteration, and the exact line search costs O(d squared). The dense Hessian estimate uses O(d squared) space; here d is two, so all costs are constant.",
        uses: [
            "Unconstrained nonlinear optimization without analytic second derivatives",
            "Root finding and solver initialization in scientific software",
            "A minimal quasi-Newton example for teaching Hessian approximation",
        ],
        references: [
            "Nocedal and Wright, Numerical Optimization, chapter on quasi-Newton methods",
            "Davidon, Variable Metric Method for Minimization, 1959",
        ],
        workedExample:
            "Minimizing f(x) = 2x0 squared plus 2x0 x1 plus 1.5 x1 squared minus x0 minus 2x1 from (2, -1) starts with B equal to the identity. The first step moves toward (0.09, 0.64), the rank-one correction aligns B with the true Hessian, and a second step lands on the minimizer (1/11, 7/11) with gradient essentially zero.",
    },
    id: "sr1",
    name: "Symmetric Rank-One Method",
    category: "numerical-optimization",
    complexity: { time: "O(d^2) per step", space: "O(d^2)" },
    defaultInput: { A: [[4, 1], [1, 3]], b: [1, 2], x0: [2, -1], iterations: 6 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with the identity as the Hessian estimate",
        "compute the gradient at the current point and stop if it is tiny",
        "solve the estimate times direction equals minus the gradient",
        "choose the step length that minimizes along that direction",
        "form r as the gradient change minus the estimate times the step",
        "if r times the step is nonzero add r r transposed over that value",
        "advance the point and repeat until the budget ends",
        "done: report the minimizer and the secant residual",
    ],
};

export default module;
