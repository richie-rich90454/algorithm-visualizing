/**
 * batch-gradient-descent.ts - Full-Batch Gradient Descent for a Linear Fit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Batch gradient descent minimizes the mean squared error of a straight line
 * y = w*x + b by repeatedly stepping both parameters against the gradient of
 * the loss computed over the ENTIRE training set. Every update uses all points,
 * which makes the path smooth and deterministic.
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
 *   - Two pivot nodes joined by an edge show the current fitted line.
 *   - The final frame is green when the loss dropped below its starting value.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

/** Mean loss and its gradient with respect to w and b over all points. */
function gradient(points: Point[], w: number, b: number) {
    let dw = 0;
    let db = 0;
    let loss = 0;
    for (const point of points) {
        const x = point[0];
        const y = point[1];
        const err = w * x + b - y;
        dw += err * x;
        db += err;
        loss += 0.5 * err * err;
    }
    const n = Math.max(1, points.length);
    return { dw: dw / n, db: db / n, loss: loss / n };
}

/** Build plotted points plus the fitted line endpoints for one epoch. */
function makeEntities(points: Point[], w: number, b: number, converged: boolean): VisualEntity[] {
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
        metadata: { index, x, y, predicted: w * x + b },
    }));

    const xs = points.map((point) => point[0]);
    const minX = xs.length > 0 ? Math.min(...xs) : 0;
    const maxX = xs.length > 0 ? Math.max(...xs) : 1;
    entities.push({
        id: "fit-start",
        type: "node",
        label: "line",
        value: [minX, w * minX + b],
        state: converged ? "sorted" : "pivot",
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
        state: converged ? "sorted" : "pivot",
        x: maxX,
        y: w * maxX + b,
        width: 0,
        height: 0,
        metadata: { line: true, end: 1 },
    });
    return entities;
}

/** Edge joining the two endpoints of the fitted line. */
const fitEdge: VisualEdge = {
    id: "fit-line",
    sourceId: "fit-start",
    targetId: "fit-end",
    label: "y = wx + b",
    state: "path",
    directed: false,
};

/** The batch gradient descent generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[]; learningRate?: number; epochs?: number } | null) ?? {};
    const points: Point[] = task.points ?? [
        [0, 1],
        [1, 3],
        [2, 5],
        [3, 7],
        [4, 9],
    ];
    const learningRate =
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.05;
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 200;

    let w = 0;
    let b = 0;
    const start = gradient(points, w, b).loss;
    let loss = start;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b, false),
        edges: [fitEdge],
        description: `Batch gradient descent on ${points.length} points, learning rate ${learningRate}, starting loss ${start.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w, b, loss, learningRate, epochs, initialLoss: start },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const grad = gradient(points, w, b);
        w -= learningRate * grad.dw;
        b -= learningRate * grad.db;
        loss = gradient(points, w, b).loss;
        yield {
            stepNumber: step,
            entities: makeEntities(points, w, b, loss < start),
            edges: [fitEdge],
            description: `Epoch ${epoch}: gradient (${grad.dw.toFixed(3)}, ${grad.db.toFixed(3)}), line y = ${w.toFixed(3)}x + ${b.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { epoch, w, b, loss, learningRate, epochs, initialLoss: start },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b, loss < start),
        edges: [fitEdge],
        description: `After ${epochs} full-batch updates the line is y = ${w.toFixed(3)}x + ${b.toFixed(3)} with loss ${loss.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { converged: loss < start, w, b, loss, epochs, initialLoss: start },
    };
}

/** The batch gradient descent module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Fit a line by feeling your way downhill. At the current line, measure how wrong each prediction is, average those errors into one gradient that points uphill, then step every parameter a small amount in the opposite direction. Repeating that over the whole data set settles on the least-squares line.",
        invariants: [
            "The loss is the mean of half the squared prediction errors over all points.",
            "Each update subtracts the learning rate times the full-batch gradient from both parameters.",
            "Because the data and learning rate are fixed, the sequence of lines is fully deterministic.",
        ],
        correctness:
            "For a sum of squared errors the gradient is linear in the residuals, so a step of size small enough relative to the curvature cannot increase the loss. With a learning rate below two over the largest eigenvalue of the feature covariance, the iterates converge to the unique least-squares minimizer.",
        complexityRationale:
            "Each epoch scans all n points twice to accumulate gradients and loss, so the time is O(epochs * n). Only the points and the two parameters are retained, giving O(n) space.",
        uses: [
            "Fitting linear regression models in statistics and machine learning",
            "A teaching baseline for comparing stochastic and mini-batch optimizers",
            "Convex model fitting where the whole data set fits in memory",
        ],
        references: [
            "Cauchy, Methode generale pour resoudre les problemes d'analyse, 1847",
            "Bottou, Large-Scale Machine Learning with Stochastic Gradient Descent, 2010",
        ],
        workedExample:
            "On points (0,1), (1,3), (2,5), (3,7), (4,9) starting from w=0, b=0, the first gradient pushes w upward by the average of x times the residuals. After a couple hundred steps with rate 0.05 the line approaches y = 2x + 1 and the loss falls close to zero.",
    },
    id: "batch-gradient-descent",
    name: "Batch Gradient Descent",
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
        epochs: 200,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize w and b to zero",
        "repeat for a fixed number of epochs",
        "sum residuals over every training point",
        "form gradients for w and b from the mean residuals",
        "subtract learning rate times each gradient",
        "record the new loss over the full batch",
        "done: report the fitted line and final loss",
    ],
};

export default module;
