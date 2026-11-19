/**
 * subgradient-method.ts - Polyak Subgradient Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The subgradient method extends gradient descent to nonsmooth convex
 * functions, which have no gradient at a kink. At each point it picks any
 * subgradient: a vector whose supporting hyperplane lies below the function
 * everywhere. Then it steps in the opposite direction. With the Polyak step
 * size alpha = (f(x) - f*) / ||g||^2, where f* is the known optimum, the
 * iterates converge to the optimal set for a convex function. The demo
 * minimizes f(x, y) = max(x + y, -x, -y), whose optimum is zero at the origin.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * pieces) to evaluate the maximum and its gradient
 *   Space: O(iterations) for the displayed iterate path
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each node is one iterate in the plane.
 *   - The newest point is yellow, earlier points are green.
 *   - The meta reports the point, objective, subgradient, and step size.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SubgradientInput {
    start?: [number, number];
    iterations?: number;
}

/** f(x, y) = max(x+y, -x, -y) and a subgradient of its active piece. */
function evalFunction(x: number, y: number): { value: number; gradient: [number, number] } {
    const pieces: Array<{ value: number; gradient: [number, number] }> = [
        { value: x + y, gradient: [1, 1] },
        { value: -x, gradient: [-1, 0] },
        { value: -y, gradient: [0, -1] },
    ];
    let best = pieces[0]!;
    for (const piece of pieces) {
        if (piece.value > best.value) best = piece;
    }
    return best;
}

function makeEntities(path: Array<[number, number]>): VisualEntity[] {
    return path.map((point, index) => ({
        id: `iterate-${index}`,
        type: "node" as const,
        label: `(${point[0].toFixed(2)},${point[1].toFixed(2)})`,
        value: point,
        state: (index === path.length - 1 ? "comparing" : "visited") as EntityState,
        x: point[0],
        y: point[1],
        width: 0,
        height: 0,
        metadata: { col: index, x: point[0], y: point[1] },
    }));
}

/** The Polyak subgradient generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SubgradientInput | null) ?? {};
    const start: [number, number] =
        Array.isArray(task.start) && task.start.length === 2 && typeof task.start[0] === "number" && typeof task.start[1] === "number"
            ? [task.start[0], task.start[1]]
            : [4, 3];
    const iterations = typeof task.iterations === "number" && task.iterations >= 1 ? Math.floor(task.iterations) : 40;
    const optimum = 0;
    let x = start[0];
    let y = start[1];
    let best = evalFunction(x, y).value;
    const path: Array<[number, number]> = [[x, y]];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: makeEntities(path),
        edges: [],
        description: `Minimizing max(x+y, -x, -y) from (${x}, ${y}); known optimum ${optimum}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { x, y, f: best, subgradient: [0, 0], alpha: 0, iteration: 0, best, done: false },
    };

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const evaluation = evalFunction(x, y);
        const normSq = evaluation.gradient[0] ** 2 + evaluation.gradient[1] ** 2;
        const alpha = (evaluation.value - optimum) / normSq;
        x -= alpha * evaluation.gradient[0];
        y -= alpha * evaluation.gradient[1];
        const value = evalFunction(x, y).value;
        best = Math.min(best, value);
        path.push([x, y]);
        yield {
            stepNumber: step++,
            entities: makeEntities(path),
            edges: [],
            description: `Iteration ${iteration + 1}: subgradient (${evaluation.gradient.join(", ")}), step ${alpha.toFixed(4)}, f = ${value.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: {
                x,
                y,
                f: value,
                subgradient: [...evaluation.gradient],
                alpha,
                iteration: iteration + 1,
                best,
                done: false,
            },
        };
    }

    yield {
        stepNumber: step,
        entities: makeEntities(path),
        edges: [],
        description: `After ${iterations} iterations the best objective is ${best.toFixed(6)} at (${x.toFixed(4)}, ${y.toFixed(4)}).`,
        codeLineNumber: 6,
        layout: "point",
        meta: { x, y, f: evalFunction(x, y).value, subgradient: [0, 0], alpha: 0, iteration: iterations, best, done: true },
    };
}

/** The subgradient method module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "At a sharp corner a convex function has no single slope, but it does have a family of supporting lines called subgradients. Each one still lies entirely below the function, so moving opposite a subgradient decreases the distance to the optimum. The Polyak step size uses the known best value to choose how far to move: the gap divided by the subgradient's squared length. It is simple, needs no line search, and works even when the function is not differentiable.",
        invariants: [
            "Every subgradient satisfies f(z) >= f(x) + g dot (z - x) for all z.",
            "The Polyak step is the objective gap divided by the squared subgradient norm.",
            "The recorded best objective never increases.",
            "The optimum of the demo function is zero, attained at the origin.",
        ],
        correctness:
            "For a convex f with optimum f*, the squared distance from an iterate to an optimal point decreases by at least (f(x)-f*)^2 / ||g||^2 after a Polyak step, because the subgradient inequality bounds the inner product with the optimal point. Summing this descent over iterations shows the objective gap tends to zero and the iterates approach the optimal set. For the demo function the optimum is zero because for any point at least one of x+y, -x, -y is nonnegative, while the origin attains zero.",
        complexityRationale:
            "Each iteration evaluates three affine pieces to find the active one and its subgradient, O(p) for p pieces, then performs constant vector arithmetic. The displayed path stores one point per iteration, O(iterations) space.",
        uses: [
            "Nonsmooth convex optimization in machine learning",
            "Lagrangian dual maximization with subgradients",
            "Large problems where gradients are unavailable but subgradients are cheap",
        ],
        references: [
            "Polyak, Introduction to Optimization, 1987",
            "Shor, Subgradient Methods: A Survey, 1985",
        ],
        workedExample:
            "Starting at (4, 3), the active piece is x + y with value 7 and subgradient (1, 1). The Polyak step is 7/2 = 3.5, giving (0.5, -0.5). There the active piece is -y with value 0.5 and subgradient (0, -1), so a step of 0.5 reaches (0.5, 0). Repeating drives the points toward the origin where the objective is zero.",
    },
    id: "subgradient-method",
    name: "Polyak Subgradient Method",
    category: "numerical-optimization",
    complexity: { time: "O(k * p)", space: "O(k)" },
    defaultInput: { start: [4, 3], iterations: 40 },
    visualType: "point",
    run,
    pseudocode: [
        "choose a starting point and the known optimum value",
        "evaluate the function and choose an active subgradient",
        "set the step to the objective gap over the squared norm",
        "move opposite the subgradient by that step",
        "record the new point and update the best value seen",
        "repeat for the fixed iteration budget",
        "done: report the best point and objective",
    ],
};

export default module;
