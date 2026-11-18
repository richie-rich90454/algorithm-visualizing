/**
 * adamw-optimizer.ts - AdamW on a One-Parameter Quadratic
 *
 * Minimizes f(theta) = (theta - target)^2 with the AdamW update: adaptive
 * first and second moment estimates plus decoupled weight decay. The toy
 * objective makes every moment and every update checkable by hand.
 *
 * Time:  O(steps)  Space: O(1)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AdamWInput {
    theta?: number;
    target?: number;
    learningRate?: number;
    beta1?: number;
    beta2?: number;
    epsilon?: number;
    weightDecay?: number;
    steps?: number;
}

/** Four indicator cells for theta, first moment, second moment, and gradient. */
function makeCells(theta: number, m: number, v: number, grad: number, loss: number): VisualEntity[] {
    const values: Array<[string, number]> = [
        ["theta", theta],
        ["m", m],
        ["v", v],
        ["grad", grad],
        ["loss", loss],
    ];
    return values.map(([label, value], col) => ({
        id: `cell-0-${col}`,
        type: "cell" as const,
        label: `${label}=${value.toFixed(3)}`,
        value,
        state: (col === 0 ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AdamWInput | null) ?? {};
    let theta = typeof task.theta === "number" ? task.theta : 4;
    const target = typeof task.target === "number" ? task.target : 0;
    const learningRate =
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.1;
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.9;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.999;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;
    const weightDecay = typeof task.weightDecay === "number" ? task.weightDecay : 0.1;
    const steps = Math.max(1, typeof task.steps === "number" ? Math.trunc(task.steps) : 8);

    let m = 0;
    let v = 0;
    let step = 0;
    const gradientAt = (value: number): number => 2 * (value - target);
    let grad = gradientAt(theta);

    yield {
        stepNumber: step,
        entities: makeCells(theta, m, v, grad, (theta - target) ** 2),
        edges: [],
        description: `AdamW on (theta - ${target})^2: start theta=${theta}, learning rate ${learningRate}, decay ${weightDecay}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: 5,
            t: 0,
            theta,
            m,
            v,
            gradient: grad,
            loss: (theta - target) ** 2,
        },
    };
    step += 1;

    for (let t = 1; t <= steps; t += 1) {
        grad = gradientAt(theta);
        m = beta1 * m + (1 - beta1) * grad;
        v = beta2 * v + (1 - beta2) * grad * grad;
        const mHat = m / (1 - beta1 ** t);
        const vHat = v / (1 - beta2 ** t);
        theta = theta - (learningRate * mHat) / (Math.sqrt(vHat) + epsilon) - learningRate * weightDecay * theta;
        yield {
            stepNumber: step,
            entities: makeCells(theta, m, v, grad, (theta - target) ** 2),
            edges: [],
            description: `Step ${t}: gradient ${grad.toFixed(3)}, m-hat ${mHat.toFixed(3)}, v-hat ${vHat.toFixed(3)}; theta=${theta.toFixed(4)}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                rows: 1,
                cols: 5,
                t,
                theta,
                m,
                v,
                mHat,
                vHat,
                gradient: grad,
                loss: (theta - target) ** 2,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(theta, m, v, grad, (theta - target) ** 2),
        edges: [],
        description: `After ${steps} steps theta=${theta.toFixed(4)}, loss=${(theta - target) ** 2}. Decay was applied separately from the adaptive step.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 1,
            cols: 5,
            t: steps,
            theta,
            m,
            v,
            gradient: grad,
            loss: (theta - target) ** 2,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Adam keeps a moving average of gradients and of squared gradients, then divides the step by the square root of the second moment so that parameters with large or small gradients get appropriately scaled updates. AdamW changes one thing: the weight decay is subtracted directly from the parameter instead of being added to the gradient, which makes regularization independent of the adaptive scaling.",
        invariants: [
            "The first moment m is an exponential average of past gradients.",
            "The second moment v is an exponential average of past squared gradients and is nonnegative.",
            "Bias correction divides by (1 - beta^t) so the early averages are unbiased.",
        ],
        correctness:
            "At every step the update is exactly theta <- theta - lr * mHat / (sqrt(vHat) + eps) - lr * decay * theta. Because the decay term is outside the adaptive fraction, it is the same multiplicative shrink lr * decay regardless of gradient history. Replaying these formulas produces the same parameters as the visualizer.",
        complexityRationale:
            "Each step does a constant number of multiplications and one square root, so t steps cost O(t) time and the three scalar states use O(1) space.",
        uses: [
            "Default optimizer for transformers and many modern neural networks",
            "Fine-tuning pretrained models where decoupled decay matters",
            "Any deep model trained with adaptive learning rates",
        ],
        references: [
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, 2015",
            "Loshchilov and Hutter, Decoupled Weight Decay Regularization, 2019",
        ],
        workedExample:
            "With theta=4, target=0, lr=0.1, beta1=0.9, beta2=0.999, decay=0.1: the first gradient is 8, m=0.8, v=0.007992, mHat=8, vHat=7.992. The adaptive step is 0.1*8/(2.828+eps) about 0.283, and the decay step is 0.1*0.1*4=0.04, giving theta about 3.677.",
    },
    id: "adamw-optimizer",
    name: "AdamW Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps)", space: "O(1)" },
    defaultInput: {
        theta: 4,
        target: 0,
        learningRate: 0.1,
        beta1: 0.9,
        beta2: 0.999,
        epsilon: 1e-8,
        weightDecay: 0.1,
        steps: 8,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize theta, first moment m and second moment v to zero",
        "for step t from one to the step count",
        "compute gradient of the objective at theta",
        "update m with beta1 times m plus one minus beta1 times gradient",
        "update v with beta2 times v plus one minus beta2 times gradient squared",
        "form bias-corrected m-hat and v-hat",
        "subtract learning rate times m-hat over square root v-hat plus epsilon",
        "subtract learning rate times weight decay times theta separately",
        "done: report theta and the final loss",
    ],
};

export default module;
