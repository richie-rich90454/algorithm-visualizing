/**
 * fast-gradient-sign-method.ts - Fast Gradient Sign Method Attack
 *
 * FGSM builds an adversarial example in one step by moving each input feature
 * by epsilon in the direction of the sign of the loss gradient. The bound on
 * each coordinate makes the perturbation small while often flipping a model's
 * prediction. This teaching core uses a linear model with squared error so the
 * gradient and the resulting loss change are exact.
 *
 * Time:  O(d) for d input features, space O(d)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FgsmInput {
    x: number[];
    weights: number[];
    bias: number;
    label: number;
    epsilon: number;
}

function scoreOf(x: number[], weights: number[], bias: number): number {
    return x.reduce((sum, value, i) => sum + value * (weights[i] ?? 0), bias);
}

function makeBars(values: number[], prefix: string, active: number): VisualEntity[] {
    return values.map((value, i) => {
        const state: EntityState = i === active ? "comparing" : (value < 0 ? "active" : "sorted");
        return {
            id: `bar-${i}`,
            type: "bar" as const,
            label: `${prefix}${i}: ${value.toFixed(3)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, level: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<FgsmInput> | null) ?? {};
    const x: number[] = Array.isArray(task.x) && task.x.length > 0 ? task.x.slice() : [0.5, 0.5, 0.5];
    const weights: number[] = Array.isArray(task.weights) && task.weights.length === x.length
        ? task.weights.slice()
        : [1, -1, 0.5];
    const bias = typeof task.bias === "number" ? task.bias : 0;
    const label = typeof task.label === "number" ? task.label : 1;
    const epsilon = Math.max(0, task.epsilon ?? 0.2);
    const d = x.length;

    const scoreBefore = scoreOf(x, weights, bias);
    const errorBefore = scoreBefore - label;
    const lossBefore = 0.5 * errorBefore * errorBefore;
    const gradient = weights.map((w) => errorBefore * w);
    const perturbation = gradient.map((g) => (g > 0 ? epsilon : (g < 0 ? -epsilon : 0)));
    const adversarial = x.map((value, i) => value + perturbation[i]!);
    const scoreAfter = scoreOf(adversarial, weights, bias);
    const errorAfter = scoreAfter - label;
    const lossAfter = 0.5 * errorAfter * errorAfter;
    const base = { d, epsilon, label, rows: 1, cols: d, scoreBefore, scoreAfter, lossBefore, lossAfter, gradient, perturbation };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(x, "x", -1),
        edges: [],
        description: `Clean input scores ${scoreBefore.toFixed(3)} with loss ${lossBefore.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, x: x.slice(), adversarial: adversarial.slice() },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(gradient, "g", -1),
        edges: [],
        description: `Gradient of the squared-error loss with respect to the input has entries in the sign of the model weights.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...base, x: x.slice(), adversarial: adversarial.slice() },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(perturbation, "eps", -1),
        edges: [],
        description: `Each feature moves by plus or minus ${epsilon} following the gradient sign.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...base, x: x.slice(), adversarial: adversarial.slice() },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(adversarial, "adv", -1),
        edges: [],
        description: `Done: adversarial score ${scoreAfter.toFixed(3)} raises the loss to ${lossAfter.toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...base, x: adversarial.slice(), adversarial: adversarial.slice(), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A trained model can be fooled by tiny, deliberately chosen changes to its input. FGSM is the cheapest such attack: compute how the loss changes with respect to each input feature, then nudge every feature by a fixed small amount in the direction that increases the loss. Because it uses only the sign, one backward pass is enough to build the adversarial example.",
        invariants: [
            "Every perturbation coordinate is plus epsilon, minus epsilon, or zero when the gradient is zero.",
            "The perturbation has infinite norm at most epsilon, matching the attack budget.",
            "The adversarial point increases the squared-error loss for this linear model.",
        ],
        correctness:
            "For a linear model with squared error, differentiating the loss with respect to an input feature yields the prediction error times that feature's weight. Moving the feature by epsilon times the sign of this derivative changes the score by epsilon times the absolute weight in the uphill direction, so the error grows by the sum of those nonnegative contributions and the loss cannot decrease when the initial error is nonzero. The test recomputes the attack independently, checks the per-coordinate sign and bound, and confirms the loss increase.",
        complexityRationale:
            "Computing the score, the gradient, the sign perturbation, and the new score each scan the d features once, so time is O(d). The gradient, perturbation, and adversarial input occupy O(d) space.",
        uses: [
            "Adversarial robustness evaluation of image and text classifiers",
            "Generating training examples for adversarial training",
            "A baseline attack for comparing stronger defense methods",
        ],
        references: [
            "Goodfellow et al., Explaining and Harnessing Adversarial Examples, ICLR, 2015",
            "Madry et al., Towards Deep Learning Models Resistant to Adversarial Attacks, ICLR, 2018",
        ],
        workedExample:
            "With weights one, minus one, and one half, input all one half, bias zero, and label one, the clean score is 0.25 and the error is minus 0.75. The gradient signs are minus, plus, minus, so the perturbation is minus 0.2, plus 0.2, minus 0.2. The new score is minus 0.25, the error grows to minus 1.25, and the squared error rises from about 0.28 to about 0.78.",
    },
    id: "fast-gradient-sign-method",
    name: "Fast Gradient Sign Method (FGSM)",
    category: "ml-ai",
    complexity: { time: "O(d)", space: "O(d)" },
    defaultInput: {
        x: [0.5, 0.5, 0.5],
        weights: [1, -1, 0.5],
        bias: 0,
        label: 1,
        epsilon: 0.2,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the input, model weights, bias, true label, and epsilon",
        "compute the model score as the dot product with the input plus the bias",
        "differentiate the squared-error loss with respect to each input feature",
        "set each perturbation to epsilon times the sign of its gradient",
        "add the perturbation to the input to form the adversarial example",
        "recompute the score and the loss on the perturbed input",
        "done: report the adversarial example and the loss increase",
    ],
};

export default module;
