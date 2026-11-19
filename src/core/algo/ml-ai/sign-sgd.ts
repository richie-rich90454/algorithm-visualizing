/**
 * sign-sgd.ts - SignSGD on a Linear Fit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SignSGD ignores the magnitude of each gradient and keeps only its sign, so
 * every parameter moves by the same learning-rate step in a descent direction.
 * Combined with a majority vote across workers, this extreme compression gives
 * communication-efficient distributed training while retaining convergence.
 * This demo applies the sign update to a least-squares line.
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
 *   - The fitted line endpoints move as the equal-size sign steps accumulate.
 *   - Meta records the sign applied to each parameter on the latest step.
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

/** The SignSGD generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { points?: Point[]; learningRate?: number; epochs?: number } | null
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
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 40;

    let w = 0;
    let b = 0;
    let signW = 0;
    let signB = 0;
    const initialLoss = gradient(points, w, b).loss;
    let loss = initialLoss;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `SignSGD on ${points.length} points, rate ${learningRate}, starting loss ${initialLoss.toFixed(4)}; only gradient signs are used.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w, b, loss, signW, signB, initialLoss },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const grad = gradient(points, w, b);
        signW = grad.dw > 0 ? 1 : grad.dw < 0 ? -1 : 0;
        signB = grad.db > 0 ? 1 : grad.db < 0 ? -1 : 0;
        w -= learningRate * signW;
        b -= learningRate * signB;
        loss = gradient(points, w, b).loss;
        yield {
            stepNumber: step,
            entities: makeEntities(points, w, b),
            edges: [fitEdge],
            description: `Epoch ${epoch}: signs ${signW}/${signB} give an equal-size step, line y = ${w.toFixed(3)}x + ${b.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { epoch, w, b, loss, signW, signB, initialLoss },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `After ${epochs} SignSGD updates the line is y = ${w.toFixed(3)}x + ${b.toFixed(3)} with loss ${loss.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { converged: loss < initialLoss, w, b, loss, signW, signB, initialLoss },
    };
}

/** The SignSGD module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "In distributed training, sending full-precision gradients is expensive. SignSGD throws away everything except whether each coordinate of the gradient is positive or negative. Each worker sends one bit per parameter, a majority vote recovers the pooled sign, and every parameter moves by the same fixed step, which makes the method extremely communication efficient.",
        invariants: [
            "Each parameter moves by exactly the learning rate whenever its gradient is nonzero.",
            "The step direction is the sign of the gradient, never its magnitude.",
            "A zero gradient produces no step in that coordinate.",
        ],
        correctness:
            "The sign of a gradient always makes a nonnegative inner product with the gradient itself, so each single-coordinate step is a descent direction locally. When the signs are aggregated by majority vote across many workers the estimated sign concentrates around the true sign, and with a decaying step size the method converges under standard smoothness and bounded-variance assumptions.",
        complexityRationale:
            "Each epoch computes the gradient over n points and applies a constant number of sign and update operations per parameter, so time is O(epochs * n). Only the current signs are kept, leaving space at O(n) for the data.",
        uses: [
            "Communication-efficient distributed training with one-bit gradients",
            "Training with sign-based compressors and error feedback",
            "Low-precision and hardware-friendly optimization",
        ],
        references: [
            "Bernstein et al., signSGD: Compressed Optimization for Non-Convex Problems, ICML 2018",
            "Seide et al., 1-bit Stochastic Gradient Descent, 2014",
        ],
        workedExample:
            "The initial slope and bias gradients are both negative, so the first SignSGD step adds the learning rate to both parameters rather than a magnitude-proportional amount. The line moves toward the data one fixed increment at a time, and the increments shrink in number as the signs begin to alternate near the optimum.",
    },
    id: "sign-sgd",
    name: "SignSGD",
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
        epochs: 40,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameters to zero",
        "repeat for a fixed number of epochs",
        "compute the mean gradient over all points",
        "set each parameter sign to plus one, minus one, or zero from its gradient",
        "subtract learning rate times the sign from each parameter",
        "done: report the fitted line and final loss",
    ],
};

export default module;
