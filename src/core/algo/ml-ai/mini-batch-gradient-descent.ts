/**
 * mini-batch-gradient-descent.ts - Mini-Batch Gradient Descent
 *
 * Fits a line y = w*x + b by minimizing mean squared error. Training examples
 * are split into consecutive batches; each batch provides one noisy gradient
 * step. Batch size 1 is stochastic gradient descent and batch size n is full
 * batch gradient descent, so this single routine covers all three cases.
 *
 * Time:  O(epochs * n) gradient work per full pass over the data
 * Space: O(n) for the point entities
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MBDInput {
    xs?: number[];
    ys?: number[];
    learningRate?: number;
    batchSize?: number;
    epochs?: number;
}

/** Emit one point entity per training example, highlighting the active batch. */
function makePoints(
    xs: number[],
    ys: number[],
    active: Set<number>,
    showFit: boolean,
): VisualEntity[] {
    return xs.map((x, i) => ({
        id: `point-${i}`,
        type: "node" as const,
        label: `(${x},${ys[i]})`,
        value: [x, ys[i] ?? 0],
        state: (active.has(i) ? "comparing" : showFit ? "sorted" : "unvisited") as EntityState,
        x,
        y: ys[i] ?? 0,
        width: 0,
        height: 0,
        metadata: { index: i, x, y: ys[i] ?? 0 },
    }));
}

/** Mean squared error over the whole data set. */
function fullLoss(xs: number[], ys: number[], w: number, b: number): number {
    if (xs.length === 0) {
        return 0;
    }
    let total = 0;
    for (let i = 0; i < xs.length; i += 1) {
        const residual = w * (xs[i] ?? 0) + b - (ys[i] ?? 0);
        total += residual * residual;
    }
    return total / xs.length;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MBDInput | null) ?? {};
    const xs = Array.isArray(task.xs) ? [...task.xs] : [0, 1, 2, 3, 4, 5, 6, 7];
    const ys = Array.isArray(task.ys) ? [...task.ys] : xs.map((x) => 2 * x + 1);
    const n = Math.min(xs.length, ys.length);
    const learningRate =
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.05;
    const batchSize = Math.max(
        1,
        Math.min(n, typeof task.batchSize === "number" ? Math.trunc(task.batchSize) : 2),
    );
    const epochs = Math.max(1, typeof task.epochs === "number" ? Math.trunc(task.epochs) : 12);

    let w = 0;
    let b = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makePoints(xs.slice(0, n), ys.slice(0, n), new Set(), false),
        edges: [],
        description: `Fitting ${n} points with mini-batches of size ${batchSize} (learning rate ${learningRate}).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, batch: 0, w: 0, b: 0, loss: fullLoss(xs.slice(0, n), ys.slice(0, n), 0, 0) },
    };
    step += 1;

    let batchCounter = 0;
    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        for (let start = 0; start < n; start += batchSize) {
            const end = Math.min(n, start + batchSize);
            let gradW = 0;
            let gradB = 0;
            const active = new Set<number>();
            for (let i = start; i < end; i += 1) {
                active.add(i);
                const residual = w * (xs[i] ?? 0) + b - (ys[i] ?? 0);
                gradW += (2 * residual * (xs[i] ?? 0)) / (end - start);
                gradB += (2 * residual) / (end - start);
            }
            w -= learningRate * gradW;
            b -= learningRate * gradB;
            batchCounter += 1;
            yield {
                stepNumber: step,
                entities: makePoints(xs.slice(0, n), ys.slice(0, n), active, false),
                edges: [],
                description: `Epoch ${epoch}, batch [${start}, ${end}): gradient (${gradW.toFixed(3)}, ${gradB.toFixed(3)}); w=${w.toFixed(4)}, b=${b.toFixed(4)}.`,
                codeLineNumber: 3,
                layout: "point",
                meta: {
                    epoch,
                    batch: batchCounter,
                    w,
                    b,
                    loss: fullLoss(xs.slice(0, n), ys.slice(0, n), w, b),
                },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makePoints(xs.slice(0, n), ys.slice(0, n), new Set(), true),
        edges: [],
        description: `Finished with w=${w.toFixed(4)}, b=${b.toFixed(4)} and mean squared error ${fullLoss(xs.slice(0, n), ys.slice(0, n), w, b).toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: {
            epoch: epochs,
            batch: batchCounter,
            w,
            b,
            loss: fullLoss(xs.slice(0, n), ys.slice(0, n), w, b),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Gradient descent follows the slope of the loss function, but computing that slope over every example is expensive on large data sets. Mini-batch descent splits the examples into small groups and takes one step per group. The steps are noisier than a full-batch step, but they are cheaper and the noise often helps escape shallow regions.",
        invariants: [
            "Each update uses only the examples in the current consecutive batch.",
            "The gradient is the mean squared error derivative averaged over that batch.",
            "With a small enough learning rate the full-data loss does not increase on average.",
        ],
        correctness:
            "For the squared loss, the batch gradient is an unbiased estimate of the full gradient when batches are drawn uniformly, so its expectation is the true descent direction. In the consecutive-batch version used here every example is visited exactly once per epoch, and each individual step is the exact steepest-descent step for that batch's local objective.",
        complexityRationale:
            "One epoch touches each of the n examples once and performs constant work per example, costing O(n) time; over all epochs that is O(epochs * n). Only the point list and the two parameters are stored, so space is O(n).",
        uses: [
            "Training deep neural networks in standard frameworks",
            "Large-scale logistic and linear regression",
            "Any setting where a full pass over the data is too costly",
        ],
        references: [
            "Bottou, Large-Scale Machine Learning with Stochastic Gradient Descent, 2010",
            "Goodfellow, Bengio and Courville, Deep Learning, Chapter 8",
        ],
        workedExample:
            "Fit y = 2x + 1 on points x = 0 and 1 with batch size 2 and learning rate 0.05. Starting at w = b = 0, the residuals are -1 and -3, giving gradients gradW = (2*-1*0 + 2*-3*1)/2 = -3 and gradB = (-2 - 6)/2 = -4. The update moves to w = 0.15 and b = 0.2, a first step toward the true line.",
    },
    id: "mini-batch-gradient-descent",
    name: "Mini-Batch Gradient Descent",
    category: "ml-ai",
    complexity: { time: "O(epochs * n)", space: "O(n)" },
    defaultInput: {
        xs: [0, 1, 2, 3, 4, 5, 6, 7],
        ys: [1, 3, 5, 7, 9, 11, 13, 15],
        learningRate: 0.05,
        batchSize: 2,
        epochs: 12,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameters w and b to zero",
        "for each epoch from one to the epoch count",
        "split the examples into consecutive batches",
        "sum the squared-error gradient over the current batch",
        "average the gradient by the batch size",
        "move w and b opposite the gradient times the learning rate",
        "repeat until all batches and epochs are done",
        "done: report final parameters and mean squared error",
    ],
};

export default module;
