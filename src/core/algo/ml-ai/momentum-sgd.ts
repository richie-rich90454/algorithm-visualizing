/**
 * momentum-sgd.ts - Gradient Descent with Momentum
 *
 * A teaching model of momentum-based gradient descent on the quadratic loss
 * f(w) = (w - target)^2. The velocity accumulates gradients and the weight
 * moves against it. The loss curve is plotted one point per step.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Step {
    w: number;
    velocity: number;
    loss: number;
}

function loss(w: number, target: number): number {
    return (w - target) * (w - target);
}

function makeCurve(steps: Step[], count: number): VisualEntity[] {
    return steps.slice(0, count).map((step, index) => ({
        id: `loss-${index}`,
        type: "node" as const,
        label: step.loss.toFixed(2),
        value: step.loss,
        state: index === count - 1 ? ("active" as const) : ("sorted" as const),
        x: index,
        y: step.loss,
        width: 0,
        height: 0,
        metadata: { index, w: step.w },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        target?: number;
        start?: number;
        lr?: number;
        momentum?: number;
        steps?: number;
    } | null) ?? {};
    const target = typeof task.target === "number" ? task.target : 1;
    const lr = typeof task.lr === "number" && task.lr > 0 ? task.lr : 0.05;
    const momentum = typeof task.momentum === "number" ? task.momentum : 0.9;
    const steps = Math.max(1, Math.floor(typeof task.steps === "number" ? task.steps : 24));
    const start = typeof task.start === "number" ? task.start : 4;

    const trace: Step[] = [{ w: start, velocity: 0, loss: loss(start, target) }];
    let w = start;
    let velocity = 0;
    for (let t = 0; t < steps; t += 1) {
        const gradient = 2 * (w - target);
        velocity = momentum * velocity + gradient;
        w = w - lr * velocity;
        trace.push({ w, velocity, loss: loss(w, target) });
    }

    for (let count = 1; count <= trace.length; count += 1) {
        const current = trace[count - 1];
        const done = count === trace.length;
        yield {
            stepNumber: count - 1,
            entities: makeCurve(trace, count),
            edges: [],
            description: done
                ? `After ${steps} step(s), w = ${w.toFixed(4)} and loss = ${current?.loss.toFixed(4)}.`
                : `Step ${count - 1}: gradient descent with momentum moved w to ${current?.w.toFixed(4)} (loss ${current?.loss.toFixed(4)}).`,
            codeLineNumber: done ? 5 : count === 1 ? 0 : 4,
            layout: "point",
            meta: {
                step: count - 1,
                w: Number(w.toFixed(6)),
                velocity: Number((current?.velocity ?? 0).toFixed(6)),
                loss: Number((current?.loss ?? 0).toFixed(6)),
                target,
                lr,
                momentum,
            },
        };
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain gradient descent can crawl or oscillate on steep, narrow valleys. Momentum keeps a running average of past gradients as a velocity, so consistent pushes build up speed while noisy ones cancel. The weight then moves against this smoothed velocity.",
        invariants: [
            "The loss is the squared distance from the weight to the target.",
            "Velocity is the discounted sum of all gradients seen so far.",
            "Each step subtracts the learning rate times the current velocity from the weight.",
        ],
        correctness:
            "For the quadratic loss the gradient is exactly 2(w - target), so the recurrence w <- w - lr * (momentum * v + gradient) is deterministic and decreases the loss toward its unique minimum at w = target whenever the effective step size lr / (1 - momentum) is small enough. The final frame reports the weight and loss produced by that recurrence.",
        complexityRationale:
            "Each of the T steps evaluates one gradient and updates two scalars, so the time is O(T) and the stored trace uses O(T) space for plotting.",
        uses: [
            "Training deep neural networks with stochastic gradient descent",
            "Smoothing noisy gradients in mini-batch learning",
            "Accelerating convergence along shallow directions of a loss surface",
        ],
        references: [
            "Polyak, Some Methods of Speeding Up the Convergence of Iteration Methods, 1964",
            "Sutskever et al., On the Importance of Initialization and Momentum in Deep Learning, 2013",
        ],
        workedExample:
            "With target 1, start 4, learning rate 0.05, and momentum 0.9, the first gradient is 6, velocity becomes 6, and w drops to 3.7. Repeated steps keep pushing w down until it settles near 1 with loss close to zero.",
    },
    id: "momentum-sgd",
    name: "Momentum SGD",
    category: "ml-ai",
    complexity: { time: "O(T)", space: "O(T)" },
    defaultInput: { target: 1, start: 4, lr: 0.05, momentum: 0.9, steps: 24 },
    visualType: "point",
    run,
    pseudocode: [
        "initialize weight w and velocity v to the start value and zero",
        "for each training step",
        "compute the gradient of the loss at w",
        "update velocity to momentum times v plus the gradient",
        "move w by subtracting the learning rate times the velocity",
        "report the final weight and loss",
    ],
};

export default module;
