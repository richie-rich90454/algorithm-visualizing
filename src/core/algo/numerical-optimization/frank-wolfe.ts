/**
 * frank-wolfe.ts - Frank-Wolfe Conditional Gradient on a Box
 *
 * Minimizes a smooth convex quadratic over the unit box by repeatedly solving
 * a linear minimization oracle (LMO) over the box and moving a diminishing
 * step toward that linear minimizer. No projection is used, only linear
 * subproblems. This is the conditional-gradient / Frank-Wolfe method; it is
 * distinct from projected gradient and proximal methods.
 *
 * The demo is exact for a quadratic objective over the unit box. It does not
 * cover general constraints, line search, or non-quadratic objectives.
 *
 * Time:  O(iterations * d) for dimension d
 * Space: O(d)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    target?: number[];
    iterations?: number;
}

function makeBars(x: number[], active: number): VisualEntity[] {
    return x.map((value, i) => ({
        id: `dim-${i}`,
        type: "bar" as const,
        label: `x${i}=${value.toFixed(4)}`,
        value,
        state: i === active ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const target = Array.isArray(task.target) && task.target.length > 0
        ? task.target.map((v) => Number(v) || 0)
        : [1.3, -0.2, 0.5];
    const iterations = Math.min(500, Math.max(1, Math.floor(Number(task.iterations ?? 120)) || 120));
    const d = target.length;

    let x = new Array<number>(d).fill(0.5);
    const objective = (v: number[]): number =>
        0.5 * v.reduce((sum, value, i) => sum + (value - (target[i] ?? 0)) ** 2, 0);

    const metaFor = (iter: number, step: number, gap: number) => ({
        iteration: iter,
        x: [...x],
        target: [...target],
        stepSize: step,
        objective: objective(x),
        dualityGap: gap,
        minimizer: target.map((v) => Math.min(1, Math.max(0, v))),
    });

    yield {
        stepNumber: 0,
        entities: makeBars(x, -1),
        edges: [],
        description: `Minimize a convex quadratic over the unit box in ${d} dimensions with Frank-Wolfe conditional gradient.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(0, 0, objective(x)),
    };

    for (let iter = 0; iter < iterations; iter += 1) {
        const gradient = x.map((value, i) => value - (target[i] ?? 0));
        const s = gradient.map((g) => (g < 0 ? 1 : 0));
        const step = 2 / (iter + 2);
        const direction = s.map((sv, i) => sv - (x[i] ?? 0));
        const gap = direction.reduce((sum, di, i) => sum + di * (gradient[i] ?? 0), 0);

        for (let i = 0; i < d; i += 1) {
            x[i] = (x[i] ?? 0) + step * (direction[i] ?? 0);
        }

        yield {
            stepNumber: iter + 1,
            entities: makeBars(x, gradient.findIndex((g) => g < 0)),
            edges: [],
            description: `Iteration ${iter + 1}: LMO picked the box corner, step ${step.toFixed(4)}, objective ${objective(x).toFixed(6)}, duality gap ${gap.toExponential(2)}.`,
            codeLineNumber: iter === 0 ? 2 : 5,
            layout: "array",
            meta: metaFor(iter + 1, step, gap),
        };
    }

    yield {
        stepNumber: iterations + 1,
        entities: makeBars(x, -1),
        edges: [],
        description: `Final point ${x.map((v) => v.toFixed(5)).join(", ")} with objective ${objective(x).toFixed(8)} after ${iterations} steps.`,
        codeLineNumber: 7,
        layout: "array",
        meta: metaFor(iterations, 0, 0),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Constrained optimization is easier if each step solves only a linear problem instead of projecting onto the constraint set. Frank-Wolfe asks which feasible corner best matches the negative gradient, then takes a small step toward that corner. Because the feasible set is a box, the linear oracle is just a per-coordinate choice of zero or one.",
        invariants: [
            "Every iterate stays inside the unit box because it is a convex combination of previous points and a corner.",
            "The duality gap is the inner product of the gradient with the linear-oracle direction and is never negative.",
            "The step size two over k plus two sums to infinity while its square sums to a finite value.",
        ],
        correctness:
            "For a convex differentiable objective the linear minimization oracle gives a direction whose inner product with the gradient is the Frank-Wolfe gap, an upper bound on the true optimality gap. With the diminishing step two over k plus two, the average gap decreases to zero at rate O(1/k), so every limit point is a minimizer. For the quadratic demo the unique minimizer is the target clipped to the box, and the iterates converge to it.",
        complexityRationale:
            "Each iteration computes the gradient, solves the linear oracle, and updates d coordinates, all O(d) work. Only the current point, target, and a few scalars are stored, giving O(d) space.",
        uses: [
            "Large-scale constrained optimization where projection is expensive",
            "Sparse regression and matrix completion with polytope constraints",
            "Traffic assignment and minimum-cost flow decompositions",
        ],
        references: [
            "Frank and Wolfe, An Algorithm for Quadratic Programming, Naval Research Logistics Quarterly, 1956",
            "Jaggi, Revisiting Frank-Wolfe, ICML 2013",
        ],
        workedExample:
            "With target (1.3, minus 0.2, 0.5) the box minimizer is (1, 0, 0.5). The first gradient points toward the corner (1, 0, 1) and a step of one half moves the point partway; later steps shrink and the iterate approaches the clipped target.",
    },
    id: "frank-wolfe",
    name: "Frank-Wolfe Conditional Gradient",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * d)", space: "O(d)" },
    defaultInput: { target: [1.3, -0.2, 0.5], iterations: 120 },
    visualType: "array",
    run,
    pseudocode: [
        "start at an interior point of the unit box",
        "for each iteration compute the objective gradient",
        "solve the linear oracle by choosing zero or one per coordinate",
        "form the direction from the corner back to the current point",
        "compute the Frank-Wolfe duality gap",
        "take a diminishing step of two over k plus two",
        "move the current point along that direction",
        "stop after the fixed iteration budget",
        "done: report the final point and objective",
    ],
};

export default module;
