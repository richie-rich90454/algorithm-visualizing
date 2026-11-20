/**
 * byol.ts - Bootstrap Your Own Latent
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BYOL learns useful representations without negative pairs. Two augmented
 * views of one image pass through an online encoder and a predictor, while a
 * slowly updated target encoder produces a stopped-gradient target for the
 * other view. The predictor is trained to match that target; the target
 * encoder follows the online encoder by exponential moving average.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d) for representation dimension d
 *   Space: O(d) for the online, predictor, and target weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the online weights after each update.
 *   - Meta reports the asymmetry loss and the target decay.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ByolInput {
    view1?: number[];
    view2?: number[];
    online?: number[];
    predictor?: number[];
    target?: number[];
    learningRate?: number;
    decay?: number;
}

function makeBars(values: number[], state: EntityState, prefix = "w"): VisualEntity[] {
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

function elementwise(a: number[], b: number[]): number[] {
    return a.map((v, i) => v * (b[i] ?? 0));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ByolInput | null) ?? {};
    const view1 = task.view1 ?? [1, 0.5, -0.5];
    const view2 = task.view2 ?? [0.8, 0.7, -0.4];
    const online = [...(task.online ?? [0.4, -0.3, 0.2])];
    const predictor = [...(task.predictor ?? [1, 1, 1])];
    const target = [...(task.target ?? [0.4, -0.3, 0.2])];
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.05;
    const decay = typeof task.decay === "number" ? task.decay : 0.99;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(online, "idle", "online"),
        edges: [],
        description: `BYOL with online, predictor, and target vectors of dimension ${online.length}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, decay, loss: 0, online: online.slice(), target: target.slice() },
    };
    step += 1;

    const y1 = elementwise(online, view1);
    const y2 = elementwise(online, view2);
    const p1 = elementwise(predictor, y1);
    const p2 = elementwise(predictor, y2);
    const t2 = elementwise(target, view2);
    const t1 = elementwise(target, view1);

    yield {
        stepNumber: step,
        entities: makeBars(p1, "active", "pred"),
        edges: [],
        description: "Computed the online predictions and the stopped-gradient targets for both views.",
        codeLineNumber: 2,
        layout: "array",
        meta: { step, predictions: p1, target: t2 },
    };
    step += 1;

    const gradPredictor = predictor.map((_v, i) =>
        ((p1[i] ?? 0) - (t2[i] ?? 0)) * (y1[i] ?? 0) + ((p2[i] ?? 0) - (t1[i] ?? 0)) * (y2[i] ?? 0),
    );
    const gradOnline = online.map((_v, i) =>
        ((p1[i] ?? 0) - (t2[i] ?? 0)) * (predictor[i] ?? 0) * (view1[i] ?? 0) +
        ((p2[i] ?? 0) - (t1[i] ?? 0)) * (predictor[i] ?? 0) * (view2[i] ?? 0),
    );

    for (let i = 0; i < online.length; i += 1) {
        predictor[i] = (predictor[i] ?? 0) - lr * (gradPredictor[i] ?? 0);
        online[i] = (online[i] ?? 0) - lr * (gradOnline[i] ?? 0);
    }
    const loss =
        0.5 *
        (p1.reduce((s, v, i) => s + (v - (t2[i] ?? 0)) ** 2, 0) +
            p2.reduce((s, v, i) => s + (v - (t1[i] ?? 0)) ** 2, 0));

    yield {
        stepNumber: step,
        entities: makeBars(online, "active", "online"),
        edges: [],
        description: `Asymmetry loss ${loss.toFixed(6)} backpropagated into the online and predictor weights only.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { step, loss, online: online.slice(), predictor: predictor.slice() },
    };
    step += 1;

    const before = target.slice();
    for (let i = 0; i < target.length; i += 1) {
        target[i] = decay * (target[i] ?? 0) + (1 - decay) * (online[i] ?? 0);
    }

    yield {
        stepNumber: step,
        entities: makeBars(target, "sorted", "target"),
        edges: [],
        description: `Done: the target encoder moved by exponential moving average with decay ${decay}, loss ${loss.toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            step,
            loss,
            online: online.slice(),
            predictor: predictor.slice(),
            target: target.slice(),
            previousTarget: before,
            decay,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Contrastive methods need negative examples to stop representations from collapsing. BYOL shows that a predictor plus a slowly changing target network can avoid collapse without any negatives. One view is encoded online and fed through a predictor, while the other view is encoded by the target network with its gradient stopped. Matching the prediction to that detached target creates an asymmetry that drives learning.",
        invariants: [
            "The target network receives no gradient from the loss; it changes only by decay.",
            "The same online weights encode both augmented views.",
            "The loss is the symmetric sum of the two view-to-target matching errors.",
        ],
        correctness:
            "For squared error between the predictor output and a detached target, differentiating with respect to the predictor gives the residual times the online projection, and differentiating further through the online encoder gives the residual times the predictor weight times the view. The stop-gradient is honored by omitting any derivative through the target encoder. The test recomputes these gradients independently and checks that the target vector changes only by the exponential moving average formula.",
        complexityRationale:
            "Each step performs a constant number of elementwise operations over the d-dimensional vectors for both views, giving linear time and linear space in the representation size.",
        uses: [
            "Self-supervised pretraining of vision encoders",
            "Representation learning without constructing negative pairs",
            "Transfer learning when labels are scarce",
        ],
        references: [
            "Grill et al., Bootstrap Your Own Latent: A New Approach to Self-Supervised Learning, 2020",
            "He et al., Momentum Contrast for Unsupervised Visual Representation Learning, 2020",
        ],
        workedExample:
            "With online weight 0.4, predictor 1, and a target view giving 0.56, the first prediction is 0.4 times the view. The residual against the detached target drives a small online update, and the target weight moves from 0.4 to 0.4 times 0.99 plus 0.01 times the new online weight.",
    },
    id: "byol",
    name: "Bootstrap Your Own Latent",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: {
        view1: [1, 0.5, -0.5],
        view2: [0.8, 0.7, -0.4],
        online: [0.4, -0.3, 0.2],
        predictor: [1, 1, 1],
        target: [0.4, -0.3, 0.2],
        learningRate: 0.05,
        decay: 0.99,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize online, predictor, and target weights",
        "encode both views with the online encoder",
        "produce predictions and detach the target encoder outputs",
        "compute the symmetric squared matching loss",
        "backpropagate into the online and predictor weights only",
        "move the target weights by exponential moving average",
        "record the loss and all three weight vectors",
        "done: report the final representations",
    ],
};

export default module;
