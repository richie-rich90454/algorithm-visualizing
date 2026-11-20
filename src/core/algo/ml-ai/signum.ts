/**
 * signum.ts - Signum Optimizer
 *
 * Signum applies momentum to the gradients and then uses only the sign of that
 * momentum to update each parameter. Ignoring magnitude makes the optimizer
 * robust to gradient scaling and is the foundation of several communication
 * compression schemes. The demo minimizes a quadratic with a known gradient.
 *
 * Time:  O(steps * d) for d parameters
 * Space: O(d) for weights and momentum
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SignumInput {
    target?: number[];
    initial?: number[];
    steps?: number;
    learningRate?: number;
    momentum?: number;
}

function sign(value: number): number {
    return value > 0 ? 1 : value < 0 ? -1 : 0;
}

function makeBars(weights: number[], momentum: number[], target: number[], active: boolean): VisualEntity[] {
    const entities: VisualEntity[] = weights.map((value, i) => ({
        id: `weight-${i}`,
        type: "bar" as const,
        label: `w${i}: ${value.toFixed(3)}`,
        value,
        state: (active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, kind: "weight", momentum: momentum[i] ?? 0 },
    }));
    target.forEach((value, i) => {
        entities.push({
            id: `target-${i}`,
            type: "bar",
            label: `target ${value.toFixed(2)}`,
            value,
            state: "highlight",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "target" },
        });
    });
    return entities;
}

function objective(theta: number[], target: number[]): number {
    let total = 0;
    for (let i = 0; i < theta.length; i += 1) {
        const diff = (theta[i] ?? 0) - (target[i] ?? 0);
        total += 0.5 * diff * diff;
    }
    return total;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SignumInput | null) ?? {};
    const target = task.target?.length ? task.target.slice() : [1, -2, 0.5, 3];
    const theta = (task.initial?.length ? task.initial.slice() : target.map(() => 0)).slice(0, target.length);
    while (theta.length < target.length) theta.push(0);
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 25;
    const lr = typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.1;
    const mu = typeof task.momentum === "number" && task.momentum >= 0 && task.momentum < 1 ? task.momentum : 0.9;
    const dim = target.length;
    const m = theta.map(() => 0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(theta, m, target, false),
        edges: [],
        description: `Initialize ${dim} weights and zero momentum for Signum with rate ${lr} and momentum ${mu}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, objective: objective(theta, target), weights: theta.slice(), momentum: m.slice() },
    };
    step += 1;

    for (let t = 1; t <= steps; t += 1) {
        for (let i = 0; i < dim; i += 1) {
            const grad = (theta[i] ?? 0) - (target[i] ?? 0);
            m[i] = mu * (m[i] ?? 0) + grad;
            theta[i] = (theta[i] ?? 0) - lr * sign(m[i] ?? 0);
        }
        const signs = m.map((value) => sign(value));
        yield {
            stepNumber: step,
            entities: makeBars(theta, m, target, true),
            edges: [],
            description: `Step ${t}: momentum (${m.map((v) => v.toFixed(2)).join(", ")}), sign update (${signs.join(", ")}), objective ${objective(theta, target).toFixed(4)}.`,
            codeLineNumber: t === steps ? 5 : 2,
            layout: "array",
            meta: {
                step: t,
                objective: objective(theta, target),
                weights: theta.slice(),
                momentum: m.slice(),
                signs,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, m, target, false),
        edges: [],
        description: `Done after ${steps} steps: objective ${objective(theta, target).toFixed(6)} using sign-only updates.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step, objective: objective(theta, target), weights: theta.slice(), momentum: m.slice(), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Signum keeps a running momentum of past gradients but throws away their magnitude when stepping, moving each parameter a fixed distance in the direction the momentum points. This is like navigating by compass rather than by mileage. Because only a sign is transmitted, it is friendly to distributed training with heavily compressed messages.",
        invariants: [
            "Momentum is an exponential moving average of the gradients.",
            "Each parameter moves by exactly plus or minus the learning rate per step.",
            "The sign function returns zero only when momentum is exactly zero.",
        ],
        correctness:
            "Momentum accumulates a consistent descent direction on a convex quadratic, so the sign of the momentum agrees with the sign of the gradient except during brief reversals. Taking a fixed-size step in that direction decreases the objective until the iterate lands within roughly one learning rate of the optimum. The test mirrors every momentum and sign update in an independent loop and checks the final objective. The learning rate controls the size of the residual error.",
        complexityRationale:
            "Each step evaluates one gradient, one multiply-add and one sign per coordinate, so time is O(steps times d). Two vectors of length d hold the weights and momentum, giving O(d) space.",
        uses: [
            "Distributed training with one-bit gradient compression",
            "Settings with highly variable gradient magnitudes",
            "A baseline for studying sign-based methods",
        ],
        references: [
            "Bernstein et al., signSGD with Majority Vote, ICML, 2018",
            "Karimi et al., Signum: Hidden Battle of the Optimizers, 2021",
        ],
        workedExample:
            "With target (1, minus 2) and zero momentum, the first gradients are minus 1 and plus 2, so momentum takes those values and the weights step to negative 0.1 and plus 0.1. Momentum keeps its sign for several steps, so each coordinate marches toward the target one learning rate at a time until it overshoots and the sign flips.",
    },
    id: "signum",
    name: "Signum Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: { target: [1, -2, 0.5, 3], initial: [0, 0, 0, 0], steps: 25, learningRate: 0.1, momentum: 0.9 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize weights and momentum to zero",
        "repeat for the chosen number of steps",
        "compute the gradient at the current weights",
        "update momentum as decay times old plus gradient",
        "move each weight by learning rate times sign of momentum",
        "record the objective after the update",
        "done: report the final weights and objective",
    ],
};

export default module;
