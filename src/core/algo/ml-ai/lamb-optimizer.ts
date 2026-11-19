/**
 * lamb-optimizer.ts - Lamb: Layerwise Adaptive Moments for Batches
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lamb (You et al., 2019) adapts Adam with a layerwise trust ratio. It divides
 * the norm of the parameters by the norm of the Adam-normalized gradient, so
 * each layer takes a step whose size is relative to its own weight scale. A
 * clip keeps the ratio in a safe range, which lets large batches train stably.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d)   Space: O(d) for two moments
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the parameter vector after each step.
 *   - Meta exposes the clipped trust ratio used for the update.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LambInput {
    parameters?: number[];
    gradients?: number[][];
    learningRate?: number;
    beta1?: number;
    beta2?: number;
    epsilon?: number;
    trustClip?: number;
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

function norm(values: number[]): number {
    let total = 0;
    for (const value of values) {
        total += value * value;
    }
    return Math.sqrt(total);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LambInput | null) ?? {};
    const theta = [...(task.parameters ?? [1, -1, 0.5, -0.5])];
    const gradients = task.gradients ?? [
        [0.6, -0.5, 0.2, -0.2],
        [0.3, -0.2, 0.1, -0.1],
        [0.1, -0.05, 0.02, -0.02],
    ];
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.1;
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.9;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.999;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;
    const trustClip = typeof task.trustClip === "number" ? task.trustClip : 10;

    const m = theta.map(() => 0);
    const v = theta.map(() => 0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(theta, "idle"),
        edges: [],
        description: `Initializing Lamb with ${theta.length} parameters and trust clip ${trustClip}.`,
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
        const timeStep = t + 1;
        const ratio: number[] = [];
        for (let i = 0; i < theta.length; i += 1) {
            const g = gradient[i] ?? 0;
            m[i] = beta1 * (m[i] ?? 0) + (1 - beta1) * g;
            v[i] = beta2 * (v[i] ?? 0) + (1 - beta2) * g * g;
            const mHat = (m[i] ?? 0) / (1 - Math.pow(beta1, timeStep));
            const vHat = (v[i] ?? 0) / (1 - Math.pow(beta2, timeStep));
            ratio.push(mHat / (Math.sqrt(vHat) + epsilon));
        }
        const trust = Math.min(trustClip, norm(theta) / (norm(ratio) + epsilon));
        for (let i = 0; i < theta.length; i += 1) {
            theta[i] = (theta[i] ?? 0) - lr * trust * (ratio[i] ?? 0);
        }
        yield {
            stepNumber: step,
            entities: makeBars(theta, "active"),
            edges: [],
            description: `Step ${timeStep}: applied an Adam ratio scaled by the clipped trust ${trust.toFixed(4)}.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { step: timeStep, loss: lossAt(theta), trust },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, "sorted"),
        edges: [],
        description: `Finished ${gradients.length} Lamb steps; final loss ${lossAt(theta).toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { step: gradients.length, loss: lossAt(theta), parameters: theta.slice() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Adam scales every layer by the same learning rate, which can be wrong when layers have very different weight magnitudes. Lamb computes a per-layer trust ratio: the norm of the weights divided by the norm of the Adam step direction, clipped to a safe interval.",
        invariants: [
            "The Adam ratio is the bias-corrected first moment over the corrected second-moment root.",
            "The trust ratio compares the weight norm with the ratio norm.",
            "The trust ratio is clipped above by trustClip and kept positive.",
        ],
        correctness:
            "The generator computes the two moments, forms the Adam ratio, and scales by the clipped trust ratio before updating. The test independently replays this recurrence and checks that the trust value stays within the clipping bound and that final parameters agree coordinate by coordinate.",
        complexityRationale:
            "Computing the moments and norms takes a constant amount of work per coordinate per step, so O(steps * d) time; two d-length moments and a d-length ratio give O(d) space.",
        uses: [
            "Large-batch training of BERT and other transformers",
            "Mixed-precision training where layer scales vary widely",
            "Distributed training with a stable effective step size",
        ],
        references: [
            "You et al., Large Batch Optimization for Deep Learning, ICLR 2020",
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
        ],
        workedExample:
            "If a layer's weights have norm 2 and its Adam ratio has norm 1, the trust ratio is 2, so the effective step is twice the learning rate. If the ratio norm were tiny, clipping at 10 prevents an explosively large update.",
    },
    id: "lamb-optimizer",
    name: "Lamb Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: {
        parameters: [1, -1, 0.5, -0.5],
        gradients: [
            [0.6, -0.5, 0.2, -0.2],
            [0.3, -0.2, 0.1, -0.1],
            [0.1, -0.05, 0.02, -0.02],
        ],
        learningRate: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize first moment m and second moment v to zero",
        "for each step t with gradient g do",
        "m = beta1*m + (1-beta1)*g; v = beta2*v + (1-beta2)*g^2",
        "ratio = (m / (1-beta1^t)) / (sqrt(v / (1-beta2^t)) + eps)",
        "trust = min(trustClip, norm(theta) / (norm(ratio) + eps))",
        "theta = theta - lr * trust * ratio",
        "record the parameter vector and the clipped trust ratio",
        "done: report the final parameters",
    ],
};

export default module;
