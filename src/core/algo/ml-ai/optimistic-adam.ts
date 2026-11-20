/**
 * optimistic-adam.ts - Optimistic Adam on a Linear Fit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Optimistic Adam extrapolates the gradient forward using the change since the
 * previous step, then feeds that optimistic gradient into the usual Adam moment
 * and denominator machinery. The extrapolation damps the cycling that can occur
 * in adversarial training while Adam's per-parameter scaling is preserved. This
 * demo fits a two-parameter least-squares line.
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
 *   - The fitted line endpoints move as the optimistic Adam updates accumulate.
 *   - Meta records Adam's two moments and the previous raw gradient.
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

/** The optimistic-Adam generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            points?: Point[];
            learningRate?: number;
            beta1?: number;
            beta2?: number;
            optimism?: number;
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
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.02;
    const beta1 = typeof task.beta1 === "number" ? Math.min(0.9999, Math.max(0, task.beta1)) : 0.9;
    const beta2 = typeof task.beta2 === "number" ? Math.min(0.9999, Math.max(0, task.beta2)) : 0.999;
    const optimism =
        typeof task.optimism === "number" ? Math.min(1, Math.max(0, task.optimism)) : 0.5;
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 40;
    const epsilon = 1e-8;

    let w = 0;
    let b = 0;
    let mW = 0;
    let mB = 0;
    let vW = 0;
    let vB = 0;
    let prevDw = 0;
    let prevDb = 0;
    const initialLoss = gradient(points, w, b).loss;
    let loss = initialLoss;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `Optimistic Adam on ${points.length} points, rate ${learningRate}, optimism ${optimism}, starting loss ${initialLoss.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w, b, loss, mW, mB, vW, vB, prevDw, prevDb, initialLoss },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const grad = gradient(points, w, b);
        const optDw = grad.dw + optimism * (grad.dw - prevDw);
        const optDb = grad.db + optimism * (grad.db - prevDb);
        mW = beta1 * mW + (1 - beta1) * optDw;
        mB = beta1 * mB + (1 - beta1) * optDb;
        vW = beta2 * vW + (1 - beta2) * optDw * optDw;
        vB = beta2 * vB + (1 - beta2) * optDb * optDb;
        const mHatW = mW / (1 - Math.pow(beta1, epoch));
        const mHatB = mB / (1 - Math.pow(beta1, epoch));
        const vHatW = vW / (1 - Math.pow(beta2, epoch));
        const vHatB = vB / (1 - Math.pow(beta2, epoch));
        w -= (learningRate * mHatW) / (Math.sqrt(vHatW) + epsilon);
        b -= (learningRate * mHatB) / (Math.sqrt(vHatB) + epsilon);
        prevDw = grad.dw;
        prevDb = grad.db;
        loss = gradient(points, w, b).loss;
        yield {
            stepNumber: step,
            entities: makeEntities(points, w, b),
            edges: [fitEdge],
            description: `Epoch ${epoch}: optimistic gradient ${optDw.toFixed(3)} feeds Adam, line y = ${w.toFixed(3)}x + ${b.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { epoch, w, b, loss, mW, mB, vW, vB, prevDw, prevDb, initialLoss },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `After ${epochs} optimistic Adam updates the line is y = ${w.toFixed(3)}x + ${b.toFixed(3)} with loss ${loss.toFixed(4)}.`,
        codeLineNumber: 8,
        layout: "point",
        meta: { converged: loss < initialLoss, w, b, loss, mW, mB, vW, vB, prevDw, prevDb, initialLoss },
    };
}

/** The optimistic-Adam module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Adam adapts each step to the recent history of gradients, but in games the gradients can alternate and make Adam cycle. Optimistic Adam first extrapolates the gradient forward by adding a fraction of its change since last step, then runs Adam on that prediction. The extrapolation is a correction that anticipates the next gradient, which reduces oscillation without giving up adaptive step sizes.",
        invariants: [
            "The optimistic gradient is the raw gradient plus the optimism coefficient times its change from the previous step.",
            "Adam's first and second moments are built from the optimistic gradient.",
            "The stored previous gradient is always the raw gradient, not the extrapolated one.",
        ],
        correctness:
            "When successive raw gradients are equal the extrapolation term is zero and the method is exactly Adam, inheriting its convergence on smooth objectives. When they alternate, the extrapolation points toward the trend and counteracts the cycle; the moment denominators remain positive, so every update is finite and bounded like Adam's.",
        complexityRationale:
            "Each epoch computes the gradient over n points, forms the extrapolation and applies Adam's constant-time updates per parameter, so time is O(epochs * n). Two moments plus the previous gradient are stored, leaving space at O(n) for the data.",
        uses: [
            "Training generative adversarial networks",
            "Bilinear and saddle-point optimization",
            "Multi-agent learning where other players' gradients drift",
        ],
        references: [
            "Daskalakis et al., Optimal Convergence for Learning and Solving Games, NeurIPS 2011",
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
        ],
        workedExample:
            "With the first slope gradient at minus fourteen and no previous gradient, the optimistic gradient equals the raw one, so the first step is an ordinary Adam step. If the next gradient is minus twelve, extrapolation predicts about minus nine point six with coefficient one half, and Adam scales that predicted direction by its running moments.",
    },
    id: "optimistic-adam",
    name: "Optimistic Adam",
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
        beta1: 0.9,
        beta2: 0.999,
        optimism: 0.5,
        epochs: 40,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameters, Adam moments and previous gradient to zero",
        "repeat for a fixed number of epochs",
        "compute the mean gradient over all points",
        "extrapolate the optimistic gradient from the gradient change since last step",
        "update first and second moments from the optimistic gradient",
        "bias-correct both moments",
        "subtract learning rate times corrected first moment over corrected second moment root",
        "store the raw gradient as the previous gradient",
        "done: report the fitted line and final loss",
    ],
};

export default module;
