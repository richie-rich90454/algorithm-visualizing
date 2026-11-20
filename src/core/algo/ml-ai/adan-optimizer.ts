/**
 * adan-optimizer.ts - Adan: Adaptive Nesterov Momentum
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adan (Xie et al., 2022) adds a Nesterov-style lookahead to adaptive moment
 * estimation. Alongside the smoothed gradient m and squared gradient v it
 * keeps a moment n of the change between successive gradients; the extra term
 * anticipates where the gradient is heading and often converges faster than
 * Adam.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d)   Space: O(d) for three moments
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the parameter vector after each step.
 *   - Meta records the lookahead term and loss.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AdanInput {
    parameters?: number[];
    gradients?: number[][];
    learningRate?: number;
    beta1?: number;
    beta2?: number;
    beta3?: number;
    epsilon?: number;
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
    const task = (input as AdanInput | null) ?? {};
    const theta = [...(task.parameters ?? [1, -1, 0.5, -0.5])];
    const gradients = task.gradients ?? [
        [0.9, -0.7, 0.3, -0.2],
        [0.5, -0.3, 0.1, -0.1],
        [0.1, -0.05, 0.02, -0.02],
    ];
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.1;
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.98;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.999;
    const beta3 = typeof task.beta3 === "number" ? task.beta3 : 0.99;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;
    const weightDecay = typeof task.weightDecay === "number" ? task.weightDecay : 0;

    const m = theta.map(() => 0);
    const v = theta.map(() => 0);
    const n = theta.map(() => 0);
    let previous = theta.map(() => 0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(theta, "idle"),
        edges: [],
        description: `Initializing Adan with ${theta.length} parameters and Nesterov lookahead weight ${beta3}.`,
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
        let lookaheadTotal = 0;
        for (let i = 0; i < theta.length; i += 1) {
            const g = gradient[i] ?? 0;
            const diff = g - (previous[i] ?? 0);
            m[i] = beta1 * (m[i] ?? 0) + (1 - beta1) * g;
            v[i] = beta2 * (v[i] ?? 0) + (1 - beta2) * g * g;
            n[i] = beta3 * (n[i] ?? 0) + (1 - beta3) * diff * diff;
            const lookahead = (m[i] ?? 0) + beta3 * diff;
            lookaheadTotal += Math.abs(lookahead);
            const scaled = (1 - lr * weightDecay) * (theta[i] ?? 0);
            theta[i] = scaled - (lr * lookahead) / (Math.sqrt(v[i] ?? 0) + epsilon);
            previous[i] = g;
        }
        yield {
            stepNumber: step,
            entities: makeBars(theta, "active"),
            edges: [],
            description: `Step ${t + 1}: applied adaptive Nesterov update using the gradient-difference lookahead.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { step: t + 1, loss: lossAt(theta), lookahead: lookaheadTotal },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, "sorted"),
        edges: [],
        description: `Finished ${gradients.length} Adan steps; final loss ${lossAt(theta).toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { step: gradients.length, loss: lossAt(theta), parameters: theta.slice() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Adan asks not only where the gradient is, but where it is going. It adds a fraction of the change since the last gradient to the smoothed gradient, then divides by an adaptive denominator, which acts like momentum with a built-in lookahead.",
        invariants: [
            "The gradient difference is the current gradient minus the previous one.",
            "The third moment n is an exponential average of squared gradient differences.",
            "The lookahead equals the smoothed gradient plus beta3 times the difference.",
        ],
        correctness:
            "Every coordinate of the parameter vector is a pure function of prior state and the current gradient, so replaying the published recurrence in the scheduled order yields the same result. The test recomputes the recurrence independently and also checks that a constant gradient makes the lookahead term vanish after the first step.",
        complexityRationale:
            "Each step does a constant amount of arithmetic for each of the d coordinates, so time is O(steps * d). Three d-length moment arrays give O(d) space.",
        uses: [
            "Fast convergence in image classification and language-model pretraining",
            "Training with large batches where Nesterov lookahead helps",
            "Drop-in replacement for Adam in transformer training",
        ],
        references: [
            "Xie et al., Adan: Adaptive Nesterov Momentum Algorithm, ICML 2022",
            "Nesterov, A Method of Solving a Convex Programming Problem, 1983",
        ],
        workedExample:
            "Starting from theta = 1 with gradients 0.9 then 0.5, the first difference is 0.9 and adds a strong lookahead term. On the next step the difference is -0.4, which pulls the update back, illustrating the anticipatory behavior.",
    },
    id: "adan-optimizer",
    name: "Adan Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: {
        parameters: [1, -1, 0.5, -0.5],
        gradients: [
            [0.9, -0.7, 0.3, -0.2],
            [0.5, -0.3, 0.1, -0.1],
            [0.1, -0.05, 0.02, -0.02],
        ],
        learningRate: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize gradient moments m, v, n to zero and previous gradient to zero",
        "for each scheduled gradient g do",
        "diff = g - previous; previous = g",
        "m = beta1 * m + (1 - beta1) * g; v = beta2 * v + (1 - beta2) * g^2",
        "n = beta3 * n + (1 - beta3) * diff^2",
        "theta = theta - lr * (m + beta3 * diff) / (sqrt(v) + eps)",
        "record the parameter vector and current loss",
        "done: report the final parameters",
    ],
};

export default module;
