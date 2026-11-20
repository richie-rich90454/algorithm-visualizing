/**
 * ftrl.ts - FTRL-Proximal (Follow the Regularized Leader) on a Linear Fit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * FTRL-Proximal is an online optimizer designed for huge sparse models. It
 * keeps a per-coordinate sum of squared gradients and a running accumulator of
 * adjusted gradients, then chooses the weight that minimizes a regularized
 * linear model of the past. A concise closed-form update gives each coordinate
 * its own adaptive step without storing a full Hessian. The demo fits a
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
 *   - The fitted line endpoints move as the proximal updates accumulate.
 *   - Meta records the squared-gradient sums and the z accumulators.
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

function sign(value: number): number {
    return value > 0 ? 1 : value < 0 ? -1 : 0;
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

/** The FTRL-Proximal generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            points?: Point[];
            learningRate?: number;
            alpha?: number;
            beta?: number;
            lambda1?: number;
            lambda2?: number;
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
    const alpha = typeof task.alpha === "number" && task.alpha >= 0 ? task.alpha : 0.5;
    const beta = typeof task.beta === "number" && task.beta >= 0 ? task.beta : 1;
    const lambda1 = typeof task.lambda1 === "number" && task.lambda1 >= 0 ? task.lambda1 : 0;
    const lambda2 = typeof task.lambda2 === "number" && task.lambda2 >= 0 ? task.lambda2 : 0;
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 40;
    const epsilon = 1e-8;

    let w = 0;
    let b = 0;
    let nW = 0;
    let nB = 0;
    let zW = 0;
    let zB = 0;
    const initialLoss = gradient(points, w, b).loss;
    let loss = initialLoss;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `FTRL-Proximal on ${points.length} points, rate ${learningRate}, alpha ${alpha}, starting loss ${initialLoss.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w, b, loss, nW, nB, zW, zB, initialLoss },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const grad = gradient(points, w, b);
        const prevNW = nW;
        const prevNB = nB;
        nW += grad.dw * grad.dw;
        nB += grad.db * grad.db;
        const sigmaW = (Math.pow(nW, alpha) - Math.pow(prevNW, alpha)) / learningRate;
        const sigmaB = (Math.pow(nB, alpha) - Math.pow(prevNB, alpha)) / learningRate;
        zW += grad.dw - sigmaW * w;
        zB += grad.db - sigmaB * b;
        const denomW = (beta + Math.sqrt(nW) + epsilon) / learningRate + lambda2;
        const denomB = (beta + Math.sqrt(nB) + epsilon) / learningRate + lambda2;
        w = Math.abs(zW) > lambda1 ? -(zW - sign(zW) * lambda1) / denomW : 0;
        b = Math.abs(zB) > lambda1 ? -(zB - sign(zB) * lambda1) / denomB : 0;
        loss = gradient(points, w, b).loss;
        yield {
            stepNumber: step,
            entities: makeEntities(points, w, b),
            edges: [fitEdge],
            description: `Epoch ${epoch}: accumulated n for w is ${nW.toFixed(3)}, line y = ${w.toFixed(3)}x + ${b.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { epoch, w, b, loss, nW, nB, zW, zB, initialLoss },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `After ${epochs} FTRL updates the line is y = ${w.toFixed(3)}x + ${b.toFixed(3)} with loss ${loss.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { converged: loss < initialLoss, w, b, loss, nW, nB, zW, zB, initialLoss },
    };
}

/** The FTRL-Proximal module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "FTRL solves a regularized version of the online learning problem at every step: choose the weights that best explain all past gradients while staying close to the previous solution. For common regularizers this has a simple coordinate-wise closed form. The result adapts to gradient scales, produces naturally sparse weights, and is why the method became a workhorse for large advertising models.",
        invariants: [
            "Each coordinate keeps a cumulative sum of squared gradients.",
            "The z accumulator adds the gradient minus a shrinkage term times the current weight.",
            "Weights are computed from z with a soft-threshold that can set small coordinates to zero.",
        ],
        correctness:
            "The closed-form weight is the exact minimizer of the proximal objective formed from the linearized past losses plus the L1 and L2 penalties. Because each step solves that convex subproblem exactly, the online regret grows sublinearly for convex losses, so the average solution approaches the best fixed comparator in hindsight.",
        complexityRationale:
            "Each epoch computes a gradient over n points and applies constant-time closed-form updates per parameter, so time is O(epochs * n). Two accumulator values per parameter are stored, leaving space at O(n) for the data.",
        uses: [
            "Large-scale sparse logistic regression for click prediction",
            "Online learning with streaming data",
            "Models where L1 sparsity is desired",
        ],
        references: [
            "McMahan et al., Ad Click Prediction: a View from the Trenches, KDD 2013",
            "Shalev-Shwartz and Singer, Online Learning and Online Convex Optimization, 2012",
        ],
        workedExample:
            "From zero, the first slope gradient is minus fourteen, so the squared-gradient sum jumps and z becomes minus fourteen. The closed-form weight is positive and roughly the learning rate times fourteen over one plus the root of the sum, giving a moderate first step. Later gradients update n and z again, refining the slope without any manually tuned per-coordinate rate.",
    },
    id: "ftrl",
    name: "FTRL-Proximal Optimizer",
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
        alpha: 0.5,
        beta: 1,
        lambda1: 0,
        lambda2: 0,
        epochs: 40,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameters, squared-gradient sums and z accumulators to zero",
        "repeat for a fixed number of epochs",
        "compute the mean gradient over all points",
        "add the squared gradient to each coordinate sum",
        "add gradient minus the shrinkage term times the weight to z",
        "compute each weight from z with soft threshold and adaptive denominator",
        "done: report the fitted line and final loss",
    ],
};

export default module;
