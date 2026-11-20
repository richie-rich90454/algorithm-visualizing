/**
 * accelerated-proximal-gradient.ts - Accelerated Proximal Gradient (FISTA)
 *
 * Minimizes a smooth convex function plus a nonsmooth convex regularizer by a
 * proximal gradient step at an extrapolated point. The momentum sequence makes
 * the objective error fall as O(1/k^2) instead of the O(1/k) of plain proximal
 * gradient, at the cost of a small amount of extra state.
 *
 * This demo solves a fixed two-variable least-squares problem with an L1 term.
 * The minimizer is known in closed form for the chosen data. It does not
 * implement backtracking, restart strategies, or general dimensions.
 *
 * Time:  O(iterations * dimension^2)
 * Space: O(dimension) for the iterate and momentum vectors
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    lambda?: number;
    iterations?: number;
}

type Vec2 = [number, number];

const soft = (v: number, t: number): number => (v > t ? v - t : v < -t ? v + t : 0);

function objective(x: Vec2, lambda: number): number {
    const r0 = x[0] + x[1] - 3;
    const r1 = x[1] - 2;
    return 0.5 * (r0 * r0 + r1 * r1) + lambda * (Math.abs(x[0]) + Math.abs(x[1]));
}

function makeBars(x: Vec2, value: number, step: number): VisualEntity[] {
    const labels = ["x0", "x1", "objective", "step size"];
    const values = [x[0], x[1], value, step];
    return values.map((v, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: `${labels[i]}=${v.toFixed(6)}`,
        value: v,
        state: i === 2 ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, role: labels[i] },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const lambda = Number.isFinite(task.lambda) && Number(task.lambda) >= 0 ? Number(task.lambda) : 0.5;
    const iterations = Math.min(1000, Math.max(1, Math.floor(Number(task.iterations ?? 200)) || 200));
    // A = [[1,1],[0,1]], so A^T A has largest eigenvalue (3+sqrt5)/2.
    const L = (3 + Math.sqrt(5)) / 2;
    const step = 1 / L;

    let x: Vec2 = [0, 0];
    let y: Vec2 = [0, 0];
    let t = 1;

    yield {
        stepNumber: 0,
        entities: makeBars(x, objective(x, lambda), step),
        edges: [],
        description: `Accelerated proximal gradient on a 2-variable L1 least-squares problem with lambda=${lambda}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x: [...x], objective: objective(x, lambda), stepSize: step, lambda, iteration: 0 },
    };

    let stepNo = 1;
    for (; stepNo <= iterations; stepNo += 1) {
        const gy: Vec2 = [y[0] + y[1] - 3, y[0] + 2 * y[1] - 5];
        const z0 = y[0] - step * gy[0];
        const z1 = y[1] - step * gy[1];
        const next: Vec2 = [soft(z0, lambda * step), soft(z1, lambda * step)];
        const tNext = (1 + Math.sqrt(1 + 4 * t * t)) / 2;
        const beta = (t - 1) / tNext;
        const nextY: Vec2 = [next[0] + beta * (next[0] - x[0]), next[1] + beta * (next[1] - x[1])];
        x = next;
        y = nextY;
        t = tNext;

        yield {
            stepNumber: stepNo,
            entities: makeBars(x, objective(x, lambda), step),
            edges: [],
            description: `Iteration ${stepNo}: x=(${x[0].toFixed(7)}, ${x[1].toFixed(7)}), objective ${objective(x, lambda).toFixed(9)}, momentum t=${t.toFixed(2)}.`,
            codeLineNumber: stepNo === 1 ? 3 : 6,
            layout: "array",
            meta: { x: [...x], objective: objective(x, lambda), stepSize: step, lambda, iteration: stepNo, momentum: t },
        };
    }

    yield {
        stepNumber: stepNo,
        entities: makeBars(x, objective(x, lambda), step),
        edges: [],
        description: `After ${iterations} iterations x=(${x[0].toFixed(8)}, ${x[1].toFixed(8)}) with objective ${objective(x, lambda).toFixed(10)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { x: [...x], objective: objective(x, lambda), stepSize: step, lambda, iteration: iterations, momentum: t },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A proximal gradient step takes a gradient step on the smooth part and then applies the proximal operator of the nonsmooth part, which here is soft thresholding. Acceleration evaluates that step at an extrapolated point built from the last two iterates. The extrapolation cancels the leading error term, so each iteration is still cheap but the objective converges much faster.",
        invariants: [
            "The step size equals the reciprocal of the Lipschitz constant of the smooth gradient.",
            "The momentum parameter grows so that the accumulated weights satisfy the acceleration identity.",
            "The objective at the final iterate is no worse than the objective at the initial point.",
        ],
        correctness:
            "The smooth part has gradient Lipschitz constant equal to the largest eigenvalue of A transpose A, which is (3+sqrt5)/2 for this A, so the chosen step is admissible. FISTA's analysis bounds the objective gap after k iterations by a constant times the squared distance to the optimum divided by k squared. The test checks convergence against the closed-form minimizer of 0.5||Ax-b||^2 + lambda||x||_1, which for lambda=0.5 is (0.5, 2).",
        complexityRationale:
            "Each iteration forms one gradient-vector product and two soft thresholds, O(d^2) for a d by d matrix, so with d fixed the cost is O(iterations). Only the iterate, the extrapolated point, and scalars are kept, giving O(d) space.",
        uses: [
            "L1-regularized regression and sparse signal recovery",
            "Large-scale convex optimization with cheap gradient evaluations",
            "A baseline for comparing restarted and adaptive accelerated methods",
        ],
        references: [
            "Beck and Teboulle, A Fast Iterative Shrinkage-Thresholding Algorithm, 2009",
            "Nesterov, Introductory Lectures on Convex Optimization, 2004",
        ],
        workedExample:
            "With lambda=0.5 the objective is 0.5[(x0+x1-3)^2 + (x1-2)^2] + 0.5(|x0|+|x1|). Setting derivatives to zero in the positive quadrant gives x1=2 and x0=0.5. FISTA starting at the origin reaches this point to several decimals within a few hundred iterations, and its objective trails a plain proximal gradient run by a wide margin.",
    },
    id: "accelerated-proximal-gradient",
    name: "Accelerated Proximal Gradient (FISTA)",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * dimension^2)", space: "O(dimension)" },
    defaultInput: { lambda: 0.5, iterations: 200 },
    visualType: "array",
    run,
    pseudocode: [
        "read the regularization weight and iteration count",
        "set the iterate and extrapolated point to zero and momentum to one",
        "compute the smooth gradient at the extrapolated point",
        "take a gradient step and apply soft thresholding",
        "update the momentum parameter from the previous value",
        "form the next extrapolated point with the momentum weight",
        "repeat until the iteration count is reached",
        "done: report the final point and objective value",
    ],
};

export default module;
