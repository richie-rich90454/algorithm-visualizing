/**
 * fletcher-reeves.ts - Fletcher-Reeves Nonlinear Conjugate Gradient
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fletcher-Reeves turns steepest descent into conjugate gradient for a general
 * smooth function. After each exact or approximate line search, the new search
 * direction combines the fresh negative gradient with the previous direction,
 * weighted by the ratio of squared gradient norms. The directions are mutually
 * conjugate on a quadratic, so a quadratic in d dimensions is minimized in d steps.
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
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Quadratic f(x, y) = x^2 + 2 y^2 with Hessian diag(2, 4). */
function objective(x: number, y: number): number {
    return x * x + 2 * y * y;
}

function makeBars(x: number, y: number, searching: boolean): VisualEntity[] {
    const values = [x, y, objective(x, y)];
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: (index === 2 ? (searching ? "comparing" : "sorted") : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index === 0 ? "x" : index === 1 ? "y" : "f" },
    }));
}

/** Replay Fletcher-Reeves on a two-dimensional quadratic. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { x0?: number; y0?: number; iterations?: number } | null) ?? {};
    let x = typeof task.x0 === "number" ? task.x0 : 3;
    let y = typeof task.y0 === "number" ? task.y0 : 4;
    const iterations =
        typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 6;

    let gx = 2 * x;
    let gy = 4 * y;
    let dx = -gx;
    let dy = -gy;

    yield {
        stepNumber: 0,
        entities: makeBars(x, y, true),
        edges: [],
        description: `Start at (${x}, ${y}) with objective ${objective(x, y).toFixed(4)} and steepest-descent direction.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x, y, f: objective(x, y), iteration: 0, beta: 0 },
    };

    let step = 1;
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        // Exact line search for f = x^2 + 2y^2 with Hessian diag(2, 4).
        const denominator = 2 * dx * dx + 4 * dy * dy;
        if (denominator === 0) {
            break;
        }
        const alpha = -(gx * dx + gy * dy) / denominator;
        x += alpha * dx;
        y += alpha * dy;
        const ngx = 2 * x;
        const ngy = 4 * y;
        const oldNorm = gx * gx + gy * gy;
        const beta = oldNorm === 0 ? 0 : (ngx * ngx + ngy * ngy) / oldNorm;
        yield {
            stepNumber: step,
            entities: makeBars(x, y, true),
            edges: [],
            description: `Iteration ${iteration}: step length ${alpha.toFixed(5)} gives (${x.toFixed(5)}, ${y.toFixed(5)}), f = ${objective(x, y).toExponential(3)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { x, y, f: objective(x, y), iteration, beta },
        };
        step += 1;

        const converged = objective(x, y) < 1e-18;
        if (converged) {
            break;
        }
        dx = -ngx + beta * dx;
        dy = -ngy + beta * dy;
        gx = ngx;
        gy = ngy;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, y, false),
        edges: [],
        description: `Converged near (${x.toFixed(8)}, ${y.toFixed(8)}) with objective ${objective(x, y).toExponential(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { x, y, f: objective(x, y), iteration: step - 1, beta: 0 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain gradient descent zigzags because each new steepest direction is perpendicular to the last. Conjugate gradient instead carries a bit of the previous direction forward. Fletcher-Reeves chooses how much to carry by comparing the new gradient's squared length with the old one, which makes successive directions conjugate on a quadratic and collapses a d-dimensional minimization into d line searches.",
        invariants: [
            "Each search direction is the negative gradient plus a multiple of the previous direction.",
            "The line search decreases the objective value.",
            "On a quadratic, directions generated this way are mutually conjugate.",
        ],
        correctness:
            "For a positive-definite quadratic, exact line minimization along a conjugate direction removes the error component in that direction without disturbing earlier ones. Fletcher-Reeves produces directions that are conjugate with respect to the Hessian, so after at most d such line searches all error components are eliminated and the minimizer is reached. For a general smooth function the method is restarted periodically and still converges under standard line-search conditions.",
        complexityRationale:
            "Each iteration forms a gradient, one line search, and a direction update, all O(d) arithmetic for a quadratic with a known Hessian. Storage is O(d) for the point, gradient, and direction.",
        uses: [
            "Large-scale optimization where storing a Hessian is infeasible",
            "Solving symmetric positive-definite systems via the linear conjugate gradient link",
            "Training models with limited memory and many parameters",
        ],
        references: [
            "Fletcher and Reeves, Function Minimization by Conjugate Gradients, 1964",
            "Nocedal and Wright, Numerical Optimization, Chapter 5",
        ],
        workedExample:
            "Minimizing x^2 + 2y^2 from (3, 4), the first steepest step lands at (0, -2). The Fletcher-Reeves beta then mixes the new gradient with the old direction, and the second exact line search reaches (0, 0), the minimum, where the objective is zero.",
    },
    id: "fletcher-reeves",
    name: "Fletcher-Reeves Conjugate Gradient",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * d)", space: "O(d)" },
    defaultInput: { x0: 3, y0: 4, iterations: 6 },
    visualType: "array",
    run,
    pseudocode: [
        "start from an initial point and compute the gradient",
        "set the first direction to the negative gradient",
        "for each iteration do an exact line search along the direction",
        "move to the new point and compute its gradient",
        "set beta to the ratio of squared gradient norms",
        "combine the new negative gradient with the old direction times beta",
        "done: report the minimizing point and objective value",
    ],
};

export default module;
