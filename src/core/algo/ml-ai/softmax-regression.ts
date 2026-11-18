/**
 * softmax-regression.ts - Multiclass Softmax Regression
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Softmax regression generalizes logistic regression to more than two classes.
 * Each class owns a weight vector and bias; the scores are turned into a
 * probability distribution with the softmax function, and gradient descent on
 * the cross-entropy loss pushes the correct class probability toward one.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(epochs * n * c * d) for n points, c classes, d dimensions
 *   Space: O(c * d) for the weight matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Training points are plotted and colored by whether they are classified
 *     correctly at the current step.
 *   - Meta exposes the class probabilities of the first point.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A training point: two coordinates and an integer class label. */
type Sample = [number, number, number];

interface Model {
    w: number[][];
    b: number[];
}

/** Numerically stable softmax of a score vector. */
function softmax(scores: number[]): number[] {
    const max = Math.max(...scores);
    const exps = scores.map((score) => Math.exp(score - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    return exps.map((value) => value / total);
}

function predict(model: Model, x: number, y: number): { probs: number[]; label: number } {
    const scores = model.w.map((row, k) => row[0]! * x + row[1]! * y + model.b[k]!);
    const probs = softmax(scores);
    let label = 0;
    for (let k = 1; k < probs.length; k += 1) {
        if ((probs[k] ?? 0) > (probs[label] ?? 0)) {
            label = k;
        }
    }
    return { probs, label };
}

/** Cross-entropy loss and the gradient of the weight matrix and biases. */
function lossAndGradient(samples: Sample[], model: Model, classCount: number) {
    let loss = 0;
    const gw = model.w.map((row) => row.map(() => 0));
    const gb = model.b.map(() => 0);
    for (const [x, y, label] of samples) {
        const { probs } = predict(model, x, y);
        loss -= Math.log(Math.max(1e-15, probs[label] ?? 1e-15));
        for (let k = 0; k < classCount; k += 1) {
            const factor = (probs[k] ?? 0) - (k === label ? 1 : 0);
            const row = gw[k];
            if (row) {
                row[0] = (row[0] ?? 0) + factor * x;
                row[1] = (row[1] ?? 0) + factor * y;
            }
            gb[k] = (gb[k] ?? 0) + factor;
        }
    }
    const n = Math.max(1, samples.length);
    return { loss: loss / n, gw: gw.map((row) => row.map((v) => v / n)), gb: gb.map((v) => v / n) };
}

function makeEntities(samples: Sample[], model: Model): VisualEntity[] {
    return samples.map(([x, y, label], index) => {
        const { label: predicted } = predict(model, x, y);
        return {
            id: `sample-${index}`,
            type: "node" as const,
            label: `${label}`,
            value: [x, y, label],
            state: (predicted === label ? "sorted" : "unvisited") as EntityState,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index, trueLabel: label, predicted },
        };
    });
}

/** The softmax regression generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { samples?: Sample[]; learningRate?: number; epochs?: number; classCount?: number } | null
    ) ?? {};
    const samples: Sample[] = task.samples ?? [
        [0, 0, 0],
        [0.5, 0.2, 0],
        [0.2, 0.6, 0],
        [3, 3, 1],
        [3.4, 2.8, 1],
        [2.8, 3.3, 1],
        [0, 4, 2],
        [0.4, 4.2, 2],
        [0.3, 3.6, 2],
    ];
    const maxLabel = samples.reduce((max, sample) => Math.max(max, sample[2]), 0);
    const classCount =
        typeof task.classCount === "number" && task.classCount >= 2
            ? Math.floor(task.classCount)
            : maxLabel + 1;
    const learningRate =
        typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.1;
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.floor(task.epochs)) : 60;

    const model: Model = {
        w: Array.from({ length: classCount }, () => [0, 0]),
        b: Array.from({ length: classCount }, () => 0),
    };

    let loss = lossAndGradient(samples, model, classCount).loss;
    const startLoss = loss;
    let step = 0;

    const firstProbs = samples.length > 0 ? predict(model, samples[0]![0], samples[0]![1]).probs : [];
    yield {
        stepNumber: step,
        entities: makeEntities(samples, model),
        edges: [],
        description: `Softmax regression on ${samples.length} points with ${classCount} classes, starting loss ${loss.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, loss, accuracy: 0, classCount, probabilities: firstProbs },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const { gw, gb } = lossAndGradient(samples, model, classCount);
        for (let k = 0; k < classCount; k += 1) {
            const row = model.w[k];
            if (row) {
                row[0] = (row[0] ?? 0) - learningRate * (gw[k]?.[0] ?? 0);
                row[1] = (row[1] ?? 0) - learningRate * (gw[k]?.[1] ?? 0);
            }
            model.b[k] = (model.b[k] ?? 0) - learningRate * (gb[k] ?? 0);
        }
        const current = lossAndGradient(samples, model, classCount);
        loss = current.loss;
        let correct = 0;
        for (const [x, y, label] of samples) {
            if (predict(model, x, y).label === label) {
                correct += 1;
            }
        }
        const accuracy = samples.length > 0 ? correct / samples.length : 0;
        const probabilities =
            samples.length > 0 ? predict(model, samples[0]![0], samples[0]![1]).probs : [];
        yield {
            stepNumber: step,
            entities: makeEntities(samples, model),
            edges: [],
            description: `Epoch ${epoch}: cross-entropy loss ${loss.toFixed(4)}, training accuracy ${(accuracy * 100).toFixed(0)}%.`,
            codeLineNumber: 3,
            layout: "point",
            meta: {
                epoch,
                loss,
                accuracy,
                classCount,
                probabilities: probabilities.map((value) => Number(value.toFixed(6))),
            },
        };
        step += 1;
    }

    const probabilities =
        samples.length > 0 ? predict(model, samples[0]![0], samples[0]![1]).probs : [];
    yield {
        stepNumber: step,
        entities: makeEntities(samples, model),
        edges: [],
        description: `Trained ${classCount}-class softmax regression; final loss ${loss.toFixed(4)} from a start of ${startLoss.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: {
            converged: loss < startLoss,
            loss,
            startLoss,
            classCount,
            probabilities: probabilities.map((value) => Number(value.toFixed(6))),
        },
    };
}

/** The softmax regression module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Give every class its own linear score, then convert the scores into probabilities that add to one by exponentiating and normalizing. Training nudges the scores so the true class gets the largest probability. Softmax regression is what a single linear layer followed by a softmax produces.",
        invariants: [
            "The class probabilities are nonnegative and sum to one at every point.",
            "The gradient for class k at a point is the probability of k minus its one-hot target, times the input.",
            "Every update subtracts the learning rate times the mean gradient from each weight.",
        ],
        correctness:
            "Cross-entropy with a softmax has a gradient equal to predicted minus target, which is the difference between what the model believes and the truth. Following the negative of that gradient decreases the convex cross-entropy objective, so with a suitable learning rate training converges to the maximum-likelihood linear classifier.",
        complexityRationale:
            "Each epoch computes scores and gradients for n points across c classes and d features, costing O(epochs * n * c * d). The stored weight matrix and biases take O(c * d) space.",
        uses: [
            "The final layer of multiclass neural network classifiers",
            "Document and image categorization baselines",
            "Any mutually exclusive classification with more than two labels",
        ],
        references: [
            "Bishop, Pattern Recognition and Machine Learning, Chapter 4, 2006",
            "Goodfellow, Bengio, and Courville, Deep Learning, Chapter 6, 2016",
        ],
        workedExample:
            "With three clusters near (0,0), (3,3), and (0,4), the initial model predicts uniformly at one third each. After repeated softmax updates, points in the first cluster get a probability near one for class zero, and the cross-entropy loss falls toward zero.",
    },
    id: "softmax-regression",
    name: "Softmax Regression",
    category: "ml-ai",
    complexity: { time: "O(epochs * n * c * d)", space: "O(c * d)" },
    defaultInput: {
        samples: [
            [0, 0, 0],
            [0.5, 0.2, 0],
            [0.2, 0.6, 0],
            [3, 3, 1],
            [3.4, 2.8, 1],
            [2.8, 3.3, 1],
            [0, 4, 2],
            [0.4, 4.2, 2],
            [0.3, 3.6, 2],
        ],
        learningRate: 0.1,
        epochs: 60,
        classCount: 3,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize each class weight vector and bias to zero",
        "repeat for a fixed number of epochs",
        "compute each class score as the dot product plus bias",
        "apply softmax to obtain class probabilities",
        "accumulate probability minus one-hot target times the input",
        "subtract learning rate times the mean gradient from each weight",
        "done: report the final loss and predicted labels",
    ],
};

export default module;
