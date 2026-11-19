/**
 * sophia-optimizer.ts - Sophia Optimizer
 *
 * Sophia is a second-order optimizer that uses only a diagonal estimate of the
 * Hessian. It keeps a momentum of gradients, divides that momentum by the
 * diagonal curvature to form a preconditioned step, and clips each coordinate
 * to stay within a bounded trust region. This gives adaptive per-parameter
 * steps at roughly first-order cost. The demo uses a separable quadratic whose
 * diagonal Hessian is known exactly.
 *
 * Time:  O(steps * d) for d parameters
 * Space: O(d) for weights, momentum and curvature
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SophiaInput {
    target?: number[];
    curvature?: number[];
    initial?: number[];
    steps?: number;
    learningRate?: number;
    beta1?: number;
}

function makeBars(theta: number[], target: number[]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < theta.length; i += 1) {
        entities.push({
            id: `weight-${i}`,
            type: "bar" as const,
            label: `w${i}: ${(theta[i] ?? 0).toFixed(3)}`,
            value: theta[i] ?? 0,
            state: "active",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "weight" },
        });
        entities.push({
            id: `target-${i}`,
            type: "bar" as const,
            label: `target ${(target[i] ?? 0).toFixed(2)}`,
            value: target[i] ?? 0,
            state: "highlight" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "target" },
        });
    }
    return entities;
}

function objective(theta: number[], target: number[], curvature: number[]): number {
    let total = 0;
    for (let i = 0; i < theta.length; i += 1) {
        const diff = (theta[i] ?? 0) - (target[i] ?? 0);
        total += 0.5 * (curvature[i] ?? 1) * diff * diff;
    }
    return total;
}

function clip(value: number): number {
    return Math.min(1, Math.max(-1, value));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SophiaInput | null) ?? {};
    const target = task.target?.length ? task.target.slice() : [1, -2, 0.5, 3];
    const curvature = task.curvature?.length ? task.curvature.slice() : [2, 5, 1, 3];
    const dim = target.length;
    const hessian = curvature.slice(0, dim);
    while (hessian.length < dim) hessian.push(1);
    const theta = (task.initial?.length ? task.initial.slice() : target.map(() => 0)).slice(0, dim);
    while (theta.length < dim) theta.push(0);
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 25;
    const lr = typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.2;
    const beta1 = typeof task.beta1 === "number" && task.beta1 >= 0 && task.beta1 < 1 ? task.beta1 : 0.9;
    const momentum = theta.map(() => 0);
    const epsilon = 1e-8;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(theta, target),
        edges: [],
        description: `Initialize ${dim} weights; diagonal curvature is (${hessian.join(", ")}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, objective: objective(theta, target, hessian), hessian: hessian.slice(), momentum: momentum.slice(), update: theta.map(() => 0) },
    };
    step += 1;

    for (let t = 1; t <= steps; t += 1) {
        const update: number[] = [];
        const biasCorrection = 1 - Math.pow(beta1, t);
        for (let i = 0; i < dim; i += 1) {
            const grad = (hessian[i] ?? 1) * ((theta[i] ?? 0) - (target[i] ?? 0));
            momentum[i] = beta1 * (momentum[i] ?? 0) + (1 - beta1) * grad;
            const preconditioned = (momentum[i] ?? 0) / biasCorrection / ((hessian[i] ?? 1) + epsilon);
            const stepValue = clip(preconditioned);
            update.push(stepValue);
            theta[i] = (theta[i] ?? 0) - lr * stepValue;
        }
        yield {
            stepNumber: step,
            entities: makeBars(theta, target),
            edges: [],
            description: `Step ${t}: preconditioned update (${update.map((v) => v.toFixed(2)).join(", ")}), objective ${objective(theta, target, hessian).toFixed(4)}.`,
            codeLineNumber: t === steps ? 5 : 2,
            layout: "array",
            meta: {
                step: t,
                objective: objective(theta, target, hessian),
                hessian: hessian.slice(),
                momentum: momentum.slice(),
                update,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, target),
        edges: [],
        description: `Done after ${steps} steps: objective ${objective(theta, target, hessian).toFixed(6)} with clipped second-order steps.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step, objective: objective(theta, target, hessian), hessian: hessian.slice(), momentum: momentum.slice(), weights: theta.slice(), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "First-order optimizers treat every parameter as having the same curvature. Sophia estimates the diagonal of the Hessian, so a sharp coordinate takes a small step and a flat one takes a large step. It then clips the preconditioned step so a poor curvature estimate cannot cause a huge jump.",
        invariants: [
            "The gradient of the demo quadratic is curvature times displacement from the target.",
            "Momentum is a bias-corrected exponential average of those gradients.",
            "Every preconditioned update is clipped into the interval from minus one to one.",
        ],
        correctness:
            "Bias correction removes the initial lag of the momentum average, so dividing by the true diagonal Hessian of a separable quadratic gives the displacement from the optimum. Clipping preserves the descent direction while bounding step size, so the iterate converges to the target. The test reimplements each update independently, checks the clipping bound, and verifies the final objective is near zero.",
        complexityRationale:
            "Each step computes one gradient, one division and one clip per coordinate, so time is O(steps times d). Three vectors of length d hold weights, momentum and curvature, giving O(d) space.",
        uses: [
            "Large language model pretraining with adaptive curvature",
            "Settings where a diagonal Hessian approximation is affordable",
            "A stable alternative to Adam with bounded steps",
        ],
        references: [
            "Liu et al., Sophia: A Scalable Stochastic Second-order Optimizer, ICML, 2023",
            "Bottou, Curtis, and Nocedal, Optimization Methods for Large-Scale Machine Learning, 2018",
        ],
        workedExample:
            "With curvature two on a coordinate whose weight is zero and target is one, the first gradient is minus two. The bias-corrected momentum equals that gradient, and dividing by two gives minus one, which sits at the clip boundary. The weight therefore moves up by one full learning rate, and later steps shrink the gap until it reaches the target.",
    },
    id: "sophia-optimizer",
    name: "Sophia Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: { target: [1, -2, 0.5, 3], curvature: [2, 5, 1, 3], initial: [0, 0, 0, 0], steps: 100, learningRate: 0.2, beta1: 0.9 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize weights and momentum, read the diagonal curvature",
        "repeat for the chosen number of steps",
        "compute gradient as curvature times displacement from target",
        "update momentum as beta times old plus one minus beta times gradient",
        "divide bias-corrected momentum by curvature and clip to the range",
        "subtract learning rate times the clipped update",
        "done: report the final weights and objective",
    ],
};

export default module;
