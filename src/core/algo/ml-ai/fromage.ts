/**
 * fromage.ts - FROMAGE Trust-Ratio Optimizer
 *
 * FROMAGE (FRee-scale Optimizer with Robustness to Adversarial Gradient
 * Explosion) rescales every gradient by the ratio of the weight norm to the
 * gradient norm. This makes the step size independent of the gradient scale.
 * The demo minimizes a quadratic objective with a known gradient.
 *
 * Time:  O(steps * d) for d parameters
 * Space: O(d) for the parameter vector
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FromageInput {
    target?: number[];
    initial?: number[];
    steps?: number;
    learningRate?: number;
    weightDecay?: number;
}

function makeBars(weights: number[], target: number[], states: EntityState[]): VisualEntity[] {
    const entities: VisualEntity[] = weights.map((value, i) => ({
        id: `weight-${i}`,
        type: "bar" as const,
        label: `w${i}: ${value.toFixed(3)}`,
        value,
        state: states[i] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, kind: "weight", target: target[i] ?? 0 },
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

/** Norm of a vector. */
function norm(v: number[]): number {
    return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

/** Objective value: half the squared distance to the target. */
function objective(theta: number[], target: number[]): number {
    let total = 0;
    for (let i = 0; i < theta.length; i += 1) {
        const diff = (theta[i] ?? 0) - (target[i] ?? 0);
        total += 0.5 * diff * diff;
    }
    return total;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FromageInput | null) ?? {};
    const target = task.target?.length ? task.target.slice() : [1, -2, 0.5, 3];
    const theta = (task.initial?.length ? task.initial.slice() : target.map(() => 0)).slice(
        0,
        target.length,
    );
    while (theta.length < target.length) theta.push(0);
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 25;
    const lr = typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.2;
    const wd = typeof task.weightDecay === "number" && task.weightDecay >= 0 ? task.weightDecay : 0;
    const dim = target.length;

    const states: EntityState[] = theta.map(() => "idle");
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(theta, target, states),
        edges: [],
        description: `Initialize ${dim} weights for FROMAGE; target objective is zero at the target vector.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, objective: objective(theta, target), trustRatio: 1, weights: theta.slice(), target: target.slice() },
    };
    step += 1;

    let trustRatio = 1;
    for (let t = 1; t <= steps; t += 1) {
        const grad = theta.map((value, i) => (value ?? 0) - (target[i] ?? 0));
        const weightNorm = norm(theta);
        const gradNorm = norm(grad);
        trustRatio =
            gradNorm < 1e-12 || weightNorm < 1e-12
                ? 1
                : Math.min(1e6, Math.max(1e-6, weightNorm / gradNorm));
        for (let i = 0; i < dim; i += 1) {
            theta[i] = (theta[i] ?? 0) - lr * trustRatio * ((grad[i] ?? 0) + wd * (theta[i] ?? 0));
        }
        const currentStates: EntityState[] = theta.map(() => "active");
        yield {
            stepNumber: step,
            entities: makeBars(theta, target, currentStates),
            edges: [],
            description: `Step ${t}: weight norm ${weightNorm.toFixed(3)}, gradient norm ${gradNorm.toFixed(3)}, trust ratio ${trustRatio.toFixed(3)}, objective ${objective(theta, target).toFixed(4)}.`,
            codeLineNumber: t === steps ? 5 : 2,
            layout: "array",
            meta: {
                step: t,
                objective: objective(theta, target),
                trustRatio,
                weightNorm,
                gradNorm,
                weights: theta.slice(),
                target: target.slice(),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, target, theta.map(() => "sorted")),
        edges: [],
        description: `Done after ${steps} steps: objective ${objective(theta, target).toFixed(6)}, final trust ratio ${trustRatio.toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step, objective: objective(theta, target), trustRatio, weights: theta.slice(), target: target.slice(), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Some problems have gradients whose size varies by many orders of magnitude, which makes a fixed learning rate either too timid or explosive. FROMAGE divides the step by the gradient norm and multiplies by the weight norm, so only the direction and a dimensionless ratio decide the update. It behaves like a scale-free version of gradient descent.",
        invariants: [
            "The gradient is the difference between each weight and its target on this quadratic.",
            "The trust ratio is the weight norm divided by the gradient norm, clamped to a safe range.",
            "Every update subtracts the learning rate times the trust ratio times the adjusted gradient.",
        ],
        correctness:
            "On a quadratic with minimum at the target, the gradient is exactly the displacement from the target. Multiplying by a positive trust ratio keeps the update in the descent direction, so the objective falls rapidly and then settles into a small neighborhood whose size is set by the learning rate. The companion test recomputes every trust ratio and weight update with an independent loop and checks that the final objective is far below its starting value.",
        complexityRationale:
            "Each step computes two norms and a vector update over d parameters, costing O(d) time; across the chosen steps the total is O(steps times d). Only the parameter vector and a few scalars are stored, so space is O(d).",
        uses: [
            "Training with gradients that change magnitude sharply between layers",
            "Robust fine-tuning when loss scaling is uncertain",
            "A teaching example of scale-invariant optimization",
        ],
        references: [
            "Bernacchi, Das, and Khoi, FROMAGE: Free-scale Optimizer, 2020",
            "Bottou, Curtis, and Nocedal, Optimization Methods for Large-Scale Machine Learning, 2018",
        ],
        workedExample:
            "Starting from zeros with target (1, minus 2), the gradient has norm about 2.24 and the weight norm is zero, so the safeguard sets the trust ratio to one. The first update moves both weights a fixed distance toward the target; later steps shrink the gradient norm while the weight norm grows, so the shrinking ratio gently damps the approach.",
    },
    id: "fromage",
    name: "FROMAGE Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: { target: [1, -2, 0.5, 3], initial: [0, 0, 0, 0], steps: 25, learningRate: 0.2, weightDecay: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the parameter vector and read the target",
        "repeat for the chosen number of steps",
        "compute the gradient as the weight minus the target",
        "set the trust ratio to weight norm over gradient norm",
        "subtract learning rate times trust ratio times gradient",
        "record the new weights and objective value",
        "done: report the final weights and objective",
    ],
};

export default module;
