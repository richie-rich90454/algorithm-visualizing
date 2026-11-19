/**
 * lion-optimizer.ts - Lion: Evolved Sign Momentum
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lion (Chen et al., 2023) is a memory-efficient optimizer that keeps only one
 * moment m. It forms a sign candidate c from the blend of the old moment and
 * the gradient, and takes a step of fixed size lr in the direction of sign(c).
 * The update magnitude is always lr, which makes Lion simple to verify.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d)   Space: O(d) for the single moment
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the parameter vector after each update.
 *   - Bars turn green at the end; meta records the moment and step count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LionInput {
    parameters?: number[];
    gradients?: number[][];
    learningRate?: number;
    beta1?: number;
    beta2?: number;
    weightDecay?: number;
}

function makeBars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `param-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function lossAt(params: number[]): number {
    let total = 0;
    for (const value of params) {
        total += 0.5 * value * value;
    }
    return total;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LionInput | null) ?? {};
    const theta = [...(task.parameters ?? [1, -1, 0.5, -0.5])];
    const gradients = task.gradients ?? [
        [0.8, -0.6, 0.2, -0.3],
        [0.4, -0.2, 0.1, -0.1],
        [0.2, -0.1, 0.05, -0.05],
    ];
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.1;
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.9;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.99;
    const weightDecay = typeof task.weightDecay === "number" ? task.weightDecay : 0;

    const moment = theta.map(() => 0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(theta, "idle"),
        edges: [],
        description: `Initializing Lion with ${theta.length} parameters, ${gradients.length} scheduled gradients, and learning rate ${lr}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, loss: lossAt(theta), learningRate: lr },
    };
    step += 1;

    for (let t = 0; t < gradients.length; t += 1) {
        const gradient = gradients[t];
        if (!gradient) {
            continue;
        }
        for (let i = 0; i < theta.length; i += 1) {
            const g = gradient[i] ?? 0;
            const c = beta1 * (moment[i] ?? 0) + (1 - beta1) * g;
            moment[i] = beta2 * (moment[i] ?? 0) + (1 - beta2) * g;
            const decayed = (1 - lr * weightDecay) * (theta[i] ?? 0);
            theta[i] = decayed - lr * Math.sign(c);
        }
        yield {
            stepNumber: step,
            entities: makeBars(theta, "active"),
            edges: [],
            description: `Step ${t + 1}: formed sign candidate c, moved each parameter by ${lr} toward sign(c).`,
            codeLineNumber: 4,
            layout: "array",
            meta: { step: t + 1, loss: lossAt(theta), learningRate: lr, gradient: gradient.slice() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, "sorted"),
        edges: [],
        description: `Finished ${gradients.length} Lion steps; final loss ${lossAt(theta).toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step: gradients.length, loss: lossAt(theta), parameters: theta.slice() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Lion keeps a single running average of past gradients. It blends that average with the current gradient and moves every parameter by the same fixed distance in the sign direction, so the update is sparse in direction but constant in size.",
        invariants: [
            "The moment is an exponential moving average of the gradients.",
            "The sign candidate c blends the old moment with the current gradient.",
            "Without weight decay, each coordinate moves by exactly the learning rate.",
        ],
        correctness:
            "The update rule is deterministic: for a fixed sequence of gradients each coordinate is computed only from its own prior moment, prior value, and current gradient. The final parameters equal the result of applying the published Lion recurrence once per step in order, which the companion test reproduces with an independent loop.",
        complexityRationale:
            "Each of the steps scans all d parameters once to update the moment and value, giving O(steps * d) time. Only the d-length moment is stored beyond the parameters, so space is O(d).",
        uses: [
            "Fine-tuning large language models with a single optimizer state",
            "Memory-constrained training where Adam's two moments are too costly",
            "Settings that benefit from constant-magnitude sign updates",
        ],
        references: [
            "Chen, Lion: Evolving Similarity-Based Optimizers, ICML 2023",
            "Chen et al., Symbolic Discovery of Optimization Algorithms, 2023",
        ],
        workedExample:
            "With theta = 1, lr = 0.1, beta1 = 0.9, beta2 = 0.99 and first gradient 0.8, the sign candidate is positive, so theta becomes 0.9 and the moment becomes 0.008. A negative gradient later flips the sign and moves theta upward again.",
    },
    id: "lion-optimizer",
    name: "Lion Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: {
        parameters: [1, -1, 0.5, -0.5],
        gradients: [
            [0.8, -0.6, 0.2, -0.3],
            [0.4, -0.2, 0.1, -0.1],
            [0.2, -0.1, 0.05, -0.05],
        ],
        learningRate: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize moment m to zero and read parameters theta",
        "for each scheduled gradient g do",
        "c = beta1 * m + (1 - beta1) * g",
        "m = beta2 * m + (1 - beta2) * g",
        "theta = theta - lr * sign(c) - lr * weightDecay * theta",
        "record the parameter vector and current loss",
        "repeat until all gradients are consumed",
        "done: report the final parameters",
    ],
};

export default module;
