/**
 * adadelta.ts - Adadelta Adaptive Optimizer on a Linear Fit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adadelta replaces the fixed global learning rate of Adagrad with a running
 * root-mean-square of the parameter updates themselves. It keeps two decaying
 * averages per parameter: one of squared gradients and one of squared updates.
 * The step is the ratio of their roots times the gradient, with an optional
 * global scale. This demo fits a two-parameter least-squares line.
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
 *   - The fitted line endpoints move as the adaptive steps accumulate.
 *   - Meta records both running averages for each parameter.
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

/** The Adadelta generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { points?: Point[]; learningRate?: number; rho?: number; epochs?: number } | null
    ) ?? {};
    const points: Point[] = task.points ?? [
        [0, 1],
        [1, 3],
        [2, 5],
        [3, 7],
        [4, 9],
    ];
    const rho = typeof task.rho === "number" ? Math.min(0.9999, Math.max(0, task.rho)) : 0.9;
    const learningRate =
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.1;
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 40;
    const epsilon = 1e-6;

    let w = 0;
    let b = 0;
    let accW = 0;
    let accB = 0;
    let deltaW = 0;
    let deltaB = 0;
    const initialLoss = gradient(points, w, b).loss;
    let loss = initialLoss;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `Adadelta on ${points.length} points, decay ${rho}, global scale ${learningRate}, starting loss ${initialLoss.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w, b, loss, accW, accB, deltaW, deltaB, initialLoss },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const grad = gradient(points, w, b);
        const updateW =
            -learningRate * ((Math.sqrt(deltaW) + epsilon) / (Math.sqrt(accW) + epsilon)) * grad.dw;
        const updateB =
            -learningRate * ((Math.sqrt(deltaB) + epsilon) / (Math.sqrt(accB) + epsilon)) * grad.db;
        accW = rho * accW + (1 - rho) * grad.dw * grad.dw;
        accB = rho * accB + (1 - rho) * grad.db * grad.db;
        deltaW = rho * deltaW + (1 - rho) * updateW * updateW;
        deltaB = rho * deltaB + (1 - rho) * updateB * updateB;
        w += updateW;
        b += updateB;
        loss = gradient(points, w, b).loss;
        yield {
            stepNumber: step,
            entities: makeEntities(points, w, b),
            edges: [fitEdge],
            description: `Epoch ${epoch}: Adadelta step for w is ${updateW.toFixed(4)}, line y = ${w.toFixed(3)}x + ${b.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { epoch, w, b, loss, accW, accB, deltaW, deltaB, initialLoss },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `After ${epochs} Adadelta updates the line is y = ${w.toFixed(3)}x + ${b.toFixed(3)} with loss ${loss.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { converged: loss < initialLoss, w, b, loss, accW, accB, deltaW, deltaB, initialLoss },
    };
}

/** The Adadelta module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Adagrad shrinks its step forever because it only accumulates squared gradients. Adadelta fixes this by also accumulating the squared parameter updates, and using their root in the numerator. The step size becomes a ratio of two RMS quantities with the gradient in between, so it self-scales and needs only a small optional global scale.",
        invariants: [
            "Both accumulators are decaying convex combinations of old and new squared quantities.",
            "The update for a parameter is minus the global scale times the ratio of the update RMS to the gradient RMS times its gradient.",
            "The epsilon terms keep both denominators strictly positive.",
        ],
        correctness:
            "Each accumulator is a positive weighted sum of past squares, so both roots are positive and every step is finite. The update RMS grows when recent steps are large and shrinks when they are small, preventing the monotone decay of Adagrad; on a smooth convex quadratic the iterates stay bounded and reduce the loss.",
        complexityRationale:
            "Each epoch computes the gradient over n points and performs a constant number of scalar operations per parameter, so time is O(epochs * n). Two extra accumulators per parameter are stored, leaving space at O(n) for the data.",
        uses: [
            "Training networks when a good global learning rate is unknown",
            "A robust default for noisy or sparse gradients",
            "An historical step toward Adam-style adaptive methods",
        ],
        references: [
            "Zeiler, ADADELTA: An Adaptive Learning Rate Method, arXiv:1212.5701, 2012",
            "Goodfellow, Bengio, and Courville, Deep Learning, Chapter 8, 2016",
        ],
        workedExample:
            "Starting from zero, both accumulators begin near zero, so the first Adadelta step equals the global scale times the gradient. Over subsequent epochs the two accumulators settle into a ratio that adapts the step scale and drives the fitted line toward the data.",
    },
    id: "adadelta",
    name: "Adadelta Optimizer",
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
        rho: 0.9,
        learningRate: 0.1,
        epochs: 60,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameters and both squared accumulators to zero",
        "repeat for a fixed number of epochs",
        "compute the mean gradient over all points",
        "form each update as minus global scale times root of update accumulator over root of gradient accumulator times gradient",
        "update the gradient accumulator with decay times old plus one minus decay times gradient squared",
        "update the update accumulator with decay times old plus one minus decay times update squared",
        "add the updates to the parameters",
        "done: report the fitted line and final loss",
    ],
};

export default module;
