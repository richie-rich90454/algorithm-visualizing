/**
 * proximal-gradient.ts - Proximal Gradient Descent (L1 Regularization)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Proximal gradient minimizes a smooth loss plus a nonsmooth regularizer. It
 * takes a gradient step on the smooth part and then applies the proximity
 * operator of the regularizer. For an L1 penalty the proximity operator is
 * soft thresholding, which drives small coefficients exactly to zero and
 * produces sparse solutions.
 *
 * The one-dimensional problem minimize (1/2)(x - a)^2 + lambda*|x| has the
 * closed-form solution sign(a)*max(|a| - lambda, 0), so every iterate and the
 * final answer can be checked exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations) for this scalar problem
 *   Space: O(1) for the current iterate
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current iterate, the closed-form optimum, and the objective.
 *   - The iterate bar is highlighted as it moves toward the optimum.
 *   - The final frame is green once soft thresholding reaches the optimum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Soft-thresholding operator. */
function softThreshold(x: number, threshold: number): number {
    if (x > threshold) {
        return x - threshold;
    }
    if (x < -threshold) {
        return x + threshold;
    }
    return 0;
}

/** Objective value at x. */
function objective(x: number, a: number, lambda: number): number {
    return 0.5 * (x - a) * (x - a) + lambda * Math.abs(x);
}

/** Build the three bars for a frame. */
function makeBars(x: number, optimum: number, obj: number, final: boolean): VisualEntity[] {
    const values = [x, optimum, obj];
    const labels = ["x", "optimum", "objective"];
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${labels[index]}=${value.toFixed(5)}`,
        value,
        state: (index === 0 ? (final ? "sorted" : "comparing") : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: labels[index] },
    }));
}

/** The proximal gradient generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { a?: number; lambda?: number; step?: number; iterations?: number; x0?: number } | null
    ) ?? {};
    const a = typeof task.a === "number" ? task.a : 3;
    const lambda = Math.max(0, Number(task.lambda ?? 1));
    const step = Math.min(1, Math.max(Number(task.step ?? 0.5), 1e-6)) || 0.5;
    const iterations = Math.max(1, Math.floor(Number(task.iterations ?? 12)) || 12);
    const optimum = softThreshold(a, lambda);
    let x = typeof task.x0 === "number" ? task.x0 : a;

    let stepNumber = 0;
    yield {
        stepNumber,
        entities: makeBars(x, optimum, objective(x, a, lambda), false),
        edges: [],
        description: `Minimize 0.5*(x - ${a})^2 + ${lambda}*|x|; the closed-form optimum is ${optimum.toFixed(5)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { a, lambda, step, x, optimum, objective: objective(x, a, lambda), error: Math.abs(x - optimum) },
    };
    stepNumber += 1;

    for (let k = 0; k < iterations; k += 1) {
        const gradient = x - a;
        const intermediate = x - step * gradient;
        const next = softThreshold(intermediate, step * lambda);
        x = next;
        const obj = objective(x, a, lambda);
        yield {
            stepNumber,
            entities: makeBars(x, optimum, obj, false),
            edges: [],
            description: `Iteration ${k + 1}: gradient step to ${intermediate.toFixed(5)}, soft threshold to x = ${x.toFixed(5)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                a,
                lambda,
                step,
                iteration: k + 1,
                gradient,
                intermediate,
                x,
                optimum,
                objective: obj,
                error: Math.abs(x - optimum),
            },
        };
        stepNumber += 1;
    }

    yield {
        stepNumber,
        entities: makeBars(x, optimum, objective(x, a, lambda), true),
        edges: [],
        description: `Final x = ${x.toFixed(6)} versus closed-form optimum ${optimum.toFixed(6)}; objective ${objective(x, a, lambda).toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            a,
            lambda,
            step,
            x,
            optimum,
            objective: objective(x, a, lambda),
            error: Math.abs(x - optimum),
        },
    };
}

/** The proximal gradient module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Ordinary gradient descent cannot handle a term like absolute value because it has no derivative at zero. Proximal gradient sidesteps this by taking a gradient step on the smooth part and then applying a separate shrinkage step for the nonsmooth part. That shrinkage, called soft thresholding, is what makes coefficients exactly zero and gives sparse models.",
        invariants: [
            "The smooth part is the quadratic 0.5*(x - a)^2 with gradient x - a.",
            "Each proximal step applies soft thresholding with threshold step times lambda.",
            "The objective value never increases from one iteration to the next.",
        ],
        correctness:
            "The proximity operator of lambda times absolute value is the soft-threshold map, obtained by minimizing 0.5*(z - v)^2 + lambda*|z| in z. Proximal gradient is equivalent to minimizing a quadratic upper bound on the smooth loss plus the regularizer, so each step decreases the objective. For this scalar quadratic the iteration is a contraction toward sign(a)*max(|a| - lambda, 0), and the fixed point satisfies the optimality condition 0 belongs to x - a plus lambda times the subgradient of |x|, which is exactly the closed-form optimum.",
        complexityRationale:
            "Each iteration evaluates one gradient and one soft-threshold operation, both constant time in this scalar example, so the cost is O(iterations). Only the current iterate is kept, giving O(1) space.",
        uses: [
            "A teaching model for L1-regularized regression such as Lasso",
            "Explaining sparsity-inducing proximal operators",
            "A building block for compressed sensing reconstruction",
        ],
        references: [
            "Beck and Teboulle, A Fast Iterative Shrinkage-Thresholding Algorithm, 2009",
            "Boyd and Vandenberghe, Convex Optimization, Chapter 2",
        ],
        workedExample:
            "For a = 3, lambda = 1, and step 0.5 starting at x = 3, the gradient is 2 and the intermediate value is 2. Soft thresholding with threshold 0.5 gives 1.5. Repeating drives x to 2, which is sign(3)*max(3 - 1, 0) and the exact minimizer.",
    },
    id: "proximal-gradient",
    name: "Proximal Gradient Descent (L1)",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { a: 3, lambda: 1, step: 0.5, iterations: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the initial iterate and a step size",
        "compute the gradient of the smooth quadratic at x",
        "take a gradient step to get an intermediate value",
        "apply soft thresholding with threshold step times lambda",
        "set the next iterate to the thresholded value",
        "repeat until the iterate reaches the optimum",
        "done: report x and the objective value",
    ],
};

export default module;
