/**
 * projected-gradient.ts - Projected Gradient Descent
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Projected gradient solves a constrained minimization by taking an ordinary
 * gradient step and then projecting the result back onto the feasible set. For
 * a box constraint the projection is a simple clamp of each coordinate to its
 * lower and upper bound. The method converges to a constrained optimum when the
 * objective is convex and the step size is small enough.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * d) for a d-dimensional problem with a box constraint
 *   Space: O(d) for the current point and gradient
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Three bars show x, y, and the constrained objective value.
 *   - A bar clamped to a bound is highlighted to show the projection.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function objective(x: number, y: number): number {
    return (x - 3) * (x - 3) + (y + 1) * (y + 1);
}

function clamp(value: number, lower: number, upper: number): number {
    return Math.min(upper, Math.max(lower, value));
}

function makeBars(x: number, y: number, lower: number, upper: number, done: boolean): VisualEntity[] {
    const values = [x, y, objective(x, y)];
    return values.map((value, index) => {
        const clamped = index < 2 && (value <= lower || value >= upper);
        let state: EntityState = "idle";
        if (index === 2) {
            state = done ? "sorted" : "comparing";
        } else if (clamped) {
            state = "active";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(5),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, clamped, role: index === 0 ? "x" : index === 1 ? "y" : "f" },
        };
    });
}

/** Replay projected gradient descent on a box-constrained quadratic. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        x0?: number;
        y0?: number;
        step?: number;
        iterations?: number;
        lower?: number;
        upper?: number;
    } | null) ?? {};
    let x = typeof task.x0 === "number" ? task.x0 : 0;
    let y = typeof task.y0 === "number" ? task.y0 : 0;
    const lr = typeof task.step === "number" && task.step > 0 ? task.step : 0.1;
    const iterations =
        typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 60;
    const lower = typeof task.lower === "number" ? task.lower : 0;
    const upper = typeof task.upper === "number" ? task.upper : 2;

    yield {
        stepNumber: 0,
        entities: makeBars(x, y, lower, upper, false),
        edges: [],
        description: `Start at (${x}, ${y}) with objective ${objective(x, y).toFixed(4)} inside the box [${lower}, ${upper}]^2.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x, y, f: objective(x, y), iteration: 0, projected: false },
    };

    let step = 1;
    let projectedAny = false;
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const gx = 2 * (x - 3);
        const gy = 2 * (y + 1);
        const rawX = x - lr * gx;
        const rawY = y - lr * gy;
        const nextX = clamp(rawX, lower, upper);
        const nextY = clamp(rawY, lower, upper);
        const projected = nextX !== rawX || nextY !== rawY;
        if (projected) {
            projectedAny = true;
        }
        x = nextX;
        y = nextY;
        yield {
            stepNumber: step,
            entities: makeBars(x, y, lower, upper, false),
            edges: [],
            description: `Iteration ${iteration}: raw step (${rawX.toFixed(4)}, ${rawY.toFixed(4)}) projects to (${x.toFixed(4)}, ${y.toFixed(4)})${projected ? " on the box boundary" : ""}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { x, y, f: objective(x, y), iteration, projected },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, y, lower, upper, true),
        edges: [],
        description: `Constrained minimum near (${x.toFixed(6)}, ${y.toFixed(6)}) with objective ${objective(x, y).toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { x, y, f: objective(x, y), iteration: step - 1, projected: projectedAny },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When a problem has simple bounds on the variables, do not build a complicated constrained solver. Take the usual gradient step, then snap each coordinate back into its allowed interval. That snap is the projection onto the feasible box, and repeating it walks toward the best feasible point even when the unconstrained minimum lies outside the box.",
        invariants: [
            "Every iterate lies inside the feasible box after projection.",
            "The projection moves a coordinate only toward its nearest bound.",
            "For a convex objective the sequence approaches a constrained minimizer.",
        ],
        correctness:
            "Projection onto a closed convex set is nonexpansive, and for a box it is the componentwise clamp giving the closest feasible point. Projected gradient is the proximal point method with the indicator of the box, so for a convex L-smooth objective with step size at most one over L it converges to a point where the negative gradient points outward at every active bound, the first-order optimality condition for the constrained problem.",
        complexityRationale:
            "Each iteration evaluates the gradient in O(d) time and clamps d coordinates, so the cost is O(d) per iteration. Only the current point and gradient are stored, giving O(d) space.",
        uses: [
            "Training with bounded parameters such as probabilities or clipped weights",
            "Image reconstruction where pixel intensities must stay in a range",
            "Portfolio and resource allocation problems with box limits",
        ],
        references: [
            "Nocedal and Wright, Numerical Optimization, Chapter 16",
            "Boyd and Vandenberghe, Convex Optimization, Chapter 9",
        ],
        workedExample:
            "Minimize (x-3)^2 + (y+1)^2 over [0, 2]^2. The unconstrained minimum (3, -1) is infeasible. Gradient steps push x past 2 and y below 0, but clamping holds them at the boundary, so the iterates settle at (2, 0), the closest feasible point to the unconstrained optimum.",
    },
    id: "projected-gradient",
    name: "Projected Gradient Descent",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * d)", space: "O(d)" },
    defaultInput: { x0: 0, y0: 0, step: 0.1, iterations: 60 },
    visualType: "array",
    run,
    pseudocode: [
        "start from an initial feasible point and choose a step size",
        "for each iteration compute the gradient at the current point",
        "take an unconstrained gradient step",
        "clamp every coordinate into its lower and upper bound",
        "the clamped point is the projection onto the feasible box",
        "repeat until the point stops changing appreciably",
        "done: report the constrained minimum and objective value",
    ],
};

export default module;
