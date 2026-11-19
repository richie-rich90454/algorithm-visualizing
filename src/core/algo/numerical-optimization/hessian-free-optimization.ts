/**
 * hessian-free-optimization.ts - Hessian-Free Optimization via Hessian-Vector Products
 *
 * Newton's method converges quickly but forming and factoring a Hessian is
 * expensive. Hessian-free optimization never builds the matrix: it only asks
 * for the product of the Hessian with an arbitrary vector, which can be
 * approximated by differencing two gradients. A conjugate-gradient solve uses
 * those products to find the Newton direction inside a Krylov subspace, and a
 * damping term keeps the quadratic model trusted near the current point.
 *
 * Time O(outer * cg * gradient evaluations); space O(dimension * cg) for the
 * conjugate-gradient search directions.
 *
 * Visualization: each outer iterate is a point with a green final marker.
 * Meta reports the objective, gradient norm, and conjugate-gradient steps.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HfInput {
    objective?: "quadratic" | "rosenbrock";
    x0?: number;
    y0?: number;
    damping?: number;
    outer?: number;
    cg?: number;
}

type Point = [number, number];

/** The quadratic objective is 0.5 x^T Q x - b^T x with a known minimizer. */
function quadratic(point: Point): number {
    const x = point[0];
    const y = point[1];
    return 0.5 * (4 * x * x + 2 * x * y + 2 * y * y) - 6 * x - 4 * y;
}

function quadraticGradient(point: Point): Point {
    return [4 * point[0] + point[1] - 6, point[0] + 2 * point[1] - 4];
}

function rosenbrock(point: Point): number {
    const x = point[0];
    const y = point[1];
    const inner = y - x * x;
    return (1 - x) * (1 - x) + 100 * inner * inner;
}

function rosenbrockGradient(point: Point): Point {
    const x = point[0];
    const y = point[1];
    const inner = y - x * x;
    return [-2 * (1 - x) - 400 * x * inner, 200 * inner];
}

/** Approximate the Hessian-vector product by central differences of the gradient. */
function hessianVector(
    point: Point,
    vector: Point,
    gradient: (p: Point) => Point,
): Point {
    const epsilon = 1e-5 / Math.max(1, Math.hypot(vector[0], vector[1]));
    const plus = gradient([point[0] + epsilon * vector[0], point[1] + epsilon * vector[1]]);
    const minus = gradient([point[0] - epsilon * vector[0], point[1] - epsilon * vector[1]]);
    return [(plus[0] - minus[0]) / (2 * epsilon), (plus[1] - minus[1]) / (2 * epsilon)];
}

/** Conjugate gradient on the damped Hessian system H p = -g. */
function conjugateGradient(
    point: Point,
    gradientAtPoint: Point,
    gradient: (p: Point) => Point,
    damping: number,
    maxIterations: number,
): { direction: Point; steps: number } {
    const rhs: Point = [-gradientAtPoint[0], -gradientAtPoint[1]];
    let direction: Point = [...rhs];
    let residual: Point = [...rhs];
    let solution: Point = [0, 0];
    let residualNorm = residual[0] * residual[0] + residual[1] * residual[1];
    const threshold = Math.max(1e-14, residualNorm * 1e-12);
    let steps = 0;
    for (; steps < maxIterations && residualNorm > threshold; steps += 1) {
        const product = hessianVector(point, direction, gradient);
        const curved: Point = [product[0] + damping * direction[0], product[1] + damping * direction[1]];
        const denominator = direction[0] * curved[0] + direction[1] * curved[1];
        if (Math.abs(denominator) < 1e-14) break;
        const alpha = residualNorm / denominator;
        solution = [solution[0] + alpha * direction[0], solution[1] + alpha * direction[1]];
        const updated: Point = [
            residual[0] - alpha * curved[0],
            residual[1] - alpha * curved[1],
        ];
        const nextNorm = updated[0] * updated[0] + updated[1] * updated[1];
        const beta = nextNorm / residualNorm;
        direction = [updated[0] + beta * direction[0], updated[1] + beta * direction[1]];
        residual = updated;
        residualNorm = nextNorm;
    }
    return { direction: solution, steps };
}

function makeEntities(path: Point[], current: Point, final: boolean): VisualEntity[] {
    const entities: VisualEntity[] = path.map((point, index) => ({
        id: `iter-${index}`,
        type: "node" as const,
        label: index === 0 ? "start" : String(index),
        value: index,
        state: (final && index === path.length - 1 ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { kind: "iterate", index, x: point[0], y: point[1] },
    }));
    entities.push({
        id: "current",
        type: "node" as const,
        label: "current",
        value: 0,
        state: "pivot",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { kind: "current", x: current[0], y: current[1] },
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HfInput | null) ?? {};
    const useRosenbrock = task.objective === "rosenbrock";
    const value = useRosenbrock ? rosenbrock : quadratic;
    const gradient = useRosenbrock ? rosenbrockGradient : quadraticGradient;
    let point: Point = [Number(task.x0 ?? -2), Number(task.y0 ?? 2)];
    const damping = Math.max(0, Number(task.damping ?? (useRosenbrock ? 1 : 0)) || 0);
    const outer = Math.max(1, Math.min(100, Math.floor(Number(task.outer ?? (useRosenbrock ? 60 : 8))) || 8));
    const cgLimit = Math.max(1, Math.min(200, Math.floor(Number(task.cg ?? 24)) || 24));
    const path: Point[] = [[...point]];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(path, point, false),
        edges: [],
        description: `Hessian-free optimization starts at (${point[0].toFixed(2)}, ${point[1].toFixed(2)}) using Hessian-vector products.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { iteration: 0, x: [...point], objective: value(point), gradientNorm: Math.hypot(...gradient(point)), cgSteps: 0, damping },
    };
    step += 1;

    for (let iteration = 1; iteration <= outer; iteration += 1) {
        const gradientAtPoint = gradient(point);
        const solve = conjugateGradient(point, gradientAtPoint, gradient, damping, cgLimit);
        point = [point[0] + solve.direction[0], point[1] + solve.direction[1]];
        path.push([...point]);
        const currentGradient = gradient(point);
        yield {
            stepNumber: step,
            entities: makeEntities(path, point, iteration === outer),
            edges: [],
            description: `Newton step ${iteration}: objective ${value(point).toFixed(6)}, gradient norm ${Math.hypot(...currentGradient).toFixed(5)}.`,
            codeLineNumber: iteration === outer ? 8 : 4,
            layout: "point",
            meta: {
                iteration,
                x: [...point],
                objective: value(point),
                gradientNorm: Math.hypot(...currentGradient),
                cgSteps: solve.steps,
                damping,
                pathLength: path.length,
            },
        };
        step += 1;
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Newton step needs to know how the gradient changes in every direction, which normally means storing a full Hessian matrix. Hessian-free methods avoid that by asking only what the Hessian does to one vector at a time. Central differences of the gradient supply that product, and conjugate gradient uses a short sequence of products to solve for the step without ever materializing the matrix.",
        invariants: [
            "The Hessian-vector product is computed only from gradient evaluations, never from a stored matrix.",
            "Conjugate-gradient directions are mutually compatible under the damped Hessian inner product.",
            "A positive damping term keeps the quadratic model strictly convex during the solve.",
        ],
        correctness:
            "The central difference of the gradient converges to the true Hessian times a vector as the step tends to zero, which follows from the Taylor expansion of a twice differentiable function. Conjugate gradient minimizes the quadratic model over successive Krylov subspaces, so with an exact Hessian-vector product on a quadratic objective it finds the Newton direction in at most two dimensions. The test checks the product against the explicit matrix and checks that the iterate reaches the exact quadratic minimizer.",
        complexityRationale:
            "Each conjugate-gradient iteration needs one Hessian-vector product, which costs two gradient evaluations, so an outer step costs O(cg * gradient cost). The method stores a handful of vectors of length dimension rather than a dimension by dimension matrix, giving O(dimension * cg) space at most.",
        uses: [
            "Training large neural networks with curvature information",
            "Solving nonlinear finite-element and optimization problems",
            "Second-order methods on problems where the Hessian is too large to form",
        ],
        references: [
            "Martens, Deep Learning with Hessian-Free Optimization, 2010",
            "Nocedal and Wright, Numerical Optimization, Chapter 7",
        ],
        workedExample:
            "For the quadratic with Hessian [[4,1],[1,2]] and linear term [6,4], the exact minimizer is (8/7, 10/7). Starting from (-2,2), a single undamped Hessian-free Newton step lands on that point to numerical precision, and the conjugate-gradient solve finishes in at most two directions.",
    },
    id: "hessian-free-optimization",
    name: "Hessian-Free Optimization",
    category: "numerical-optimization",
    complexity: { time: "O(outer * cg * gradient cost)", space: "O(dim * cg)" },
    defaultInput: { objective: "quadratic", x0: -2, y0: 2, damping: 0, outer: 8, cg: 24 },
    visualType: "point",
    run,
    pseudocode: [
        "choose an objective and an initial point",
        "evaluate the gradient at the current point",
        "approximate Hessian times vector by differencing gradients",
        "run conjugate gradient on the damped Hessian system",
        "obtain the Newton direction from the solve",
        "step the parameters by that direction",
        "record the objective and gradient norm",
        "repeat until the outer iteration budget is used",
        "done: report the final point and objective",
    ],
};

export default module;
