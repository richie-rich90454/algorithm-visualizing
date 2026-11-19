/**
 * lars.ts - LARS (Layer-wise Adaptive Rate Scaling) on a Linear Fit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * LARS sets a separate learning rate for each layer by comparing the norm of
 * that layer's weights with the norm of its gradients: layers with large
 * weights relative to their gradients get a larger multiplier. This keeps
 * training stable in very large batches. Here the two line parameters act as
 * one layer, so a single trust ratio scales the shared update.
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
 *   - The fitted line endpoints move as the scaled updates accumulate.
 *   - Meta records the local learning rate and the two norms that produce it.
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

/** The LARS generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            points?: Point[];
            learningRate?: number;
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
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.1;
    const weightDecay =
        typeof task.weightDecay === "number" && task.weightDecay >= 0 ? task.weightDecay : 0.0001;
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 40;
    const epsilon = 1e-8;

    let w = 1;
    let b = 0.5;
    const initialLoss = gradient(points, w, b).loss;
    let loss = initialLoss;
    let localLR = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `LARS on ${points.length} points, rate ${learningRate}, decay ${weightDecay}, starting loss ${initialLoss.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w, b, loss, localLR, initialLoss },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const grad = gradient(points, w, b);
        const paramNorm = Math.hypot(w, b);
        const gradNorm = Math.hypot(grad.dw, grad.db);
        localLR =
            (learningRate * paramNorm) / (gradNorm + weightDecay * paramNorm + epsilon);
        w -= localLR * (grad.dw + weightDecay * w);
        b -= localLR * (grad.db + weightDecay * b);
        loss = gradient(points, w, b).loss;
        yield {
            stepNumber: step,
            entities: makeEntities(points, w, b),
            edges: [fitEdge],
            description: `Epoch ${epoch}: local rate ${localLR.toFixed(4)} from weight norm ${paramNorm.toFixed(3)} and gradient norm ${gradNorm.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { epoch, w, b, loss, localLR, paramNorm, gradNorm, initialLoss },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `After ${epochs} LARS updates the line is y = ${w.toFixed(3)}x + ${b.toFixed(3)} with loss ${loss.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { converged: loss < initialLoss, w, b, loss, localLR, initialLoss },
    };
}

/** The LARS module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A single learning rate works poorly when different layers have very different weight scales. LARS measures each layer's weight norm against its gradient norm and forms a trust ratio, so a layer with large weights but tiny gradients still moves at a sensible pace. This is the key trick that made very large batch training practical.",
        invariants: [
            "The local learning rate is the global rate times the weight norm over the gradient norm plus decay.",
            "The same local rate scales both parameters of the layer in a step.",
            "Adding decay inside the denominator keeps the trust ratio well defined.",
        ],
        correctness:
            "With positive norms and decay the trust ratio is finite and nonnegative, so every update is a scaled version of the gradient plus decay direction. Because the scaling adapts to the ratio of weight to gradient magnitude, the step size stays comparable across scales; on a smooth objective the direction remains a descent direction for small enough global rate.",
        complexityRationale:
            "Each epoch computes the gradient over n points, two vector norms and a constant number of parameter updates, so time is O(epochs * n). The norms and local rate are scalars, leaving space at O(n) for the data.",
        uses: [
            "Large-batch image classification training",
            "Distributed synchronous training of deep networks",
            "Stabilizing models whose layers have very different scales",
        ],
        references: [
            "You, Gitman, and Ginsburg, Large Batch Training of Convolutional Networks, 2017",
            "Goyal et al., Accurate, Large Minibatch SGD, 2017",
        ],
        workedExample:
            "From a slope of one and bias of one half, the first gradient norm is much larger than the weight norm, so the trust ratio is below one and the local rate is smaller than the global rate. As the parameters grow toward the data, the ratio rises and the local rate increases, keeping progress steady.",
    },
    id: "lars",
    name: "LARS Optimizer",
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
        learningRate: 0.1,
        weightDecay: 0.0001,
        epochs: 40,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameters to small nonzero values",
        "repeat for a fixed number of epochs",
        "compute the mean gradient over all points",
        "compute the norm of the parameters and the norm of the gradient",
        "set local rate to global rate times parameter norm over gradient norm plus decay",
        "subtract local rate times gradient plus decay times parameter from each parameter",
        "done: report the fitted line and final loss",
    ],
};

export default module;
