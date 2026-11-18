/**
 * rmsprop.ts - RMSProp Adaptive Optimizer on a Linear Fit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RMSProp keeps a running average of the square of each parameter gradient and
 * divides the learning rate by its square root. Large, noisy gradients get
 * shrunk and small, steady ones get amplified, which lets the optimizer use a
 * single learning rate across parameters with very different scales. This demo
 * applies the update to a two-parameter least-squares line.
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
 *   - Meta records the running squared-gradient averages.
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

/** The RMSProp generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { points?: Point[]; learningRate?: number; decay?: number; epochs?: number } | null
    ) ?? {};
    const points: Point[] = task.points ?? [
        [0, 1],
        [1, 3],
        [2, 5],
        [3, 7],
        [4, 9],
    ];
    const learningRate =
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.08;
    const decay = typeof task.decay === "number" ? Math.min(0.9999, Math.max(0, task.decay)) : 0.9;
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 40;
    const epsilon = 1e-8;

    let w = 0;
    let b = 0;
    let avgW = 0;
    let avgB = 0;
    const start = gradient(points, w, b).loss;
    let loss = start;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `RMSProp on ${points.length} points, rate ${learningRate}, decay ${decay}, starting loss ${start.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w, b, loss, avgW, avgB, initialLoss: start },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const grad = gradient(points, w, b);
        avgW = decay * avgW + (1 - decay) * grad.dw * grad.dw;
        avgB = decay * avgB + (1 - decay) * grad.db * grad.db;
        w -= (learningRate * grad.dw) / (Math.sqrt(avgW) + epsilon);
        b -= (learningRate * grad.db) / (Math.sqrt(avgB) + epsilon);
        loss = gradient(points, w, b).loss;
        yield {
            stepNumber: step,
            entities: makeEntities(points, w, b),
            edges: [fitEdge],
            description: `Epoch ${epoch}: scaled step for w is ${((learningRate * grad.dw) / (Math.sqrt(avgW) + epsilon)).toFixed(4)}, line y = ${w.toFixed(3)}x + ${b.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { epoch, w, b, loss, avgW, avgB, initialLoss: start },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `After ${epochs} RMSProp updates the line is y = ${w.toFixed(3)}x + ${b.toFixed(3)} with loss ${loss.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { converged: loss < start, w, b, loss, avgW, avgB, initialLoss: start },
    };
}

/** The RMSProp module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A fixed learning rate is a compromise between parameters that need big steps and parameters that need small ones. RMSProp tracks a decaying average of each squared gradient, then divides by its root, so the effective step size adapts to how noisy each parameter's gradient has been. It is a small change to gradient descent that works well on unstable objectives.",
        invariants: [
            "Each running average is a convex combination of its old value and the new squared gradient.",
            "The step for a parameter is the learning rate times its gradient divided by the root of its average plus epsilon.",
            "The epsilon term prevents division by zero when gradients vanish.",
        ],
        correctness:
            "The averaging recurrence is a positive weighted sum of past squared gradients, so its root is a positive scale. Dividing by it keeps each step finite and normalizes the update direction; on a convex quadratic the iterates remain bounded and approach the minimizer for a suitable learning rate.",
        complexityRationale:
            "Every epoch evaluates the gradient over n points and performs a constant number of updates per parameter, so time is O(epochs * n). Two extra accumulators are stored, leaving space at O(n) for the data.",
        uses: [
            "Training recurrent neural networks with non-stationary gradients",
            "A component of later optimizers such as Adam",
            "Any setting where parameters have very different gradient scales",
        ],
        references: [
            "Hinton, Lecture 6e of the Coursera Neural Networks course, 2012",
            "Goodfellow, Bengio, and Courville, Deep Learning, Chapter 8, 2016",
        ],
        workedExample:
            "On the line data y = 2x + 1 the slope gradient is larger than the bias gradient. RMSProp builds a larger average for the slope, so its steps are scaled down while the bias steps stay relatively large, letting both parameters settle at similar rates.",
    },
    id: "rmsprop",
    name: "RMSProp Optimizer",
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
        learningRate: 0.08,
        decay: 0.9,
        epochs: 40,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameters and squared-gradient averages to zero",
        "repeat for a fixed number of epochs",
        "compute the mean gradient over all points",
        "update each average with decay times old plus one minus decay times gradient squared",
        "divide the learning rate by the root of the average plus epsilon",
        "subtract the scaled gradient from each parameter",
        "done: report the fitted line and final loss",
    ],
};

export default module;
