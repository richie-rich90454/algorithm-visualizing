/**
 * trust-region-method.ts - Trust-Region Method (Dogleg Step)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A trust-region method replaces a nonlinear objective near the current point
 * with a quadratic model and takes the best step it can inside a ball of
 * radius delta. The dogleg approximation follows steepest descent toward the
 * Cauchy point and then turns toward the Newton point, staying inside the
 * ball. The actual reduction is compared with the predicted reduction: a good
 * agreement grows the radius, a poor one shrinks it, and a bad step is
 * rejected. The module minimizes a positive-definite quadratic, where the
 * model is exact and the Newton step reaches the minimizer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k iterations on a 2-dimensional quadratic
 *   Space: O(1) for the current point, model, and radius
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each iterate is a node positioned at its (x, y) coordinates.
 *   - The accepted step is an edge whose label is the trust-region radius.
 *   - Rejected steps are marked as errors and the radius visibly shrinks.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Input { a?: number; b?: number; d?: number; start?: [number, number]; delta?: number; maxIter?: number }

/** Objective 0.5 a x^2 + b x y + 0.5 d y^2. */
function f(x: number, y: number, a: number, b: number, d: number): number {
    return 0.5 * a * x * x + b * x * y + 0.5 * d * y * y;
}
function gradient(x: number, y: number, a: number, b: number, d: number): [number, number] {
    return [a * x + b * y, d * y + b * x];
}
function norm2(x: number, y: number): number { return Math.hypot(x, y); }

/** Solve the 2x2 linear system [[a,b],[b,d]] p = -g (the Newton step). */
function newtonStep(gx: number, gy: number, a: number, b: number, d: number): [number, number] {
    const det = a * d - b * b;
    const rx = -gx;
    const ry = -gy;
    return [(d * rx - b * ry) / det, (-b * rx + a * ry) / det];
}

/** The dogleg step constrained to a ball of radius delta. */
function dogleg(
    gx: number, gy: number,
    nx: number, ny: number,
    a: number, b: number, d: number,
    delta: number,
): [number, number] {
    if (norm2(nx, ny) <= delta) {
        return [nx, ny];
    }
    const gnorm2 = gx * gx + gy * gy;
    const hg = a * gx * gx + 2 * b * gx * gy + d * gy * gy;
    const scale = hg > 0 ? gnorm2 / hg : 0;
    const ux = -scale * gx;
    const uy = -scale * gy;
    const un = norm2(ux, uy);
    if (un >= delta) {
        const s = delta / un;
        return [ux * s, uy * s];
    }
    // Point on the segment from the Cauchy point to the Newton point with norm delta.
    const dx = nx - ux;
    const dy = ny - uy;
    const aa = dx * dx + dy * dy;
    const bb = 2 * (ux * dx + uy * dy);
    const cc = ux * ux + uy * uy - delta * delta;
    const disc = Math.max(0, bb * bb - 4 * aa * cc);
    const t = (-bb + Math.sqrt(disc)) / (2 * aa);
    return [ux + t * dx, uy + t * dy];
}

/** Build iterate nodes and step edges for one frame. */
function makeEntities(points: Array<[number, number]>, states: EntityState[], radii: number[], a: number, b: number, d: number): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities = points.map(([x, y], i) => ({
        id: `x-${i}`,
        type: "node" as const,
        label: `x${i}`,
        value: f(x, y, a, b, d),
        state: states[i] ?? "idle",
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index: i, px: x, py: y, radius: radii[i] ?? 0 },
    }));
    const edges: VisualEdge[] = [];
    for (let i = 1; i < points.length; i += 1) {
        edges.push({
            id: `step-${i}`,
            sourceId: `x-${i - 1}`,
            targetId: `x-${i}`,
            label: (radii[i] ?? 0).toFixed(2),
            state: states[i] === "error" ? "error" : "visited",
            directed: true,
        });
    }
    return { entities, edges };
}

/** The trust-region generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const a = Number(task.a ?? 4);
    const b = Number(task.b ?? 1);
    const d = Number(task.d ?? 2);
    const start: [number, number] = Array.isArray(task.start) ? [Number(task.start[0]), Number(task.start[1])] : [3, 4];
    let delta = Math.max(0.1, Number(task.delta ?? 10));
    const maxIter = Math.max(1, Math.floor(Number(task.maxIter ?? 8)) || 8);

    let x = start[0];
    let y = start[1];
    const points: Array<[number, number]> = [[x, y]];
    const states: EntityState[] = ["idle"];
    const radii: number[] = [delta];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(points, states, radii, a, b, d).entities,
        edges: [],
        description: `Trust region initialized at (${x}, ${y}) with radius ${delta}; objective value ${f(x, y, a, b, d).toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { x, y, f: f(x, y, a, b, d), delta, accepted: true, ratio: 1, iteration: 0 },
    };
    step += 1;

    for (let iter = 1; iter <= maxIter; iter += 1) {
        const [gx, gy] = gradient(x, y, a, b, d);
        if (norm2(gx, gy) < 1e-9) {
            break;
        }
        const [nx, ny] = newtonStep(gx, gy, a, b, d);
        const [px, py] = dogleg(gx, gy, nx, ny, a, b, d, delta);
        const predicted = -(gx * px + gy * py) - 0.5 * (a * px * px + 2 * b * px * py + d * py * py);
        const fx = f(x, y, a, b, d);
        const fxNew = f(x + px, y + py, a, b, d);
        const actual = fx - fxNew;
        const ratio = predicted > 0 ? actual / predicted : 0;
        const accepted = ratio > 0.25;

        if (accepted) {
            x += px;
            y += py;
        }
        if (ratio > 0.75 && norm2(px, py) >= 0.99 * delta) {
            delta *= 2;
        } else if (ratio < 0.25) {
            delta *= 0.5;
        }

        points.push([x, y]);
        states.push(accepted ? "sorted" : "error");
        radii.push(delta);
        const built = makeEntities(points, states, radii, a, b, d);
        yield {
            stepNumber: step,
            entities: built.entities,
            edges: built.edges,
            description: `Iteration ${iter}: ratio ${ratio.toFixed(4)}, step ${accepted ? "accepted" : "rejected"}, radius now ${delta.toFixed(3)}.`,
            codeLineNumber: accepted ? 3 : 5,
            layout: "point",
            meta: { x, y, f: fxNew, delta, accepted, ratio, iteration: iter, gradientNorm: norm2(gx, gy) },
        };
        step += 1;

        if (norm2(gradient(x, y, a, b, d)[0], gradient(x, y, a, b, d)[1]) < 1e-9) {
            break;
        }
    }

    const built = makeEntities(points, states, radii, a, b, d);
    yield {
        stepNumber: step,
        entities: built.entities,
        edges: built.edges,
        description: `Done: converged near (${x.toFixed(6)}, ${y.toFixed(6)}) with objective ${f(x, y, a, b, d).toExponential(3)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { x, y, f: f(x, y, a, b, d), delta, accepted: true, done: true, iterations: step - 1 },
    };
}

/** The trust-region module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A trust-region method is careful: it only trusts a local quadratic model inside a ball around the current point. It proposes a step inside that ball, checks whether the real drop in the objective matches the drop the model predicted, and only then decides whether to move. If the prediction was good it enlarges the ball, and if it was poor it shrinks the ball or rejects the step.",
        invariants: [
            "The proposed step always has norm at most the trust-region radius.",
            "The quadratic model matches the objective and its gradient at the current point.",
            "A step is accepted only when the actual reduction is positive.",
        ],
        correctness:
            "The dogleg path stays inside the ball by construction: it follows the Cauchy point while the Newton point lies outside, otherwise it takes the Newton point directly. The ratio of actual to predicted reduction measures model quality. Accepting only when the ratio is positive guarantees the objective never increases, and the radius adjustments ensure progress: a shrinking ball eventually makes the model accurate enough for a positive ratio unless the gradient is already zero, which is a stationary point and, for a positive-definite quadratic, the global minimizer.",
        complexityRationale:
            "Each iteration forms the gradient, solves one 2 by 2 system, evaluates the model and objective, and updates the radius, all constant work, so k iterations cost O(k). Only the current point, model coefficients, and radius are stored, giving O(1) space.",
        uses: [
            "Nonlinear least squares and curve fitting",
            "Constrained and unconstrained optimization in scientific software",
            "Training models where Newton steps must be globally stabilized",
        ],
        references: [
            "Conn, Gould and Toint, Trust-Region Methods, 2000",
            "Nocedal and Wright, Numerical Optimization, Chapter 4, 2006",
        ],
        workedExample:
            "Minimizing f(x,y) = 2x^2 + y^2 + xy from (3,4): the gradient is (16, 11) and the Hessian is [[4,1],[1,2]]. The Newton step is about (-2.93, -4.29), reaching roughly (0.07, -0.29) when the radius allows it. Because the model is exact, the actual and predicted reductions match, the ratio is one, the radius grows, and the next step lands at the minimizer (0,0).",
    },
    id: "trust-region-method",
    name: "Trust-Region Method (Dogleg Step)",
    category: "numerical-optimization",
    complexity: { time: "O(k)", space: "O(1)" },
    defaultInput: { a: 4, b: 1, d: 2, start: [3, 4], delta: 10, maxIter: 8 },
    visualType: "point",
    run,
    pseudocode: [
        "choose an initial point and trust-region radius",
        "at the current point build a quadratic model",
        "compute the Newton step and the Cauchy point",
        "take the dogleg step inside the radius",
        "compare actual with predicted reduction",
        "accept the step when the ratio is good",
        "grow or shrink the radius from the ratio",
        "stop when the gradient is tiny",
        "done: report the final point and objective",
    ],
};

export default module;
