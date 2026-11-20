/**
 * penalty-method.ts - Quadratic Penalty Method for Constrained Minimization
 *
 * Converts a constrained problem into a sequence of unconstrained ones by
 * adding a term that grows with the amount by which a constraint is violated.
 * As the penalty weight increases, the minimizer of the penalized objective
 * approaches the constrained solution from the infeasible side.
 *
 * This demo solves minimize (x - target)^2 subject to x <= bound. The penalized
 * minimizer has a closed form, so the sequence can be checked exactly. It does
 * not implement equality constraints, nonquadratic penalties, or a stopping
 * test based on dual estimates.
 *
 * Time:  O(iterations)
 * Space: O(1) for the iterate and scalars
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    target?: number;
    bound?: number;
    mu0?: number;
    growth?: number;
    iterations?: number;
}

function makeBars(mu: number, x: number, violation: number, trueObjective: number): VisualEntity[] {
    const labels = ["penalty mu", "x", "violation", "objective"];
    const values = [mu, x, violation, trueObjective];
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
    const target = Number.isFinite(task.target) ? Number(task.target) : 3;
    const bound = Number.isFinite(task.bound) ? Number(task.bound) : 1;
    const mu0 = Number.isFinite(task.mu0) && Number(task.mu0) > 0 ? Number(task.mu0) : 1;
    const growth = Number.isFinite(task.growth) && Number(task.growth) > 1 ? Number(task.growth) : 2;
    const iterations = Math.min(200, Math.max(1, Math.floor(Number(task.iterations ?? 20)) || 20));

    let mu = mu0;
    let step = 0;
    yield {
        stepNumber: 0,
        entities: makeBars(mu, target, Math.max(0, target - bound), 0),
        edges: [],
        description: `Constrained problem: minimize (x - ${target})^2 with x <= ${bound}; penalty weight begins at ${mu}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { mu, x: target, violation: Math.max(0, target - bound), objective: 0, iteration: 0 },
    };

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const x = target > bound ? (target + mu * bound) / (1 + mu) : target;
        const violation = Math.max(0, x - bound);
        const trueObjective = (x - target) ** 2;
        const penalized = trueObjective + mu * violation ** 2;
        yield {
            stepNumber: iteration,
            entities: makeBars(mu, x, violation, trueObjective),
            edges: [],
            description: `Iteration ${iteration}: mu=${mu.toExponential(3)}, x=${x.toFixed(8)}, constraint violation ${violation.toExponential(3)}, penalized value ${penalized.toExponential(4)}.`,
            codeLineNumber: iteration === 1 ? 2 : 4,
            layout: "array",
            meta: { mu, x, violation, objective: trueObjective, penalized, iteration },
        };
        mu *= growth;
        step = iteration;
    }

    const x = target > bound ? (target + mu0 * growth ** (iterations - 1) * bound) / (1 + mu0 * growth ** (iterations - 1)) : target;
    const violation = Math.max(0, x - bound);
    yield {
        stepNumber: step + 1,
        entities: makeBars(mu, x, violation, (x - target) ** 2),
        edges: [],
        description: `After ${iterations} penalty levels x=${x.toFixed(10)} and the constraint violation is ${violation.toExponential(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { mu, x, violation, objective: (x - target) ** 2, iteration: iterations, converged: violation < 1e-4 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A penalty method replaces a hard constraint with a soft cost. Violating x <= bound now costs an amount proportional to the square of the overshoot times a weight. With a small weight the unconstrained minimizer ignores the constraint; as the weight grows, staying near the feasible boundary becomes cheaper than paying the overshoot, so the solution is pushed toward the boundary.",
        invariants: [
            "The penalty weight grows by a constant factor at each level.",
            "The violation is nonnegative and decreases as the weight increases.",
            "For a quadratic objective and one linear inequality the penalized minimizer is available in closed form.",
        ],
        correctness:
            "The penalized objective (x-target)^2 + mu max(0, x-bound)^2 is convex. When target exceeds bound its stationary point is x=(target + mu bound)/(1+mu), which is decreasing in mu and converges to bound as mu tends to infinity. Hence the limit point satisfies the constraint with equality and attains the true constrained minimum, so the method is exact only in the limit; this demo shows a finite increasing sequence and states the residual violation.",
        complexityRationale:
            "Each level evaluates a constant number of arithmetic operations, so the time cost is O(iterations) with O(1) working space. The frames record a short summary of every level.",
        uses: [
            "Turning constrained engineering designs into unconstrained searches",
            "A simple baseline before moving to barrier or augmented Lagrangian methods",
            "Teaching the idea of soft constraints in optimization",
        ],
        references: [
            "Nocedal and Wright, Numerical Optimization, Second Edition, Chapter 17",
            "Courant, Variational Problems with Fixed and Free Boundaries, 1943",
        ],
        workedExample:
            "Minimize (x-3)^2 with x <= 1. At mu=1 the penalized minimizer is x=2 with violation 1; at mu=2 it is x=5/3 with violation about 0.67; after twenty doublings x is within a few millionths of the boundary 1, the constrained optimum.",
    },
    id: "penalty-method",
    name: "Quadratic Penalty Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { target: 3, bound: 1, mu0: 1, growth: 2, iterations: 20 },
    visualType: "array",
    run,
    pseudocode: [
        "read the target, bound, initial weight, and growth factor",
        "set the penalty weight to its initial value",
        "solve the unconstrained penalized problem in closed form",
        "compute the constraint violation and true objective",
        "increase the penalty weight by the growth factor",
        "repeat for the required number of levels",
        "done: report the final point and remaining violation",
    ],
};

export default module;
