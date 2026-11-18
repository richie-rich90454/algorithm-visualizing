/**
 * stochastic-gradient-descent.ts - Stochastic Gradient Descent for a Line
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Stochastic gradient descent fits a straight line y = w*x + b by looking at
 * one training example at a time. For the current example it computes the
 * gradient of the squared-error loss and takes one small step against that
 * gradient. The example order is fixed here so the replay is deterministic,
 * which is a standard reproducible variant of SGD.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(epochs * n) for n examples
 *   Space: O(n) for the example entities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each training example is a point at (x, target).
 *   - Two fit markers show the current line's prediction at the extremes.
 *   - The example being processed is highlighted; the fit markers use PATH.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/** Build the point cloud plus the two markers that depict the current fit line. */
function makeEntities(
    xs: number[],
    ys: number[],
    w: number,
    b: number,
    current: number,
): VisualEntity[] {
    const entities: VisualEntity[] = xs.map((x, index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: String(ys[index] ?? 0),
        value: x,
        state: (index === current ? "comparing" : "idle") as EntityState,
        x,
        y: ys[index] ?? 0,
        width: 0,
        height: 0,
        metadata: { index, x, target: ys[index] ?? 0 },
    }));
    const xMin = xs.length > 0 ? Math.min(...xs) : 0;
    const xMax = xs.length > 0 ? Math.max(...xs) : 1;
    entities.push({
        id: "fit-start",
        type: "node",
        label: (w * xMin + b).toFixed(2),
        value: w * xMin + b,
        state: "path",
        x: xMin,
        y: w * xMin + b,
        width: 0,
        height: 0,
        metadata: { fit: 1, x: xMin },
    });
    entities.push({
        id: "fit-end",
        type: "node",
        label: (w * xMax + b).toFixed(2),
        value: w * xMax + b,
        state: "path",
        x: xMax,
        y: w * xMax + b,
        width: 0,
        height: 0,
        metadata: { fit: 1, x: xMax },
    });
    return entities;
}

/** One edge joining the two fit markers so the regression line is drawn. */
const fitEdge: VisualEdge = {
    id: "edge-fit",
    sourceId: "fit-start",
    targetId: "fit-end",
    label: "fit",
    state: "path",
    directed: false,
};

/** Total squared-error loss over the whole data set (halved for convenience). */
function totalLoss(xs: number[], ys: number[], w: number, b: number): number {
    let sum = 0;
    for (let i = 0; i < xs.length; i += 1) {
        const error = w * (xs[i] ?? 0) + b - (ys[i] ?? 0);
        sum += 0.5 * error * error;
    }
    return sum;
}

/** The SGD generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { points?: number[]; targets?: number[]; epochs?: number; learningRate?: number } | null
    ) ?? {};
    const xs: number[] = task.points ?? [0, 1, 2, 3, 4];
    const ys: number[] = task.targets ?? [1, 3, 5, 7, 9];
    const epochs = typeof task.epochs === "number" ? Math.max(1, task.epochs) : 8;
    const rate = typeof task.learningRate === "number" ? task.learningRate : 0.05;

    let w = 0;
    let b = 0;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(xs, ys, w, b, -1),
        edges: [fitEdge],
        description: `Fitting ${xs.length} examples with SGD, learning rate ${rate}, for up to ${epochs} epoch(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w, b, loss: totalLoss(xs, ys, w, b), updates: 0 },
    };
    step += 1;

    let updates = 0;
    for (let epoch = 0; epoch < epochs; epoch += 1) {
        for (let i = 0; i < xs.length; i += 1) {
            const x = xs[i] ?? 0;
            const target = ys[i] ?? 0;
            const error = w * x + b - target;
            const gradW = error * x;
            const gradB = error;
            w -= rate * gradW;
            b -= rate * gradB;
            updates += 1;
            yield {
                stepNumber: step,
                entities: makeEntities(xs, ys, w, b, i),
                edges: [fitEdge],
                description: `Epoch ${epoch + 1}, example ${i}: x ${x}, target ${target}, error ${error.toFixed(3)}; w -> ${w.toFixed(3)}, b -> ${b.toFixed(3)}.`,
                codeLineNumber: 4,
                layout: "point",
                meta: { epoch: epoch + 1, w, b, loss: totalLoss(xs, ys, w, b), updates, sample: i },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeEntities(xs, ys, w, b, -1),
        edges: [fitEdge],
        description: `Done: fitted line y = ${w.toFixed(3)}*x + ${b.toFixed(3)} with loss ${totalLoss(xs, ys, w, b).toFixed(4)} after ${updates} updates.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { epoch: epochs, w, b, loss: totalLoss(xs, ys, w, b), updates, converged: true },
    };
}

/** The stochastic gradient descent module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of waiting to see every example before adjusting the model, look at one example and correct the weights immediately. Each correction is a noisy but cheap estimate of the true gradient, so many tiny steps add up to a fitted model.",
        invariants: [
            "The model is always a straight line y = w*x + b.",
            "Each update moves w and b against the gradient of one example's squared error.",
            "The gradient of 0.5*(prediction - target)^2 is (prediction - target) times the feature for w and just the error for b.",
        ],
        correctness:
            "For a convex squared-error loss, the gradient points in the direction of steepest local increase, so a step of size eta against it decreases the loss on that example for small enough eta. Repeated small steps follow the negative-gradient direction of the overall loss and converge toward a least-squares fit for a suitable learning rate.",
        complexityRationale:
            "Each of the epochs performs n single-example updates, and each update touches only the two parameters, giving O(epochs * n) time. Storing the n example points and the fit markers uses O(n) space.",
        uses: [
            "Training linear models on large data sets where a full pass is too expensive",
            "Online learning where examples stream in one at a time",
            "The optimization core of deep learning frameworks",
        ],
        references: [
            "Bottou, Large-Scale Machine Learning with Stochastic Gradient Descent, 2010",
            "Rumelhart, Hinton, and Williams, Learning Representations by Back-Propagating Errors, 1986",
        ],
        workedExample:
            "Starting from w = 0, b = 0 with learning rate 0.05, the first example (0, 1) has error -1, so b moves to 0.05. The next example (1, 3) then has error about -2.95, moving w and b upward. After several passes the line approaches y = 2*x + 1.",
    },
    id: "stochastic-gradient-descent",
    name: "Stochastic Gradient Descent",
    category: "ml-ai",
    complexity: { time: "O(epochs * n)", space: "O(n)" },
    defaultInput: { points: [0, 1, 2, 3, 4], targets: [1, 3, 5, 7, 9], epochs: 8, learningRate: 0.05 },
    visualType: "point",
    run,
    pseudocode: [
        "initialize weight w and bias b to zero",
        "repeat for a fixed number of epochs",
        "for each training example x with target y",
        "compute error equal to w times x plus b minus y",
        "subtract learning rate times error times x from w",
        "subtract learning rate times error from b",
        "done: report the fitted line and its loss",
    ],
};

export default module;
