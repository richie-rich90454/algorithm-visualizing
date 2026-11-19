/**
 * amsgrad.ts - AMSGrad: Adam with a Monotone Second Moment
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AMSGrad (Reddi et al., 2018) repairs a convergence failure of Adam by keeping
 * the running maximum of the second-moment estimate. Because that denominator
 * can never shrink, the effective learning rate is monotone, which restores
 * convergence guarantees on convex problems.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d)   Space: O(d) for three moment arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the parameter vector after each step.
 *   - Meta exposes the monotone maximum used as the denominator.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AmsgradInput {
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
    const task = (input as AmsgradInput | null) ?? {};
    const theta = [...(task.parameters ?? [1, -1, 0.5, -0.5])];
    const gradients = task.gradients ?? [
        [1.0, -0.8, 0.3, -0.2],
        [0.2, -0.1, 0.05, -0.02],
        [0.6, -0.5, 0.2, -0.1],
        [0.1, -0.05, 0.01, -0.005],
    ];
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.1;
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.9;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.999;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;

    const m = theta.map(() => 0);
    const v = theta.map(() => 0);
    const vMax = theta.map(() => 0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(theta, "idle"),
        edges: [],
        description: `Initializing AMSGrad with ${theta.length} parameters and a monotone second moment.`,
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
            vMax[i] = Math.max(vMax[i] ?? 0, v[i] ?? 0);
            const mHat = (m[i] ?? 0) / (1 - Math.pow(beta1, timeStep));
            theta[i] = (theta[i] ?? 0) - (lr * mHat) / (Math.sqrt(vMax[i] ?? 0) + epsilon);
        }
        yield {
            stepNumber: step,
            entities: makeBars(theta, "active"),
            edges: [],
            description: `Step ${timeStep}: divided by the running maximum of the second moment.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { step: timeStep, loss: lossAt(theta), vMax: vMax.slice() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, "sorted"),
        edges: [],
        description: `Finished ${gradients.length} AMSGrad steps; final loss ${lossAt(theta).toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { step: gradients.length, loss: lossAt(theta), parameters: theta.slice() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Adam can accidentally increase its step size when a large gradient stops recurring, because its second-moment estimate decays. AMSGrad remembers the largest value that estimate ever reached and always divides by that, so the step size can only stay the same or shrink.",
        invariants: [
            "The second-moment estimate v is an exponential average of squared gradients.",
            "The denominator vMax is the coordinatewise maximum of v seen so far.",
            "The effective step size is nonincreasing at every step.",
        ],
        correctness:
            "The generator applies the AMSGrad recurrence with a coordinatewise running maximum. The companion test replays the recurrence independently and verifies that the exposed vMax never decreases across steps, the property that gives AMSGrad its convergence proof.",
        complexityRationale:
            "A constant number of operations per coordinate per step gives O(steps * d) time, and the first moment plus the two second-moment arrays use O(d) space.",
        uses: [
            "Convex and nonconvex training where Adam's convergence is suspect",
            "Regression tasks with sparse or bursty gradients",
            "A theoretically grounded Adam replacement",
        ],
        references: [
            "Reddi, Kale, and Kumar, On the Convergence of Adam and Beyond, ICLR 2018",
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
        ],
        workedExample:
            "If coordinate zero sees gradients 1.0, 0.2, then 0.6, its second moment rises and then decays, but vMax keeps the earlier larger value. The step for that coordinate is therefore never enlarged when the later gradient shrinks.",
    },
    id: "amsgrad",
    name: "AMSGrad Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: {
        parameters: [1, -1, 0.5, -0.5],
        gradients: [
            [1.0, -0.8, 0.3, -0.2],
            [0.2, -0.1, 0.05, -0.02],
            [0.6, -0.5, 0.2, -0.1],
            [0.1, -0.05, 0.01, -0.005],
        ],
        learningRate: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize first moment m and second moment v to zero; vMax = 0",
        "for each step t with gradient g do",
        "m = beta1 * m + (1 - beta1) * g",
        "v = beta2 * v + (1 - beta2) * g^2",
        "vMax = max(vMax, v) taken coordinatewise",
        "mHat = m / (1 - beta1^t)",
        "theta = theta - lr * mHat / (sqrt(vMax) + eps)",
        "record the parameter vector and vMax",
        "done: report the final parameters",
    ],
};

export default module;
