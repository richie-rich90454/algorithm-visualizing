/**
 * radam.ts - RAdam: Rectified Adam
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RAdam (Liu et al., 2019) fixes Adam's unstable early steps. It estimates the
 * variance of the adaptive factor and, while that estimate is unreliable,
 * falls back to a plain momentum step. Once enough steps have accumulated it
 * applies a variance rectification coefficient to the adaptive update.
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
 *   - Meta records whether the step used rectification and its coefficient.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RAdamInput {
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
    const task = (input as RAdamInput | null) ?? {};
    const theta = [...(task.parameters ?? [1, -1, 0.5, -0.5])];
    const gradients = task.gradients ?? [
        [0.7, -0.6, 0.2, -0.2],
        [0.4, -0.3, 0.1, -0.1],
        [0.2, -0.1, 0.05, -0.05],
        [0.1, -0.05, 0.02, -0.01],
        [0.05, -0.02, 0.01, -0.005],
        [0.02, -0.01, 0.005, -0.002],
    ];
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.1;
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.9;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.99;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;

    const m = theta.map(() => 0);
    const v = theta.map(() => 0);
    const rhoInf = 2 / (1 - beta2) - 1;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(theta, "idle"),
        edges: [],
        description: `Initializing RAdam with ${theta.length} parameters; rectification threshold is rho > 4.`,
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
        const beta2Pow = Math.pow(beta2, timeStep);
        const rho = rhoInf - (2 * timeStep * beta2Pow) / (1 - beta2Pow);
        const rectified = rho > 4;
        let coefficient = 0;
        if (rectified) {
            coefficient = Math.sqrt(
                ((rho - 4) * (rho - 2) * rhoInf) / ((rhoInf - 4) * (rhoInf - 2) * rho),
            );
        }
        for (let i = 0; i < theta.length; i += 1) {
            const g = gradient[i] ?? 0;
            m[i] = beta1 * (m[i] ?? 0) + (1 - beta1) * g;
            v[i] = beta2 * (v[i] ?? 0) + (1 - beta2) * g * g;
            const mHat = (m[i] ?? 0) / (1 - Math.pow(beta1, timeStep));
            if (rectified) {
                const vHat = (v[i] ?? 0) / (1 - beta2Pow);
                theta[i] = (theta[i] ?? 0) - (lr * coefficient * mHat) / (Math.sqrt(vHat) + epsilon);
            } else {
                theta[i] = (theta[i] ?? 0) - lr * mHat;
            }
        }
        yield {
            stepNumber: step,
            entities: makeBars(theta, "active"),
            edges: [],
            description: `Step ${timeStep}: rho = ${rho.toFixed(3)}, ${rectified ? `rectified by ${coefficient.toFixed(4)}` : "using plain momentum (rho <= 4)"}.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { step: timeStep, loss: lossAt(theta), rho, rectified, coefficient },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, "sorted"),
        edges: [],
        description: `Finished ${gradients.length} RAdam steps; final loss ${lossAt(theta).toFixed(6)}.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { step: gradients.length, loss: lossAt(theta), parameters: theta.slice() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Adam's adaptive denominator can be wildly wrong during the first few steps because its second moment has barely been estimated. RAdam measures how trustworthy that estimate is; until it is reliable it takes a plain momentum step, then switches to an Adam step scaled by a rectification factor.",
        invariants: [
            "rhoInf is 2 / (1 - beta2) - 1 and rho grows toward rhoInf with the step count.",
            "When rho is at most 4, the adaptive denominator is not used.",
            "When rho exceeds 4, the step is scaled by a bounded rectification coefficient.",
        ],
        correctness:
            "The generator follows the published RAdam branch condition on rho and applies the corresponding update. The test independently computes the same recurrence, confirms the first step takes the momentum branch, and checks that later steps use rectification when rho exceeds four.",
        complexityRationale:
            "Each step performs constant work per coordinate, so time is O(steps * d); the first and second moments occupy O(d) space.",
        uses: [
            "Warm-starting training where Adam's early variance is unreliable",
            "Vision and language fine-tuning with short schedules",
            "A safer default than Adam when batches are small",
        ],
        references: [
            "Liu et al., On the Variance of the Adaptive Learning Rate and Beyond, ICLR 2020",
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
        ],
        workedExample:
            "With beta2 = 0.99 at step one, rhoInf = 199 and rho is about 1.02, below the threshold, so RAdam takes a plain momentum step. After roughly five steps rho passes 4 and the adaptive, rectified update takes over.",
    },
    id: "radam",
    name: "RAdam Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: {
        parameters: [1, -1, 0.5, -0.5],
        gradients: [
            [0.7, -0.6, 0.2, -0.2],
            [0.4, -0.3, 0.1, -0.1],
            [0.2, -0.1, 0.05, -0.05],
            [0.1, -0.05, 0.02, -0.01],
            [0.05, -0.02, 0.01, -0.005],
            [0.02, -0.01, 0.005, -0.002],
        ],
        learningRate: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize m and v to zero; rhoInf = 2 / (1 - beta2) - 1",
        "for each step t with gradient g do",
        "m = beta1*m + (1-beta1)*g; v = beta2*v + (1-beta2)*g^2",
        "rho = rhoInf - 2*t*beta2^t / (1 - beta2^t)",
        "if rho <= 4 then theta = theta - lr * m / (1 - beta1^t)",
        "else set rect = sqrt((rho-4)(rho-2)rhoInf / ((rhoInf-4)(rhoInf-2)rho))",
        "and theta = theta - lr * rect * mHat / (sqrt(vHat) + eps)",
        "record the parameter vector, rho, and the branch taken",
        "done: report the final parameters",
    ],
};

export default module;
