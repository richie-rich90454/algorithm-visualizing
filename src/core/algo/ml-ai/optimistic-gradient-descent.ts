/**
 * optimistic-gradient-descent.ts - Optimistic Gradient Descent on a Linear Fit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Optimistic gradient descent uses the previous gradient to predict, or
 * anticipate, the next one. By subtracting twice the current gradient but
 * adding back one times the previous gradient, it cancels a portion of the
 * oscillation that plagues ordinary gradient descent in games and bilinear
 * problems. This demo applies the update to a least-squares line.
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
 *   - The fitted line endpoints move as the optimistic updates accumulate.
 *   - Meta records the current and previous gradients used in the update.
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

/** The optimistic-gradient-descent generator. */
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
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.02;
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 40;

    let w = 0;
    let b = 0;
    let prevDw = 0;
    let prevDb = 0;
    const initialLoss = gradient(points, w, b).loss;
    let loss = initialLoss;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `Optimistic gradient descent on ${points.length} points, rate ${learningRate}, starting loss ${initialLoss.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w, b, loss, prevDw, prevDb, initialLoss },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const grad = gradient(points, w, b);
        const updateW = learningRate * (2 * grad.dw - prevDw);
        const updateB = learningRate * (2 * grad.db - prevDb);
        w -= updateW;
        b -= updateB;
        prevDw = grad.dw;
        prevDb = grad.db;
        loss = gradient(points, w, b).loss;
        yield {
            stepNumber: step,
            entities: makeEntities(points, w, b),
            edges: [fitEdge],
            description: `Epoch ${epoch}: optimistic step for w is ${updateW.toFixed(4)} using previous gradient ${prevDw.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { epoch, w, b, loss, prevDw, prevDb, gradDw: grad.dw, gradDb: grad.db, initialLoss },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `After ${epochs} optimistic updates the line is y = ${w.toFixed(3)}x + ${b.toFixed(3)} with loss ${loss.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { converged: loss < initialLoss, w, b, loss, prevDw, prevDb, initialLoss },
    };
}

/** The optimistic-gradient-descent module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "When gradients alternate direction, plain descent keeps overcorrecting and the iterates cycle. Optimistic descent assumes the next gradient will resemble the last one, so it applies a larger step now and refunds the previous gradient. That extra memory of the past damps the cycle and makes convergence faster in games and bilinear objectives.",
        invariants: [
            "The update direction is twice the current gradient minus the previous gradient.",
            "On the first step the previous gradient is zero, so the step is twice an ordinary one.",
            "The previous gradient is replaced by the current one after every update.",
        ],
        correctness:
            "The update can be rewritten as an ordinary gradient step plus a correction equal to the change in gradients. When consecutive gradients are equal the correction vanishes and the method reduces to standard descent; when they alternate the correction opposes the oscillation. For monotone operators this extra momentum term yields convergence where plain descent can cycle.",
        complexityRationale:
            "Each epoch computes the gradient over n points, forms a two-term combination and updates the parameters, so time is O(epochs * n). Only the previous gradient is stored beyond the data, leaving space at O(n).",
        uses: [
            "Solving bilinear saddle-point and minimax problems",
            "Training generative adversarial networks",
            "Online convex optimization with slowly changing gradients",
        ],
        references: [
            "Daskalakis et al., Optimal Convergence for Learning and Solving Games, NeurIPS 2011",
            "Mertikopoulos et al., Optimistic Mirror Descent in Saddle-Point Problems, 2018",
        ],
        workedExample:
            "The first slope gradient is minus fourteen and the previous gradient is zero, so the optimistic step is twice the rate times fourteen. On the second epoch a similar gradient produces a step of two times the new gradient minus the old one, which nearly cancels if the gradient has stopped changing, letting the line settle.",
    },
    id: "optimistic-gradient-descent",
    name: "Optimistic Gradient Descent",
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
        learningRate: 0.02,
        epochs: 40,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameters and previous gradient to zero",
        "repeat for a fixed number of epochs",
        "compute the mean gradient over all points",
        "form the optimistic direction as twice the current gradient minus the previous gradient",
        "subtract learning rate times that direction from each parameter",
        "store the current gradient as the previous gradient",
        "done: report the fitted line and final loss",
    ],
};

export default module;
