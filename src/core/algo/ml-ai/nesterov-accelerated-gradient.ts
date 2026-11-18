/**
 * nesterov-accelerated-gradient.ts - Nesterov Accelerated Gradient Descent
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Nesterov accelerated gradient improves momentum descent by evaluating the
 * gradient at the lookahead point the momentum term would carry us to, rather
 * than at the current position. Seeing where momentum is about to take us lets
 * the correction cancel wasted motion before a step is committed, which yields
 * faster convergence on smooth convex functions. This demo minimizes the
 * one-dimensional quadratic f(x) = x^2 so every update is exact.
 *
 * This is a faithful implementation of the NAG update rule on a toy objective,
 * not a full training framework.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations)
 *   Space: O(iterations) for the replayed parameter history
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each bar is the parameter value after one update.
 *   - The newest bar is active; older bars are green.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface NAGInput {
    start?: number;
    learningRate?: number;
    momentum?: number;
    iterations?: number;
}

/** One bar per recorded parameter value. */
function bars(values: number[], current: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `theta-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(6)),
        state:
            index === current ? ("active" as const) : index < current ? ("sorted" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** Run Nesterov accelerated gradient on f(x) = x^2. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as NAGInput | null) ?? {};
    const start = typeof task.start === "number" ? task.start : 5;
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.1;
    const mu = typeof task.momentum === "number" ? task.momentum : 0.9;
    const iterations = Math.max(
        1,
        Math.min(typeof task.iterations === "number" ? task.iterations : 12, 60),
    );

    let theta = start;
    let velocity = 0;
    const history: number[] = [theta];
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(history, 0),
        edges: [],
        description: `Minimizing f(x) = x^2 from x = ${start} with learning rate ${lr} and momentum ${mu}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { theta, velocity, iteration: 0, objective: theta * theta },
    };
    step += 1;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const lookahead = theta + mu * velocity;
        const gradient = 2 * lookahead;
        velocity = mu * velocity - lr * gradient;
        theta = theta + velocity;
        history.push(theta);
        const last = iteration === iterations - 1;
        yield {
            stepNumber: step,
            entities: bars(history, history.length - 1),
            edges: [],
            description: `Update ${iteration + 1}: lookahead ${lookahead.toFixed(3)}, gradient ${gradient.toFixed(3)}, new x ${theta.toFixed(3)}.`,
            codeLineNumber: last ? 6 : 4,
            layout: "array",
            meta: {
                theta: Number(theta.toFixed(8)),
                velocity: Number(velocity.toFixed(8)),
                lookahead: Number(lookahead.toFixed(8)),
                gradient: Number(gradient.toFixed(8)),
                iteration: iteration + 1,
                objective: Number((theta * theta).toFixed(8)),
            },
        };
        step += 1;
    }
}

/** The Nesterov accelerated gradient module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Momentum alone keeps pushing in the previous direction even when the slope has already turned. Nesterov momentum first peeks at where that push would land, measures the slope there, and uses that lookahead slope to correct the step. The extra look damps overshoot and reaches the minimum in fewer updates.",
        invariants: [
            "The objective is the quadratic f(x) = x^2, whose gradient at any point is 2x.",
            "The gradient is always evaluated at the lookahead point x + momentum times velocity.",
            "Velocity is updated before the position, and the new position is the old position plus the new velocity.",
        ],
        correctness:
            "For a convex quadratic the NAG recurrence is a stable linear system: combining the velocity and position updates gives a matrix whose eigenvalues lie inside the unit disk when the learning rate and momentum are chosen in range. The distance to the minimizer therefore shrinks each iteration, so the iterate converges to zero.",
        complexityRationale:
            "Each iteration does a constant number of arithmetic operations to form the lookahead, gradient, velocity, and position, giving O(iterations) time. The replayed parameter history uses O(iterations) space.",
        uses: [
            "Accelerating stochastic gradient descent for deep network training",
            "Speeding up convex optimization in logistic and linear models",
            "A teaching bridge between plain momentum and optimal first-order methods",
        ],
        references: [
            "Nesterov, A Method for Unconstrained Convex Minimization, 1983",
            "Sutskever et al., On the Importance of Initialization and Momentum in Deep Learning, 2013",
        ],
        workedExample:
            "Starting at x = 5 with learning rate 0.1 and momentum 0.9, the first velocity is 0 - 0.1 times 2 times 5 = -1, so x drops to 4. The second step uses lookahead 4 + 0.9 times -1 = 3.1, giving gradient 6.2 and a larger correction. The sequence spirals in toward zero.",
    },
    id: "nesterov-accelerated-gradient",
    name: "Nesterov Accelerated Gradient",
    category: "ml-ai",
    complexity: { time: "O(iterations)", space: "O(iterations)" },
    defaultInput: { start: 5, learningRate: 0.1, momentum: 0.9, iterations: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "set x to the start value and velocity to zero",
        "repeat for a fixed number of iterations",
        "lookahead equals x plus momentum times velocity",
        "evaluate the gradient at the lookahead point",
        "velocity equals momentum times velocity minus learning rate times gradient",
        "add velocity to x",
        "done: report the final x and its objective value",
    ],
};

export default module;
