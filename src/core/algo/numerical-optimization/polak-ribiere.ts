/**
 * polak-ribiere.ts - Polak-Ribiere Plus Nonlinear Conjugate Gradient
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Polak-Ribiere (with the Plus restart) is a conjugate-gradient method for a
 * smooth function. After each exact line search it builds a new search
 * direction from the fresh negative gradient and the previous direction, with
 * a coefficient formed from the change in the gradient. Unlike Fletcher-Reeves,
 * the coefficient can become negative on a non-quadratic problem; the Plus
 * variant clamps it to zero, which restarts the search along steepest descent.
 * On a positive-definite quadratic in d dimensions the directions are mutually
 * conjugate, so the minimizer is reached in at most d steps.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * d) arithmetic for a d-dimensional quadratic
 *   Space: O(d) for the point, gradient, and direction vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Three bars show the current x, y, and objective value.
 *   - The objective bar is yellow while searching and green at convergence.
 *   - Each caption reports the step length and the Polak-Ribiere coefficient.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    targetX?: number;
    targetY?: number;
    curvature?: number;
    startX?: number;
    startY?: number;
    tol?: number;
    maxIter?: number;
}

/** Objective (x-tx)^2 + c (y-ty)^2 with Hessian diag(2, 2c). */
function objective(x: number, y: number, tx: number, ty: number, c: number): number {
    const dx = x - tx;
    const dy = y - ty;
    return dx * dx + c * dy * dy;
}

function grad(x: number, y: number, tx: number, ty: number, c: number): [number, number] {
    return [2 * (x - tx), 2 * c * (y - ty)];
}

function makeBars(x: number, y: number, value: number, searching: boolean): VisualEntity[] {
    const values = [x, y, value];
    return values.map((v, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: v.toFixed(5),
        value: v,
        state: (index === 2 ? (searching ? "comparing" : "sorted") : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index === 0 ? "x" : index === 1 ? "y" : "f" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const tx = typeof task.targetX === "number" ? task.targetX : 1;
    const ty = typeof task.targetY === "number" ? task.targetY : 2;
    const c = typeof task.curvature === "number" && task.curvature > 0 ? task.curvature : 2;
    let x = typeof task.startX === "number" ? task.startX : 3;
    let y = typeof task.startY === "number" ? task.startY : -2;
    const tol = typeof task.tol === "number" && task.tol > 0 ? task.tol : 1e-8;
    const maxIter = typeof task.maxIter === "number" ? Math.max(1, Math.floor(task.maxIter)) : 50;

    let [gx, gy] = grad(x, y, tx, ty, c);
    let dx = -gx;
    let dy = -gy;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(x, y, objective(x, y, tx, ty, c), true),
        edges: [],
        description: `Start at (${x.toFixed(3)}, ${y.toFixed(3)}); the first direction is steepest descent.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, alpha: 0, beta: 0, objective: objective(x, y, tx, ty, c), converged: false },
    };
    step += 1;

    let converged = false;
    for (let iteration = 1; iteration <= maxIter; iteration += 1) {
        if (Math.hypot(gx, gy) < tol) {
            converged = true;
            break;
        }
        const denom = 2 * dx * dx + 2 * c * dy * dy;
        const alpha = denom > 0 ? -(gx * dx + gy * dy) / denom : 0;
        x += alpha * dx;
        y += alpha * dy;
        const [ngx, ngy] = grad(x, y, tx, ty, c);
        const gg = gx * gx + gy * gy;
        const rawBeta = gg > 0 ? (ngx * (ngx - gx) + ngy * (ngy - gy)) / gg : 0;
        const beta = Math.max(0, rawBeta);
        dx = -ngx + beta * dx;
        dy = -ngy + beta * dy;
        gx = ngx;
        gy = ngy;
        const restarted = rawBeta < 0;
        yield {
            stepNumber: step,
            entities: makeBars(x, y, objective(x, y, tx, ty, c), true),
            edges: [],
            description: `Iteration ${iteration}: step ${alpha.toFixed(5)}, beta ${beta.toFixed(5)}${restarted ? " (restart)" : ""}, objective ${objective(x, y, tx, ty, c).toFixed(5)}.`,
            codeLineNumber: restarted ? 6 : 7,
            layout: "array",
            meta: {
                iteration,
                alpha,
                beta,
                objective: objective(x, y, tx, ty, c),
                converged: false,
                restarted,
            },
        };
        step += 1;
    }

    const finalValue = objective(x, y, tx, ty, c);
    yield {
        stepNumber: step,
        entities: makeBars(x, y, finalValue, false),
        edges: [],
        description: converged
            ? `Converged near (${tx.toFixed(3)}, ${ty.toFixed(3)}) with objective ${finalValue.toExponential(3)}.`
            : `Stopped at the iteration limit with objective ${finalValue.toFixed(5)}.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { iteration: step - 1, x, y, objective: finalValue, converged },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Conjugate gradient improves on steepest descent by choosing directions that do not undo the progress of earlier steps. Polak-Ribiere measures how much the gradient changed between two points and uses that change to blend the old direction into the new one. When the blend turns negative the method throws it away and starts fresh along steepest descent, which is the Plus safeguard.",
        invariants: [
            "Each line search minimizes the exact quadratic model along the current direction.",
            "On a quadratic, successive search directions are mutually conjugate.",
            "The directions are restarted as steepest descent whenever the raw coefficient is negative.",
            "The objective value never increases from one iterate to the next.",
        ],
        correctness:
            "For a positive-definite quadratic, exact line search makes the errors in consecutive steps conjugate with respect to the Hessian. A conjugate direction set in d dimensions spans the space, so the minimum is reached in at most d exact line searches. The Plus restart only replaces one direction by steepest descent, which is still a descent direction, so progress is preserved on general smooth functions.",
        complexityRationale:
            "Each iteration evaluates the gradient once and forms a few vector combinations, costing O(d) arithmetic in d dimensions. Only the current point, gradient, and direction are retained, so the extra space is O(d).",
        uses: [
            "Large-scale unconstrained optimization where storing a Hessian is impractical",
            "Iterative solvers built on the related linear conjugate-gradient method",
            "Training models when only gradient evaluations are available",
        ],
        references: [
            "Polak and Ribiere, Note sur la convergence de methodes de directions conjuguees, 1969",
            "Nocedal and Wright, Numerical Optimization, chapter 5",
        ],
        workedExample:
            "Minimizing (x-1)^2 + 2(y-2)^2 from (3, -2): the first steepest-descent step lands on the line y = -2 with a smaller objective; the gradient change then gives a positive beta, so the second direction is conjugate to the first and lands exactly on (1, 2), where the gradient is zero and the objective is zero.",
    },
    id: "polak-ribiere",
    name: "Polak-Ribiere Plus Conjugate Gradient",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * d)", space: "O(d)" },
    defaultInput: {
        targetX: 1,
        targetY: 2,
        curvature: 2,
        startX: 3,
        startY: -2,
        tol: 1e-8,
        maxIter: 50,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the point, gradient, and direction to steepest descent",
        "for each iteration up to the limit",
        "stop when the gradient norm is below the tolerance",
        "compute the exact step alpha = -(g dot d) / (d dot H d)",
        "move along d by alpha and refresh the gradient",
        "compute beta = gNew dot (gNew - g) divided by g dot g",
        "restart along steepest descent when beta is negative",
        "set the next direction to -gNew plus beta times d",
        "done: report the minimizer and final objective value",
    ],
};

export default module;
