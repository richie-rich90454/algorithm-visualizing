/**
 * simsiam.ts - Simple Siamese Representation Learning
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SimSiam shows that a siamese network can learn without negatives, momentum
 * encoders, or clustering. One branch predicts the representation of the other
 * through a small predictor, but the target branch is stop-gradient. The loss
 * is the negative cosine similarity between prediction and target, symmetrized
 * over both views. Only the predictor and encoder receive gradients.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d) for representation dimension d
 *   Space: O(d) for the predictor weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the predictor weights as they learn to match the targets.
 *   - Meta reports both cosine similarities and the symmetric loss.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SimSiamInput {
    view1?: number[];
    view2?: number[];
    predictor?: number[];
    steps?: number;
    learningRate?: number;
}

function makeBars(values: number[], state: EntityState, prefix = "p"): VisualEntity[] {
    return values.map((value, index) => ({
        id: `${prefix}-${index}`,
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

function dot(a: number[], b: number[]): number {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) {
        total += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return total;
}

function cosine(a: number[], b: number[]): number {
    const na = Math.sqrt(dot(a, a));
    const nb = Math.sqrt(dot(b, b));
    if (na === 0 || nb === 0) {
        return 0;
    }
    return dot(a, b) / (na * nb);
}

/**
 * Gradient of negative cosine similarity with respect to the first argument.
 * The second argument is treated as a constant (stop-gradient).
 */
function dNegativeCosine(a: number[], b: number[]): number[] {
    const na2 = dot(a, a);
    const na = Math.sqrt(na2);
    const nb = Math.sqrt(dot(b, b));
    if (na === 0 || nb === 0) {
        return a.map(() => 0);
    }
    const cos = dot(a, b) / (na * nb);
    return a.map((v, i) => {
        const term1 = (b[i] ?? 0) / (na * nb);
        const term2 = (cos * v) / na2;
        return -(term1 - term2);
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SimSiamInput | null) ?? {};
    const view1 = task.view1 ?? [1, 0.5, -0.5];
    const view2 = task.view2 ?? [0.8, 0.7, -0.4];
    const predictor = [...(task.predictor ?? [1, 1, 1])];
    const steps = typeof task.steps === "number" ? Math.max(1, task.steps) : 3;
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.1;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(predictor, "idle"),
        edges: [],
        description: `SimSiam with ${steps} predictor steps and learning rate ${lr}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, steps, loss: 0, cosine1: 0, cosine2: 0 },
    };
    step += 1;

    for (let t = 0; t < steps; t += 1) {
        const pred1 = predictor.map((v, i) => v * (view1[i] ?? 0));
        const pred2 = predictor.map((v, i) => v * (view2[i] ?? 0));
        const cos1 = cosine(pred1, view2);
        const cos2 = cosine(pred2, view1);
        const loss = -0.5 * (cos1 + cos2);

        yield {
            stepNumber: step,
            entities: makeBars(pred1, "comparing", "pred"),
            edges: [],
            description: `Step ${t}: cosine similarities ${cos1.toFixed(4)} and ${cos2.toFixed(4)} give symmetric loss ${loss.toFixed(6)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { step, iteration: t, cosine1: cos1, cosine2: cos2, loss, predictor: predictor.slice() },
        };
        step += 1;

        const g1 = dNegativeCosine(pred1, view2);
        const g2 = dNegativeCosine(pred2, view1);
        for (let i = 0; i < predictor.length; i += 1) {
            const grad = (g1[i] ?? 0) * (view1[i] ?? 0) + (g2[i] ?? 0) * (view2[i] ?? 0);
            predictor[i] = (predictor[i] ?? 0) - lr * 0.5 * grad;
        }
    }

    const pred1 = predictor.map((v, i) => v * (view1[i] ?? 0));
    const pred2 = predictor.map((v, i) => v * (view2[i] ?? 0));
    const cos1 = cosine(pred1, view2);
    const cos2 = cosine(pred2, view1);
    yield {
        stepNumber: step,
        entities: makeBars(predictor, "sorted"),
        edges: [],
        description: `Done: final negative cosine loss ${(-0.5 * (cos1 + cos2)).toFixed(6)} after ${steps} steps.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { step, predictor: predictor.slice(), cosine1: cos1, cosine2: cos2, loss: -0.5 * (cos1 + cos2) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SimSiam keeps the simple two-view setup but removes the moving average encoder and the negative queue. The trick is asymmetry: the left branch has a small predictor and gets gradients, while the right branch is detached, so the network cannot trivially satisfy the loss by copying itself. The objective is just negative cosine similarity between the prediction and the stopped target, averaged over both view orders.",
        invariants: [
            "The target branch is detached, so no gradient flows into it.",
            "The loss is the average of the two negative cosine similarities.",
            "The predictor is updated by gradient descent while the encoded views stay fixed in this demo.",
        ],
        correctness:
            "Negative cosine similarity equals minus the dot product divided by the product of norms. Differentiating with respect to the prediction yields minus the target over the norms plus the cosine times the prediction over its squared norm. The chain rule through the elementwise predictor multiplies by the view, and the test validates the analytic gradient with a finite-difference check and confirms the reported loss matches the cosine definition.",
        complexityRationale:
            "Each step computes two cosine similarities and two d-dimensional gradient vectors, so the work and storage are both linear in the representation dimension.",
        uses: [
            "Self-supervised visual representation learning",
            "Studying the role of stop-gradient in preventing collapse",
            "Pretraining encoders with very small batches",
        ],
        references: [
            "Chen and He, Exploring Simple Siamese Representation Learning, 2021",
            "Grill et al., Bootstrap Your Own Latent, 2020",
        ],
        workedExample:
            "Starting with predictor weights of one, the prediction for view one equals that view. If the other view points in a similar direction, the cosine is positive and the loss is negative, so gradient descent nudges the predictor to align its output even more closely with the detached target.",
    },
    id: "simsiam",
    name: "Simple Siamese Learning",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: {
        view1: [1, 0.5, -0.5],
        view2: [0.8, 0.7, -0.4],
        predictor: [1, 1, 1],
        steps: 3,
        learningRate: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize a predictor and take two views of one sample",
        "encode each view with the shared encoder",
        "predict one view with the predictor and detach the other",
        "measure negative cosine similarity in both directions",
        "average them into the symmetric SimSiam loss",
        "backpropagate only through the predictor branch",
        "repeat for a fixed number of steps",
        "done: report the final predictor and loss",
    ],
};

export default module;
