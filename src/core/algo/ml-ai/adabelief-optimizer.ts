/**
 * adabelief-optimizer.ts - AdaBelief: Adapting Step Size by Belief
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AdaBelief (Zhuang et al., 2020) changes Adam's second moment. Instead of the
 * raw squared gradient it averages the squared deviation between the gradient
 * and the running mean, which the authors call the belief. When observations
 * agree with the belief the step grows; when they disagree it shrinks, which
 * improves generalization and stabilizes training.
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
 *   - Meta exposes the positive belief variance for verification.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AdaBeliefInput {
    parameters?: number[];
    gradients?: number[][];
    learningRate?: number;
    beta1?: number;
    beta2?: number;
    epsilon?: number;
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
    const task = (input as AdaBeliefInput | null) ?? {};
    const theta = [...(task.parameters ?? [1, -1, 0.5, -0.5])];
    const gradients = task.gradients ?? [
        [0.8, -0.7, 0.2, -0.2],
        [0.7, -0.6, 0.2, -0.2],
        [0.1, -0.1, 0.02, -0.02],
        [0.75, -0.65, 0.2, -0.2],
    ];
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.1;
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.9;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.999;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;

    const m = theta.map(() => 0);
    const s = theta.map(() => 0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(theta, "idle"),
        edges: [],
        description: `Initializing AdaBelief with ${theta.length} parameters and belief-based scaling.`,
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
        for (let i = 0; i < theta.length; i += 1) {
            const g = gradient[i] ?? 0;
            m[i] = beta1 * (m[i] ?? 0) + (1 - beta1) * g;
            s[i] = beta2 * (s[i] ?? 0) + (1 - beta2) * (g - (m[i] ?? 0)) * (g - (m[i] ?? 0));
            const mHat = (m[i] ?? 0) / (1 - Math.pow(beta1, timeStep));
            const sHat = (s[i] ?? 0) / (1 - Math.pow(beta2, timeStep));
            theta[i] = (theta[i] ?? 0) - (lr * mHat) / (Math.sqrt(sHat) + epsilon);
        }
        yield {
            stepNumber: step,
            entities: makeBars(theta, "active"),
            edges: [],
            description: `Step ${timeStep}: the belief variance measured the deviation of g from the running mean.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { step: timeStep, loss: lossAt(theta), belief: s.slice() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, "sorted"),
        edges: [],
        description: `Finished ${gradients.length} AdaBelief steps; final loss ${lossAt(theta).toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { step: gradients.length, loss: lossAt(theta), parameters: theta.slice() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "AdaBelief replaces 'how big was the gradient' with 'how surprised was I by the gradient'. It tracks the running mean of gradients and measures how far each new gradient deviates from that mean; consistent gradients produce a large step and erratic ones produce a small step.",
        invariants: [
            "The first moment m is the running mean of the gradients.",
            "The second moment s averages the squared deviation g minus m.",
            "Both moments are bias-corrected before forming the step.",
        ],
        correctness:
            "The generator implements the published AdaBelief update with the deviation taken against the newly updated mean. The test independently reproduces the recurrence and verifies that the belief variance is never negative and that all final coordinates agree.",
        complexityRationale:
            "Each step costs a constant number of operations per coordinate, so O(steps * d) time; two d-length moment arrays give O(d) space.",
        uses: [
            "Image classification with better generalization than Adam",
            "Training generative adversarial networks stably",
            "Fine-tuning transformers where erratic gradients appear",
        ],
        references: [
            "Zhuang et al., AdaBelief Optimizer, NeurIPS 2020",
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
        ],
        workedExample:
            "With gradients 0.8 then 0.7, the second gradient is close to the running mean near 0.7, so the deviation is tiny and the belief variance is small: AdaBelief takes a large step. A later gradient of 0.1 is surprising and produces a much larger variance and smaller step.",
    },
    id: "adabelief",
    name: "AdaBelief Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: {
        parameters: [1, -1, 0.5, -0.5],
        gradients: [
            [0.8, -0.7, 0.2, -0.2],
            [0.7, -0.6, 0.2, -0.2],
            [0.1, -0.1, 0.02, -0.02],
            [0.75, -0.65, 0.2, -0.2],
        ],
        learningRate: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize first moment m and belief moment s to zero",
        "for each step t with gradient g do",
        "m = beta1 * m + (1 - beta1) * g",
        "s = beta2 * s + (1 - beta2) * (g - m)^2",
        "mHat = m / (1 - beta1^t); sHat = s / (1 - beta2^t)",
        "theta = theta - lr * mHat / (sqrt(sHat) + eps)",
        "record the parameter vector and belief variance",
        "done: report the final parameters",
    ],
};

export default module;
