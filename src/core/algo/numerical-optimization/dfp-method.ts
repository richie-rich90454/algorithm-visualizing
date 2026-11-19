/**
 * dfp-method.ts - Davidon-Fletcher-Powell Quasi-Newton Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DFP is the original quasi-Newton method. Instead of recomputing the Hessian
 * inverse, it maintains an approximation H that is updated after each step from
 * the displacement s and the gradient change y. The rank-two update keeps H
 * symmetric positive definite and enforces the secant condition H y = s, so
 * curvature information accumulates without second derivatives.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * d^2) for a d-dimensional problem
 *   Space: O(d^2) for the inverse-Hessian approximation
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Three bars show the current x, y, and objective value.
 *   - The objective bar turns green when the method reaches the minimum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mat2 = [number, number, number, number]; // [h11, h12, h21, h22]

function objective(x: number, y: number): number {
    return x * x + 2 * y * y;
}

function matVec(m: Mat2, v: [number, number]): [number, number] {
    return [m[0] * v[0] + m[1] * v[1], m[2] * v[0] + m[3] * v[1]];
}

function makeBars(x: number, y: number, converged: boolean): VisualEntity[] {
    const values = [x, y, objective(x, y)];
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: (index === 2 ? (converged ? "sorted" : "comparing") : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index === 0 ? "x" : index === 1 ? "y" : "f" },
    }));
}

/** Replay DFP minimization of a two-dimensional quadratic. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { x0?: number; y0?: number; iterations?: number } | null) ?? {};
    let x = typeof task.x0 === "number" ? task.x0 : 3;
    let y = typeof task.y0 === "number" ? task.y0 : 2;
    const iterations =
        typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 6;

    let h: Mat2 = [1, 0, 0, 1];
    let gx = 2 * x;
    let gy = 4 * y;

    yield {
        stepNumber: 0,
        entities: makeBars(x, y, false),
        edges: [],
        description: `Start at (${x}, ${y}) with objective ${objective(x, y).toFixed(4)} and identity inverse Hessian.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x, y, f: objective(x, y), iteration: 0, h11: h[0] },
    };

    let step = 1;
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const dir = matVec(h, [-gx, -gy]);
        const dx = dir[0] ?? 0;
        const dy = dir[1] ?? 0;
        const denominator = 2 * dx * dx + 4 * dy * dy;
        if (denominator === 0) {
            break;
        }
        const alpha = -(gx * dx + gy * dy) / denominator;
        const sx = alpha * dx;
        const sy = alpha * dy;
        x += sx;
        y += sy;
        const ngx = 2 * x;
        const ngy = 4 * y;
        const yx = ngx - gx;
        const yy = ngy - gy;

        const hy = matVec(h, [yx, yy]);
        const hyx = hy[0] ?? 0;
        const hyy = hy[1] ?? 0;
        const yHy = yx * hyx + yy * hyy;
        const sDotY = sx * yx + sy * yy;
        if (yHy !== 0 && sDotY !== 0) {
            const next: Mat2 = [
                h[0] - (hyx * hyx) / yHy + (sx * sx) / sDotY,
                h[1] - (hyx * hyy) / yHy + (sx * sy) / sDotY,
                h[2] - (hyy * hyx) / yHy + (sy * sx) / sDotY,
                h[3] - (hyy * hyy) / yHy + (sy * sy) / sDotY,
            ];
            h = next;
        }

        const converged = objective(x, y) < 1e-18;
        yield {
            stepNumber: step,
            entities: makeBars(x, y, converged),
            edges: [],
            description: `Iteration ${iteration}: DFP step lands at (${x.toFixed(5)}, ${y.toFixed(5)}), f = ${objective(x, y).toExponential(3)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { x, y, f: objective(x, y), iteration, h11: h[0] },
        };
        step += 1;

        gx = ngx;
        gy = ngy;
        if (converged) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, y, true),
        edges: [],
        description: `DFP reached (${x.toFixed(8)}, ${y.toFixed(8)}) with objective ${objective(x, y).toExponential(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { x, y, f: objective(x, y), iteration: step - 1, h11: h[0] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Newton's method converges quickly but needs the inverse Hessian at every step, which is expensive. DFP keeps a running estimate of that inverse and corrects it using only the step displacement and the change in gradient. The correction is shaped so the updated estimate explains the curvature just observed, gradually building a good model of the function.",
        invariants: [
            "The inverse-Hessian approximation stays symmetric and positive definite.",
            "After an update it satisfies the secant condition H times the gradient change equals the displacement.",
            "The line search decreases the objective value.",
        ],
        correctness:
            "The DFP update is the unique rank-two symmetric modification of H that is positive definite and satisfies the secant equation. On a quadratic with exact line searches, successive displacements are conjugate with respect to the Hessian, so the method reaches the minimizer in at most d steps. For general smooth functions, positivity of H keeps every search direction a descent direction, giving global convergence under a suitable line search.",
        complexityRationale:
            "Each iteration multiplies a d by d matrix by a vector and performs rank-two updates, costing O(d^2) time. Storing the inverse-Hessian approximation uses O(d^2) space.",
        uses: [
            "Medium-sized nonlinear optimization without analytic second derivatives",
            "Parameter estimation and maximum-likelihood fitting",
            "A historical foundation for later methods such as BFGS",
        ],
        references: [
            "Davidon, Variable Metric Method for Minimization, 1959",
            "Fletcher and Powell, A Rapidly Convergent Descent Method for Minimization, 1963",
        ],
        workedExample:
            "Minimizing x^2 + 2y^2 from (3, 2) with H equal to the identity, the first step is steepest descent to (0, 1). The gradient change at that step updates H to capture the Hessian curvature, and the second DFP step reaches (0, 0), the exact minimum.",
    },
    id: "dfp-method",
    name: "DFP Quasi-Newton Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * d^2)", space: "O(d^2)" },
    defaultInput: { x0: 3, y0: 2, iterations: 6 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the inverse Hessian estimate to the identity",
        "for each iteration compute direction as H times the negative gradient",
        "choose a step length by exact line search",
        "move to the new point and measure the gradient change",
        "apply the DFP rank-two update to H",
        "stop when the objective value is essentially zero",
        "done: report the minimizing point and objective value",
    ],
};

export default module;
