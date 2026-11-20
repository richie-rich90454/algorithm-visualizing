/**
 * rprop.ts - RProp (Resilient Backpropagation) on a Linear Fit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RProp ignores the magnitude of a gradient and keeps a separate step size for
 * each parameter. If the gradient keeps its sign the step grows; if the sign
 * flips the step shrinks and the update is briefly suppressed. Only the sign of
 * the gradient chooses the direction. This demo applies the resilient updates
 * to a least-squares line.
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
 *   - The fitted line endpoints move as the resilient steps accumulate.
 *   - Meta records each parameter's current step size and previous sign.
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

/** The RProp generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            points?: Point[];
            initialStep?: number;
            increase?: number;
            decrease?: number;
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
    const initialStep =
        typeof task.initialStep === "number" && task.initialStep > 0 ? task.initialStep : 0.01;
    const increase = typeof task.increase === "number" && task.increase > 1 ? task.increase : 1.2;
    const decrease =
        typeof task.decrease === "number" && task.decrease > 0 && task.decrease < 1
            ? task.decrease
            : 0.5;
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 60;

    let w = 0;
    let b = 0;
    let stepW = initialStep;
    let stepB = initialStep;
    let prevSignW = 0;
    let prevSignB = 0;
    const initialLoss = gradient(points, w, b).loss;
    let loss = initialLoss;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `RProp on ${points.length} points, initial step ${initialStep}, starting loss ${initialLoss.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w, b, loss, stepW, stepB, prevSignW, prevSignB, initialLoss },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const grad = gradient(points, w, b);
        const sW = sign(grad.dw);
        const sB = sign(grad.db);
        if (sW * prevSignW > 0) {
            stepW *= increase;
        } else if (sW * prevSignW < 0) {
            stepW *= decrease;
        }
        if (sB * prevSignB > 0) {
            stepB *= increase;
        } else if (sB * prevSignB < 0) {
            stepB *= decrease;
        }
        w -= sW * stepW;
        b -= sB * stepB;
        prevSignW = sW;
        prevSignB = sB;
        loss = gradient(points, w, b).loss;
        yield {
            stepNumber: step,
            entities: makeEntities(points, w, b),
            edges: [fitEdge],
            description: `Epoch ${epoch}: resilient steps ${stepW.toFixed(4)}/${stepB.toFixed(4)}, line y = ${w.toFixed(3)}x + ${b.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { epoch, w, b, loss, stepW, stepB, prevSignW, prevSignB, initialLoss },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `After ${epochs} RProp updates the line is y = ${w.toFixed(3)}x + ${b.toFixed(3)} with loss ${loss.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { converged: loss < initialLoss, w, b, loss, stepW, stepB, prevSignW, prevSignB, initialLoss },
    };
}

/** The RProp module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Backpropagation magnitudes can vary by many orders of magnitude, making a shared learning rate hard to tune. RProp discards magnitudes and gives each weight its own step size. Whenever a gradient keeps the same sign, the step grows; when the sign flips, the step is cut back. The algorithm accelerates along consistent slopes and brakes at minima.",
        invariants: [
            "Each parameter has an independent step size that only grows or shrinks by fixed factors.",
            "The direction of every update is the sign of the current gradient.",
            "A sign reversal shrinks the step before the next move, damping overshoot.",
        ],
        correctness:
            "On a smooth one-dimensional slice, repeatedly moving downhill grows the step until overshoot occurs; the first sign flip shrinks it, so the step eventually straddles the minimum and contracts geometrically. Applying this independently per parameter yields a coordinate-wise descent process that converges for bounded step factors and a smooth loss.",
        complexityRationale:
            "Each epoch computes the gradient over n points and performs a constant number of step-factor and sign operations per parameter, so time is O(epochs * n). Two step sizes and two previous signs are stored, leaving space at O(n) for the data.",
        uses: [
            "Supervised training of multilayer perceptrons",
            "Settings where gradient magnitudes are poorly scaled",
            "Batch training with noisy gradient magnitudes but reliable signs",
        ],
        references: [
            "Riedmiller and Braun, A Direct Adaptive Method for Faster Backpropagation, 1993",
            "Igel and Husken, Improving the Rprop Learning Algorithm, 2000",
        ],
        workedExample:
            "The slope gradient is negative for the first several epochs while the line is too flat, so its step grows from 0.01 by a factor of 1.2 each time. Once the line overshoots the data, the sign flips, the step is halved, and the parameter settles near the best slope with progressively smaller moves.",
    },
    id: "rprop",
    name: "RProp Optimizer",
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
        initialStep: 0.01,
        increase: 1.2,
        decrease: 0.5,
        epochs: 60,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameters, per-parameter steps and previous signs",
        "repeat for a fixed number of epochs",
        "compute the mean gradient over all points",
        "multiply each step by the increase factor when the gradient sign is unchanged",
        "multiply each step by the decrease factor when the gradient sign flips",
        "move each parameter by its sign times its current step",
        "store the current signs as the previous signs",
        "done: report the fitted line and final loss",
    ],
};

export default module;
