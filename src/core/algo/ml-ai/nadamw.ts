/**
 * nadamw.ts - NadamW (Nadam with Decoupled Weight Decay) on a Linear Fit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Nadam blends Adam's adaptive moments with Nesterov momentum by using a
 * look-ahead gradient in the first moment. NadamW adds decoupled weight decay:
 * the parameters shrink by a factor of one minus the learning rate times the
 * decay before the adaptive gradient step is applied. This demo fits a
 * two-parameter least-squares line.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(epochs * n) for n training points
 *   Space: O(n) for the stored points and drawn entities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Training points are plotted in the plane.
 *   - The fitted line endpoints move as the updates accumulate.
 *   - Meta records the two moments, the decay factor and the Nesterov term.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

/** Mean loss and gradient of the least-squares line. */
function gradient(points: Point[], w: number, b: number) {
    let dw = 0;
    let db = 0;
    let loss = 0;
    for (const [x, y] of points) {
        const err = w * x + b - y;
        dw += err * x;
        db += err;
        loss += 0.5 * err * err;
    }
    const n = Math.max(1, points.length);
    return { dw: dw / n, db: db / n, loss: loss / n };
}

function makeEntities(points: Point[], w: number, b: number): VisualEntity[] {
    const entities: VisualEntity[] = points.map(([x, y], index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: `${x},${y}`,
        value: [x, y],
        state: (Math.abs(w * x + b - y) < 0.5 ? "sorted" : "unvisited") as EntityState,
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index, x, y },
    }));
    const xs = points.map((point) => point[0]);
    const minX = xs.length > 0 ? Math.min(...xs) : 0;
    const maxX = xs.length > 0 ? Math.max(...xs) : 1;
    entities.push({
        id: "fit-start",
        type: "node",
        label: "line",
        value: [minX, w * minX + b],
        state: "pivot",
        x: minX,
        y: w * minX + b,
        width: 0,
        height: 0,
        metadata: { line: true, end: 0 },
    });
    entities.push({
        id: "fit-end",
        type: "node",
        label: "line",
        value: [maxX, w * maxX + b],
        state: "pivot",
        x: maxX,
        y: w * maxX + b,
        width: 0,
        height: 0,
        metadata: { line: true, end: 1 },
    });
    return entities;
}

const fitEdge: VisualEdge = {
    id: "fit-line",
    sourceId: "fit-start",
    targetId: "fit-end",
    label: "y = wx + b",
    state: "path",
    directed: false,
};

/** The NadamW generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            points?: Point[];
            learningRate?: number;
            beta1?: number;
            beta2?: number;
            weightDecay?: number;
            epochs?: number;
        } | null
    ) ?? {};
    const points: Point[] = task.points ?? [
        [0, 1],
        [1, 3],
        [2, 5],
        [3, 7],
        [4, 9],
    ];
    const learningRate =
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.05;
    const beta1 = typeof task.beta1 === "number" ? Math.min(0.9999, Math.max(0, task.beta1)) : 0.9;
    const beta2 = typeof task.beta2 === "number" ? Math.min(0.9999, Math.max(0, task.beta2)) : 0.999;
    const weightDecay =
        typeof task.weightDecay === "number" && task.weightDecay >= 0 ? task.weightDecay : 0.01;
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 40;
    const epsilon = 1e-8;

    let w = 0;
    let b = 0;
    let mW = 0;
    let mB = 0;
    let vW = 0;
    let vB = 0;
    const initialLoss = gradient(points, w, b).loss;
    let loss = initialLoss;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `NadamW on ${points.length} points, rate ${learningRate}, decay ${weightDecay}, starting loss ${initialLoss.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w, b, loss, mW, mB, vW, vB, decayFactor: 1, initialLoss },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const grad = gradient(points, w, b);
        const decayFactor = 1 - learningRate * weightDecay;
        w *= decayFactor;
        b *= decayFactor;
        mW = beta1 * mW + (1 - beta1) * grad.dw;
        mB = beta1 * mB + (1 - beta1) * grad.db;
        vW = beta2 * vW + (1 - beta2) * grad.dw * grad.dw;
        vB = beta2 * vB + (1 - beta2) * grad.db * grad.db;
        const bc1 = 1 - Math.pow(beta1, epoch);
        const bc2 = 1 - Math.pow(beta2, epoch);
        const nesterovW = (beta1 * mW + (1 - beta1) * grad.dw) / bc1;
        const nesterovB = (beta1 * mB + (1 - beta1) * grad.db) / bc1;
        const denomW = Math.sqrt(vW / bc2) + epsilon;
        const denomB = Math.sqrt(vB / bc2) + epsilon;
        const stepSize = learningRate / bc1;
        w -= stepSize * (nesterovW / denomW);
        b -= stepSize * (nesterovB / denomB);
        loss = gradient(points, w, b).loss;
        yield {
            stepNumber: step,
            entities: makeEntities(points, w, b),
            edges: [fitEdge],
            description: `Epoch ${epoch}: Nesterov step for w is ${(stepSize * (nesterovW / denomW)).toFixed(4)}, line y = ${w.toFixed(3)}x + ${b.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { epoch, w, b, loss, mW, mB, vW, vB, decayFactor, initialLoss },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `After ${epochs} NadamW updates the line is y = ${w.toFixed(3)}x + ${b.toFixed(3)} with loss ${loss.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: {
            converged: loss < initialLoss,
            w,
            b,
            loss,
            mW,
            mB,
            vW,
            vB,
            decayFactor: 1 - learningRate * weightDecay,
            initialLoss,
        },
    };
}

/** The NadamW module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Nadam adds a Nesterov look-ahead to Adam by mixing the current gradient into the momentum term, which reacts faster to changing directions. NadamW then applies weight decay separately from the adaptive step, so the decay does not get distorted by the moment normalization. The two changes together give an optimizer with both responsiveness and well-behaved regularization.",
        invariants: [
            "Decoupled decay multiplies the parameters by a fixed factor before the gradient step.",
            "The Nesterov term combines the updated momentum and the current gradient, then bias-corrects them.",
            "The second moment is a decaying average of squared gradients with its own bias correction.",
        ],
        correctness:
            "The decay factor is a positive scalar below one, so decay alone can never increase parameter magnitude. The remaining update follows the Nadam direction, which is a bias-corrected Nesterov momentum direction scaled by a positive denominator; on a convex quadratic this is a descent direction, so the two effects together reduce the loss for a suitable rate.",
        complexityRationale:
            "Each epoch computes the gradient over n points and applies a constant number of scalar operations per parameter, so time is O(epochs * n). Two moment values plus the decay factor are stored, leaving space at O(n) for the data.",
        uses: [
            "Training large models where decoupled decay improves generalization",
            "Replacing AdamW when faster momentum response is desired",
            "Fine-tuning with explicit weight regularization",
        ],
        references: [
            "Dozat, Incorporating Nesterov Momentum into Adam, ICLR Workshop 2016",
            "Loshchilov and Hutter, Decoupled Weight Decay Regularization, ICLR 2019",
        ],
        workedExample:
            "On the line data, each NadamW epoch first shrinks the slope and bias slightly by the decay factor, then applies a normalized Nesterov step computed from the look-ahead momentum. Because the moments are bias-corrected, the very first step already has full size and pushes the fitted line toward the data.",
    },
    id: "nadamw",
    name: "NadamW Optimizer",
    category: "ml-ai",
    complexity: { time: "O(epochs * n)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 1],
            [1, 3],
            [2, 5],
            [3, 7],
            [4, 9],
        ],
        learningRate: 0.05,
        beta1: 0.9,
        beta2: 0.999,
        weightDecay: 0.01,
        epochs: 40,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameters and first and second moments to zero",
        "repeat for a fixed number of epochs",
        "shrink parameters by one minus learning rate times weight decay",
        "compute the mean gradient over all points",
        "update both moments with their decay rates",
        "form the Nesterov term from updated momentum and current gradient, bias-corrected",
        "subtract learning rate times corrected Nesterov term over root of corrected second moment",
        "done: report the fitted line and final loss",
    ],
};

export default module;
