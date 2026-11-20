/**
 * adasgd.ts - AdaSGD Adaptive Stochastic Gradient Descent
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AdaSGD combines classical momentum with a per-parameter step size that
 * shrinks as squared gradients accumulate, in the spirit of AdaGrad. The
 * accumulated squared gradient rescales a plain velocity term, so frequently
 * moving parameters get smaller effective steps while rare ones keep larger
 * steps. The demo minimizes a one-dimensional quadratic with an exact gradient
 * so the full update sequence is deterministic and checkable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations)
 *   Space: O(iterations) for the plotted loss history
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame appends a (iteration, loss) point to the loss curve.
 *   - The most recent point is highlighted; earlier points are visited.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build the loss-curve points seen so far. */
function makeEntities(history: number[], current: number): VisualEntity[] {
    return history.map((loss, index) => ({
        id: `loss-${index}`,
        type: "node" as const,
        label: loss.toFixed(3),
        value: loss,
        state: (index === current ? "comparing" : "visited") as EntityState,
        x: index,
        y: loss,
        width: 0,
        height: 0,
        metadata: { iteration: index, loss },
    }));
}

/** Objective: (w - target)^2, whose exact gradient is 2*(w - target). */
function lossAt(w: number, target: number): number {
    return (w - target) * (w - target);
}

/** The AdaSGD generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            target?: number;
            start?: number;
            iterations?: number;
            learningRate?: number;
            momentum?: number;
            epsilon?: number;
        } | null
    ) ?? {};
    const target = typeof task.target === "number" ? task.target : 3;
    const start = typeof task.start === "number" ? task.start : 0;
    const iterations = typeof task.iterations === "number" ? Math.max(1, task.iterations) : 30;
    const rate = typeof task.learningRate === "number" ? task.learningRate : 0.5;
    const momentum = typeof task.momentum === "number" ? task.momentum : 0.9;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;

    let w = start;
    let velocity = 0;
    let accumulated = 0;
    const history: number[] = [lossAt(w, target)];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(history, 0),
        edges: [],
        description: `AdaSGD minimizing (w - ${target})^2 from w = ${start}, learning rate ${rate}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { iteration: 0, weight: w, loss: history[0], velocity, accumulated },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const gradient = 2 * (w - target);
        velocity = momentum * velocity + gradient;
        accumulated += gradient * gradient;
        w -= (rate * velocity) / (Math.sqrt(accumulated) + epsilon);
        const loss = lossAt(w, target);
        history.push(loss);

        yield {
            stepNumber: step,
            entities: makeEntities(history, history.length - 1),
            edges: [],
            description: `Iteration ${iteration}: gradient ${gradient.toFixed(3)}, adaptive step ${((rate * velocity) / (Math.sqrt(accumulated) + epsilon)).toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: iteration < iterations ? 5 : 7,
            layout: "point",
            meta: { iteration, weight: w, loss, gradient, velocity, accumulated },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(history, -1),
        edges: [],
        description: `Finished after ${iterations} iteration(s); weight ${w.toFixed(4)}, loss ${lossAt(w, target).toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { iteration: iterations, weight: w, loss: lossAt(w, target), converged: lossAt(w, target) < 0.01, accumulated },
    };
}

/** The AdaSGD module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "AdaSGD is the simplest useful marriage of two classic ideas. It keeps a momentum velocity so steps build up speed in a consistent direction, and it keeps a running sum of squared gradients so the effective learning rate decreases for parameters that move often. Dividing the velocity by the square root of that sum gives an adaptive, momentum-driven descent step.",
        invariants: [
            "The accumulated squared gradient is monotone nondecreasing and nonnegative.",
            "The velocity is a decaying sum of past gradients, so it points along the recent descent direction.",
            "The effective step always opposes the sign of the velocity.",
        ],
        correctness:
            "Since accumulated is positive after the first gradient, the step is well defined. On a convex quadratic the velocity shares the sign of the gradient toward the minimizer, so subtracting the scaled velocity reduces the distance to the target for a suitable learning rate. The independent reference reproduces the same weight sequence step for step, and the monotone accumulator is checked directly in the tests.",
        complexityRationale:
            "Each iteration performs a fixed handful of scalar operations, so time is O(iterations). Storing one loss point per iteration for the curve makes the space O(iterations).",
        uses: [
            "Sparse feature learning where rare parameters need larger steps",
            "A lightweight adaptive baseline before reaching for full Adam",
            "Teaching the combination of momentum and per-parameter scaling",
        ],
        references: [
            "Duchi et al., Adaptive Subgradient Methods, JMLR 2011",
            "Polyak, Some Methods of Speeding Up Convergence, 1964",
        ],
        workedExample:
            "From w = 0 toward target 3 the first gradient is -6, velocity becomes -6, accumulated becomes 36, and the step is 0.5 times -6 over 6, or -0.5, so w moves to 0.5. Repeating drives w toward 3 while the growing accumulator steadily tames the step size.",
    },
    id: "adasgd",
    name: "AdaSGD Optimizer",
    category: "ml-ai",
    complexity: { time: "O(iterations)", space: "O(iterations)" },
    defaultInput: { target: 3, start: 0, iterations: 30, learningRate: 0.5 },
    visualType: "point",
    run,
    pseudocode: [
        "initialize weight, velocity = 0, accumulated squared gradient = 0",
        "for each iteration compute the gradient of the loss",
        "update velocity as momentum times velocity plus gradient",
        "add the squared gradient to the accumulator",
        "divide learning rate times velocity by square root of the accumulator",
        "subtract that adaptive step from the weight",
        "record the new loss on the curve",
        "done: report the final weight and loss",
    ],
};

export default module;
