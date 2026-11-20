/**
 * gauss-newton.ts - Gauss-Newton Nonlinear Least Squares
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gauss-Newton fits a nonlinear model to data by repeatedly linearizing it at
 * the current parameters. Each step solves the normal equations
 * (J^T J) delta = -J^T r for a parameter update, where r is the residual vector
 * and J its Jacobian. A backtracking line search accepts the update only when
 * it lowers the sum of squared residuals, so the fit improves monotonically.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iters * m * p^3) for m data points and p parameters
 *   Space: O(m * p) for the Jacobian and residuals
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per data point shows its current residual; the target is zero.
 *   - The bar of the largest residual is highlighted each iteration.
 *   - Frame metadata carries the parameters, the sum of squared residuals,
 *     and the accepted step size so convergence is observable.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Point {
    x: number;
    y: number;
}

function model(x: number, a: number, b: number): number {
    return a * Math.exp(b * x);
}

function residualSum(points: Point[], a: number, b: number): number {
    let sum = 0;
    for (const p of points) {
        const r = model(p.x, a, b) - p.y;
        sum += r * r;
    }
    return sum;
}

function makeBars(points: Point[], a: number, b: number): VisualEntity[] {
    const residuals = points.map((p) => model(p.x, a, b) - p.y);
    let maxIndex = 0;
    for (let i = 1; i < residuals.length; i += 1) {
        if (Math.abs(residuals[i] ?? 0) > Math.abs(residuals[maxIndex] ?? 0)) {
            maxIndex = i;
        }
    }
    return points.map((p, i) => {
        const r = residuals[i] ?? 0;
        const state: EntityState = i === maxIndex ? "comparing" : Math.abs(r) < 1e-3 ? "sorted" : "idle";
        return {
            id: `point-${i}`,
            type: "bar" as const,
            label: `x=${p.x} residual=${r.toFixed(2)}`,
            value: r,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, x: p.x, y: p.y, residual: r },
        };
    });
}

/** The Gauss-Newton generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[]; a0?: number; b0?: number; iterations?: number } | null) ?? {};
    const points: Point[] = Array.isArray(task.points) && task.points.length > 1
        ? task.points.map((p) => ({ x: Number(p.x), y: Number(p.y) }))
        : [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 * Math.exp(0.5 * x) }));
    let a = typeof task.a0 === "number" ? task.a0 : 1;
    let b = typeof task.b0 === "number" ? task.b0 : 0;
    const iterations = Math.max(1, Math.min(30, Math.floor(task.iterations ?? 12)));
    let ssr = residualSum(points, a, b);
    let step = 0;

    const emit = (description: string, codeLine: number, extra: object = {}) => {
        const frame: VisualFrame = {
            stepNumber: step,
            entities: makeBars(points, a, b),
            edges: [],
            description,
            codeLineNumber: codeLine,
            layout: "array",
            meta: { a, b, ssr, iteration: step, pointCount: points.length, ...extra },
        };
        step += 1;
        return frame;
    };

    yield emit(`Starting at a=${a.toFixed(3)}, b=${b.toFixed(3)} with sum of squared residuals ${ssr.toFixed(4)}.`, 0);

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        let j11 = 0;
        let j12 = 0;
        let j22 = 0;
        let j1r = 0;
        let j2r = 0;
        for (const p of points) {
            const e = Math.exp(b * p.x);
            const ja = e;
            const jb = a * p.x * e;
            const r = a * e - p.y;
            j11 += ja * ja;
            j12 += ja * jb;
            j22 += jb * jb;
            j1r += ja * r;
            j2r += jb * r;
        }
        const lambda = 1e-9;
        const det = (j11 + lambda) * (j22 + lambda) - j12 * j12;
        if (Math.abs(det) < 1e-18) {
            yield emit("The normal equations are singular; stopping the fit.", 4, { singular: true });
            break;
        }
        const da = -((j22 + lambda) * j1r - j12 * j2r) / det;
        const db = -((j11 + lambda) * j2r - j12 * j1r) / det;

        let factor = 1;
        let accepted = ssr;
        let aNext = a;
        let bNext = b;
        for (let trial = 0; trial < 24; trial += 1) {
            aNext = a + factor * da;
            bNext = b + factor * db;
            const candidate = residualSum(points, aNext, bNext);
            if (candidate <= ssr) {
                accepted = candidate;
                break;
            }
            factor /= 2;
        }

        a = aNext;
        b = bNext;
        const improvement = ssr - accepted;
        ssr = accepted;
        yield emit(
            `Iteration ${iteration + 1}: step (${da.toFixed(3)}, ${db.toFixed(3)}) scaled by ${factor.toFixed(3)} lowered the residual sum to ${ssr.toFixed(6)}.`,
            5,
            { stepScale: factor, improvement },
        );
        if (Math.abs(improvement) < 1e-12) {
            break;
        }
    }

    yield emit(
        `Converged near a=${a.toFixed(4)}, b=${b.toFixed(4)} with residual sum ${ssr.toFixed(6)}.`,
        7,
        { done: true },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Fitting a curved model is hard directly, but a small change in the parameters makes the model look almost linear. Gauss-Newton repeats two steps: approximate the residuals by a straight line in parameter space using their Jacobian, then solve for the parameter change that best cancels those residuals. A line search keeps only changes that actually reduce the error.",
        invariants: [
            "The sum of squared residuals never increases after an accepted step.",
            "The update solves the linearized normal equations J^T J delta = -J^T r.",
            "Near a minimum the update becomes small and the parameters stabilize.",
        ],
        correctness:
            "The Jacobian linearizes the residual vector, so minimizing the squared norm of r plus J delta gives the normal equations; the solved delta is the Gauss-Newton direction. When the model is exact, the residual at the true parameters is zero and the linearized problem reaches it, while the line search guarantees each accepted step lowers the objective. Termination on a negligible improvement therefore leaves the parameters at a local minimum of the residual sum.",
        complexityRationale:
            "Each iteration evaluates m residuals and a by p Jacobian entries and solves a p by p system, costing O(m p^2 + p^3); with two parameters this is O(m). Storing the residuals and Jacobian uses O(m p) space.",
        uses: [
            "Fitting nonlinear curves to experimental measurements",
            "Camera calibration and bundle adjustment in computer vision",
            "Estimating parameters of nonlinear regression models",
        ],
        references: [
            "Nocedal and Wright, Numerical Optimization, Chapter 10",
            "Golub and Pereyra, The Differentiation of Pseudo-Inverses and Nonlinear Least Squares, 1973",
        ],
        workedExample:
            "Fitting y = 2 exp(0.5 x) to exact samples at x = 0 through 4, starting from a=1 and b=0, the residuals are all negative. The first Gauss-Newton step raises both parameters, and a few iterations drive the residual sum to nearly zero at a=2, b=0.5.",
    },
    id: "gauss-newton",
    name: "Gauss-Newton Least Squares",
    category: "numerical-optimization",
    complexity: { time: "O(iters * m * p^3)", space: "O(m * p)" },
    defaultInput: { a0: 1, b0: 0, iterations: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "choose initial parameters and compute the residual vector",
        "for each iteration, compute the Jacobian of the residuals",
        "form the normal matrix J transpose J and the vector J transpose r",
        "solve the small linear system for the parameter step",
        "halve the step until the residual sum does not increase",
        "accept the step and update the parameters",
        "stop when the improvement is negligible or iterations run out",
        "done: report the fitted parameters and residual sum",
    ],
};

export default module;
