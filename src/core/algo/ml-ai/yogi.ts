/**
 * yogi.ts - Yogi Adaptive Optimizer on a Linear Fit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Yogi modifies Adam's second moment so the effective learning rate can never
 * increase on its own. Instead of an average of squared gradients, it uses an
 * additive sign-based update that moves the accumulator toward the current
 * squared gradient only when that gradient is larger. This prevents the sudden
 * learning-rate spikes Adam can show on sparse gradients. The demo fits a
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
 *   - The fitted line endpoints move as the additive-moment updates accumulate.
 *   - Meta records the first moment and Yogi's additive second moment.
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

/** Sign of a number, zero at zero. */
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

/** The Yogi generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            points?: Point[];
            learningRate?: number;
            beta1?: number;
            beta2?: number;
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
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 60;
    const epsilon = 1e-3;

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
        description: `Yogi on ${points.length} points, rate ${learningRate}, betas ${beta1}/${beta2}, starting loss ${initialLoss.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w, b, loss, mW, mB, vW, vB, initialLoss },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const grad = gradient(points, w, b);
        const g2W = grad.dw * grad.dw;
        const g2B = grad.db * grad.db;
        mW = beta1 * mW + (1 - beta1) * grad.dw;
        mB = beta1 * mB + (1 - beta1) * grad.db;
        vW = vW - (1 - beta2) * g2W * sign(vW - g2W);
        vB = vB - (1 - beta2) * g2B * sign(vB - g2B);
        const mHatW = mW / (1 - Math.pow(beta1, epoch));
        const mHatB = mB / (1 - Math.pow(beta1, epoch));
        const vHatW = vW / (1 - Math.pow(beta2, epoch));
        const vHatB = vB / (1 - Math.pow(beta2, epoch));
        w -= (learningRate * mHatW) / (Math.sqrt(Math.abs(vHatW)) + epsilon);
        b -= (learningRate * mHatB) / (Math.sqrt(Math.abs(vHatB)) + epsilon);
        loss = gradient(points, w, b).loss;
        yield {
            stepNumber: step,
            entities: makeEntities(points, w, b),
            edges: [fitEdge],
            description: `Epoch ${epoch}: additive second moment for w is ${vW.toFixed(3)}, line y = ${w.toFixed(3)}x + ${b.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { epoch, w, b, loss, mW, mB, vW, vB, initialLoss },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, w, b),
        edges: [fitEdge],
        description: `After ${epochs} Yogi updates the line is y = ${w.toFixed(3)}x + ${b.toFixed(3)} with loss ${loss.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { converged: loss < initialLoss, w, b, loss, mW, mB, vW, vB, initialLoss },
    };
}

/** The Yogi module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Adam's second moment is an average, so a single tiny gradient after many large ones can shrink the denominator and unexpectedly enlarge the step. Yogi changes that accumulator to an additive rule driven by the sign of the difference between it and the new squared gradient. The denominator can only move in the direction that keeps the effective learning rate from growing on its own.",
        invariants: [
            "The first moment is the same exponentially decaying gradient average as Adam's.",
            "The second moment changes by minus one minus beta two times squared gradient times the sign of its difference from that squared gradient.",
            "Bias correction is applied to both moments before forming the step.",
        ],
        correctness:
            "The additive second-moment rule moves the accumulator toward the current squared gradient but never overshoots it in the increasing direction, so the denominator reflects the largest recent scale. With a positive denominator the corrected direction is a bounded descent direction, and on a convex quadratic the iterates approach the minimizer for a suitable learning rate.",
        complexityRationale:
            "Each epoch computes the gradient over n points and applies a constant number of scalar operations per parameter, so time is O(epochs * n). Two moment values are stored, leaving space at O(n) for the data.",
        uses: [
            "Training on data with sparse or heavy-tailed gradients",
            "Replacing Adam when its effective learning rate is unstable",
            "Federated and large-scale nonconvex optimization",
        ],
        references: [
            "Zaheer et al., Adaptive Methods for Nonconvex Optimization, NeurIPS 2018",
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
        ],
        workedExample:
            "At the start the squared slope gradient is one hundred ninety six while the Yogi accumulator is zero. The sign of zero minus one hundred ninety six is negative, so the accumulator increases toward that scale in steps of one minus beta two times the squared gradient. Later small gradients push it back down only slightly, keeping the learning rate steady.",
    },
    id: "yogi",
    name: "Yogi Optimizer",
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
        epochs: 60,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameters and both moment accumulators to zero",
        "repeat for a fixed number of epochs",
        "compute the mean gradient over all points",
        "update first moment with beta one times old plus one minus beta one times gradient",
        "update second moment by subtracting one minus beta two times squared gradient times the sign of its difference from that square",
        "bias-correct both moments",
        "subtract learning rate times corrected first moment over root of corrected second moment plus epsilon",
        "done: report the fitted line and final loss",
    ],
};

export default module;
