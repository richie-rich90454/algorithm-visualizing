/**
 * sharpness-aware-minimization.ts - Sharpness-Aware Minimization Step
 *
 * SAM looks for parameters that lie in a neighborhood of uniformly low loss.
 * It first takes a small ascent step in the gradient direction to find the
 * worst-case perturbation, then descends using the gradient at that perturbed
 * point. This teaching core uses a quadratic loss so every quantity is exact.
 *
 * Time:  O(d) per step, space O(d) for the vectors
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SamInput {
    weights: number[];
    target: number[];
    rho: number;
    lr: number;
}

function quadraticLoss(weights: number[], target: number[]): number {
    return 0.5 * weights.reduce((sum, w, i) => sum + Math.pow(w - (target[i] ?? 0), 2), 0);
}

function gradient(weights: number[], target: number[]): number[] {
    return weights.map((w, i) => w - (target[i] ?? 0));
}

function makeBars(values: number[], labelPrefix: string, active: number): VisualEntity[] {
    return values.map((value, i) => {
        const state: EntityState = i === active ? "comparing" : (value < 0 ? "active" : "sorted");
        return {
            id: `bar-${i}`,
            type: "bar" as const,
            label: `${labelPrefix}${i}: ${value.toFixed(3)}`,
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
    const task = (input as Partial<SamInput> | null) ?? {};
    const weights: number[] = Array.isArray(task.weights) && task.weights.length > 0
        ? task.weights.slice()
        : [0, 0, 0];
    const target: number[] = Array.isArray(task.target) && task.target.length === weights.length
        ? task.target.slice()
        : [1, 2, 3];
    const rho = Math.max(0, task.rho ?? 0.5);
    const lr = Math.max(0, task.lr ?? 0.1);
    const d = weights.length;

    const grad = gradient(weights, target);
    const gradNorm = Math.sqrt(grad.reduce((sum, g) => sum + g * g, 0));
    const perturbation = gradNorm > 0 ? grad.map((g) => (rho * g) / gradNorm) : Array(d).fill(0) as number[];
    const perturbed = weights.map((w, i) => w + perturbation[i]!);
    const gradAtPerturbed = gradient(perturbed, target);
    const nextWeights = weights.map((w, i) => w - lr * gradAtPerturbed[i]!);
    const lossBefore = quadraticLoss(weights, target);
    const lossAtPerturbed = quadraticLoss(perturbed, target);
    const lossAfter = quadraticLoss(nextWeights, target);
    const ascentGain = grad.reduce((sum, g, i) => sum + g * perturbation[i]!, 0);
    const base = { d, rho, lr, rows: 1, cols: d, gradNorm, ascentGain, lossBefore, lossAtPerturbed, lossAfter };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(weights, "w", -1),
        edges: [],
        description: `SAM starts at a point with loss ${lossBefore.toFixed(4)} and gradient norm ${gradNorm.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, weights: weights.slice(), gradient: grad, perturbation, nextWeights },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(grad, "g", -1),
        edges: [],
        description: `Computed the gradient and its norm ${gradNorm.toFixed(4)} for the ascent direction.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...base, weights: weights.slice(), gradient: grad, perturbation, nextWeights },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(perturbation, "delta", -1),
        edges: [],
        description: `Worst-case perturbation has radius ${rho} and raises the loss to ${lossAtPerturbed.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...base, weights: perturbed.slice(), gradient: grad, perturbation, nextWeights },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(nextWeights, "w", -1),
        edges: [],
        description: `Done: descent from the perturbed point lowers the loss to ${lossAfter.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...base, weights: nextWeights.slice(), gradient: gradAtPerturbed, perturbation, nextWeights },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A model that sits in a narrow, deep minimum can generalize worse than one in a broad, flat minimum. SAM changes the training objective from the loss at the weights to the maximum loss in a small neighborhood around them. It approximates that maximum with one ascent step, then takes a normal descent step from the perturbed location, which encourages flatter solutions.",
        invariants: [
            "The perturbation is the gradient normalized to a fixed radius rho when the gradient is nonzero.",
            "The perturbation points uphill, so its dot product with the gradient is rho times the gradient norm.",
            "The final descent uses the gradient evaluated at the perturbed weights, not at the original weights.",
        ],
        correctness:
            "For the quadratic teaching loss, the gradient is exactly the displacement from the target, so the normalized perturbation has norm rho by construction and its inner product with the gradient equals rho times the gradient norm. The ascent point is the first-order maximizer inside the ball, and descending along the gradient there reduces a convex quadratic when the step is small enough relative to its curvature. The test recomputes the entire step independently and verifies the radius, the ascent gain, and the loss decrease.",
        complexityRationale:
            "One gradient evaluation, one normalization, and one descent update each scan the d coordinates a constant number of times, so time is O(d). The gradient, perturbation, and perturbed weights each occupy O(d) space.",
        uses: [
            "Improving generalization of overparameterized neural networks",
            "Flat-minima training in image classification and language modeling",
            "Robust optimization against small parameter perturbations",
        ],
        references: [
            "Foret et al., Sharpness-Aware Minimization for Efficiently Improving Generalization, ICLR, 2021",
            "Kwon et al., ASAM: Adaptive Sharpness-Aware Minimization, ICML, 2021",
        ],
        workedExample:
            "From weights zero with target one, two, three, the initial loss is seven. The gradient points toward the negative target with norm about 3.74, so a radius 0.5 perturbation moves a fraction of a unit downhill in weight space but uphill in loss. Evaluating the gradient there and taking a small descent step produces weights near 0.11, 0.23, and 0.34 and a lower loss.",
    },
    id: "sharpness-aware-minimization",
    name: "Sharpness-Aware Minimization (SAM)",
    category: "ml-ai",
    complexity: { time: "O(d)", space: "O(d)" },
    defaultInput: { weights: [0, 0, 0], target: [1, 2, 3], rho: 0.5, lr: 0.1 },
    visualType: "array",
    run,
    pseudocode: [
        "read the weights, target, perturbation radius, and learning rate",
        "compute the gradient of the loss at the current weights",
        "normalize the gradient to the radius rho to form the ascent perturbation",
        "add the perturbation to obtain the worst-case weights",
        "evaluate the gradient again at the perturbed weights",
        "take one descent step using that perturbed gradient",
        "done: report the new weights and the losses before and after",
    ],
};

export default module;
