/**
 * nadam-optimizer.ts - Nadam: Nesterov-Accelerated Adam
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Nadam (Dozat, 2016) combines Adam's bias-corrected first and second moments
 * with Nesterov momentum. The update applies the momentum to the corrected
 * first moment and adds a fresh-gradient correction, so it anticipates the
 * next position before taking the adaptive step.
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
 *   - Meta records step, loss, and the Nesterov-corrected first moment.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface NadamInput {
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
    const task = (input as NadamInput | null) ?? {};
    const theta = [...(task.parameters ?? [1, -1, 0.5, -0.5])];
    const gradients = task.gradients ?? [
        [0.7, -0.6, 0.2, -0.2],
        [0.4, -0.3, 0.1, -0.1],
        [0.2, -0.1, 0.05, -0.05],
    ];
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.1;
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.9;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.999;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;

    const m = theta.map(() => 0);
    const v = theta.map(() => 0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(theta, "idle"),
        edges: [],
        description: `Initializing Nadam with ${theta.length} parameters and Nesterov momentum ${beta1}.`,
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
            v[i] = beta2 * (v[i] ?? 0) + (1 - beta2) * g * g;
            const mHat = (m[i] ?? 0) / (1 - Math.pow(beta1, timeStep));
            const vHat = (v[i] ?? 0) / (1 - Math.pow(beta2, timeStep));
            const nesterov = beta1 * mHat + ((1 - beta1) * g) / (1 - Math.pow(beta1, timeStep));
            theta[i] = (theta[i] ?? 0) - (lr * nesterov) / (Math.sqrt(vHat) + epsilon);
        }
        yield {
            stepNumber: step,
            entities: makeBars(theta, "active"),
            edges: [],
            description: `Step ${timeStep}: applied the bias-corrected Nesterov Adam update.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { step: timeStep, loss: lossAt(theta), learningRate: lr },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, "sorted"),
        edges: [],
        description: `Finished ${gradients.length} Nadam steps; final loss ${lossAt(theta).toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { step: gradients.length, loss: lossAt(theta), parameters: theta.slice() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Nadam makes Adam look ahead. Instead of stepping along the smoothed gradient alone, it evaluates momentum one step into the future by mixing the bias-corrected first moment with a fresh gradient term, then scales by Adam's adaptive denominator.",
        invariants: [
            "The first and second moments are exponential averages of g and g squared.",
            "Both moments are divided by their bias-correction factors 1 - beta^t.",
            "The Nesterov term weights the corrected moment by beta and adds a fresh gradient correction.",
        ],
        correctness:
            "The generator applies the published Nadam recurrence once per gradient in order. The companion test implements the recurrence independently and compares every final coordinate, and also checks that a positive gradient reduces a positive parameter.",
        complexityRationale:
            "Each step updates d coordinates with a constant number of operations, giving O(steps * d) time; the two d-length moment arrays require O(d) space.",
        uses: [
            "Training recurrent and transformer networks with faster early convergence",
            "Situations where Adam's momentum benefit is desired without manual tuning",
            "Benchmark comparisons of adaptive optimizers",
        ],
        references: [
            "Dozat, Incorporating Nesterov Momentum into Adam, ICLR Workshop 2016",
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
        ],
        workedExample:
            "With theta = 1, first gradient 0.7, beta1 = 0.9, beta2 = 0.999, at step one the corrected moments are mHat = 0.7 and vHat = 0.7, so the Nesterov term is about 0.7 and theta drops by roughly the learning rate.",
    },
    id: "nadam",
    name: "Nadam Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: {
        parameters: [1, -1, 0.5, -0.5],
        gradients: [
            [0.7, -0.6, 0.2, -0.2],
            [0.4, -0.3, 0.1, -0.1],
            [0.2, -0.1, 0.05, -0.05],
        ],
        learningRate: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize first moment m and second moment v to zero",
        "for each step t with gradient g do",
        "m = beta1 * m + (1 - beta1) * g; v = beta2 * v + (1 - beta2) * g^2",
        "mHat = m / (1 - beta1^t); vHat = v / (1 - beta2^t)",
        "nesterov = beta1 * mHat + (1 - beta1) * g / (1 - beta1^t)",
        "theta = theta - lr * nesterov / (sqrt(vHat) + eps)",
        "record the parameter vector and current loss",
        "done: report the final parameters",
    ],
};

export default module;
