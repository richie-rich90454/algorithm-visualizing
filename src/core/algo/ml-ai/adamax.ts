/**
 * adamax.ts - Adamax (Infinity-Norm Adam) on a Linear Fit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adamax is a variant of Adam from the original paper that replaces the second
 * moment's L2 average with an exponentially decaying maximum of absolute
 * gradients, i.e. an infinity norm. The update divides the bias-corrected first
 * moment by that infinity norm, which is more stable when gradients are sparse
 * or have heavy tails. This demo fits a two-parameter least-squares line.
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
 *   - The fitted line endpoints move as the updates accumulate.
 *   - Meta records the first moment and infinity norm for each parameter.
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

/** The Adamax generator. */
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
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.05;
    const beta1 = typeof task.beta1 === "number" ? Math.min(0.9999, Math.max(0, task.beta1)) : 0.9;
    const beta2 = typeof task.beta2 === "number" ? Math.min(0.9999, Math.max(0, task.beta2)) : 0.999;
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 40;
    const epsilon = 1e-8;

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
        description: `Adamax on ${points.length} points, rate ${learningRate}, betas ${beta1}/${beta2}, starting loss ${initialLoss.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w, b, loss, mW, mB, vW, vB, initialLoss },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const grad = gradient(points, w, b);
        mW = beta1 * mW + (1 - beta1) * grad.dw;
        mB = beta1 * mB + (1 - beta1) * grad.db;
        vW = Math.max(beta2 * vW, Math.abs(grad.dw));
        vB = Math.max(beta2 * vB, Math.abs(grad.db));
        const mHatW = mW / (1 - Math.pow(beta1, epoch));
        const mHatB = mB / (1 - Math.pow(beta1, epoch));
        const updateW = (learningRate * mHatW) / (vW + epsilon);
        const updateB = (learningRate * mHatB) / (vB + epsilon);
        w -= updateW;
        b -= updateB;
        loss = gradient(points, w, b).loss;
        yield {
            stepNumber: step,
            entities: makeEntities(points, w, b),
            edges: [fitEdge],
            description: `Epoch ${epoch}: infinity-norm step for w is ${updateW.toFixed(4)}, line y = ${w.toFixed(3)}x + ${b.toFixed(3)}, loss ${loss.toFixed(4)}.`,
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
        description: `After ${epochs} Adamax updates the line is y = ${w.toFixed(3)}x + ${b.toFixed(3)} with loss ${loss.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { converged: loss < initialLoss, w, b, loss, mW, mB, vW, vB, initialLoss },
    };
}

/** The Adamax module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Adam normally scales each step by the square root of an average squared gradient. Adamax asks a different question: what is the largest gradient magnitude seen recently? It keeps an exponentially decaying maximum of absolute gradients and divides by it. The result is a step whose size is bounded by the learning rate, which behaves well when gradients are sparse.",
        invariants: [
            "The first moment is an exponentially decaying average of gradients.",
            "The second accumulator is the maximum of the previous decayed value and the current absolute gradient.",
            "Bias correction divides the first moment by one minus beta one to the power of the step count.",
        ],
        correctness:
            "The infinity-norm accumulator is nonnegative and at least as large as the current absolute gradient after the first step, so the corrected step is at most the learning rate in magnitude. This bound keeps iterates stable; on a convex quadratic with a suitable rate the bias-corrected direction remains a descent direction and the loss decreases.",
        complexityRationale:
            "Every epoch evaluates the gradient over n points and applies a fixed number of scalar updates per parameter, so time is O(epochs * n). The four moment values are the only extra state, leaving space at O(n) for the data.",
        uses: [
            "Training with sparse gradients such as word embeddings",
            "A stable default when gradient magnitudes vary sharply",
            "The optimizer used in several language model training setups",
        ],
        references: [
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
            "Goodfellow, Bengio, and Courville, Deep Learning, Chapter 8, 2016",
        ],
        workedExample:
            "With a slope gradient of minus fourteen on the first epoch, Adamax sets its infinity norm to fourteen and, after bias correction, moves the slope by roughly one learning rate. Later epochs keep the norm near the largest gradient seen, so the step stays bounded even as the gradient changes sign.",
    },
    id: "adamax",
    name: "Adamax Optimizer",
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
        beta1: 0.9,
        beta2: 0.999,
        epochs: 40,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameters and both moment accumulators to zero",
        "repeat for a fixed number of epochs",
        "compute the mean gradient over all points",
        "update first moment with beta one times old plus one minus beta one times gradient",
        "set second moment to the maximum of beta two times its old value and the absolute gradient",
        "bias-correct the first moment by one minus beta one to the epoch power",
        "subtract learning rate times corrected first moment over second moment plus epsilon",
        "done: report the fitted line and final loss",
    ],
};

export default module;
