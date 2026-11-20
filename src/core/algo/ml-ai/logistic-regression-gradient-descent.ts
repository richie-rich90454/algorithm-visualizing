/**
 * logistic-regression-gradient-descent.ts - Logistic Regression by Gradient Descent
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Logistic regression models the probability of class 1 with a sigmoid of a
 * linear score. Batch gradient descent minimizes the average binary
 * cross-entropy: each step nudges the weights against the average of
 * (predicted probability minus true label) times the feature.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(epochs * n * d) for n points in d dimensions (here d = 2)
 *   Space: O(n) for the example entities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each training point is plotted at (x0, x1).
 *   - A point is green when the current model classifies it correctly and red
 *     when it is wrong, so the decision boundary improves visibly over epochs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

/** Sigmoid with a guarded exponent so extreme scores stay finite. */
function sigmoid(z: number): number {
    if (z >= 0) {
        return 1 / (1 + Math.exp(-z));
    }
    const e = Math.exp(z);
    return e / (1 + e);
}

/** Build the labeled point cloud colored by the current model's decisions. */
function makeEntities(points: Point[], labels: number[], w0: number, w1: number, b: number): VisualEntity[] {
    return points.map(([x0, x1], index) => {
        const predicted = sigmoid(w0 * x0 + w1 * x1 + b) >= 0.5 ? 1 : 0;
        const correct = predicted === (labels[index] ?? 0);
        return {
            id: `point-${index}`,
            type: "node" as const,
            label: String(labels[index] ?? 0),
            value: [x0, x1],
            state: (correct ? "sorted" : "error") as EntityState,
            x: x0,
            y: x1,
            width: 0,
            height: 0,
            metadata: { index, x0, x1, label: labels[index] ?? 0, predicted },
        };
    });
}

/** Average binary cross-entropy over the data set. */
function crossEntropy(points: Point[], labels: number[], w0: number, w1: number, b: number): number {
    if (points.length === 0) {
        return 0;
    }
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
        const point = points[i] ?? [0, 0];
        const p = sigmoid(w0 * point[0] + w1 * point[1] + b);
        const y = labels[i] ?? 0;
        sum += -(y * Math.log(p + 1e-15) + (1 - y) * Math.log(1 - p + 1e-15));
    }
    return sum / points.length;
}

/** The logistic regression gradient descent generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { points?: Point[]; labels?: number[]; epochs?: number; learningRate?: number } | null
    ) ?? {};
    const points: Point[] = task.points ?? [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
        [2, 1],
        [2, 2],
    ];
    const labels: number[] = task.labels ?? [0, 0, 0, 1, 1, 1];
    const epochs = typeof task.epochs === "number" ? Math.max(1, task.epochs) : 60;
    const rate = typeof task.learningRate === "number" ? task.learningRate : 0.5;

    let w0 = 0;
    let w1 = 0;
    let b = 0;
    const n = Math.max(1, points.length);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(points, labels, w0, w1, b),
        edges: [],
        description: `Fitting logistic regression on ${points.length} points with learning rate ${rate} for ${epochs} epoch(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, w0, w1, b, loss: crossEntropy(points, labels, w0, w1, b), accuracy: 0 },
    };
    step += 1;

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        let g0 = 0;
        let g1 = 0;
        let gb = 0;
        for (let i = 0; i < points.length; i += 1) {
            const point = points[i] ?? [0, 0];
            const p = sigmoid(w0 * point[0] + w1 * point[1] + b);
            const diff = p - (labels[i] ?? 0);
            g0 += diff * point[0];
            g1 += diff * point[1];
            gb += diff;
        }
        w0 -= (rate * g0) / n;
        w1 -= (rate * g1) / n;
        b -= (rate * gb) / n;

        let correct = 0;
        for (let i = 0; i < points.length; i += 1) {
            const point = points[i] ?? [0, 0];
            const predicted = sigmoid(w0 * point[0] + w1 * point[1] + b) >= 0.5 ? 1 : 0;
            if (predicted === (labels[i] ?? 0)) {
                correct += 1;
            }
        }
        const accuracy = points.length > 0 ? correct / points.length : 0;
        yield {
            stepNumber: step,
            entities: makeEntities(points, labels, w0, w1, b),
            edges: [],
            description: `Epoch ${epoch}: loss ${crossEntropy(points, labels, w0, w1, b).toFixed(4)}, training accuracy ${(accuracy * 100).toFixed(0)}%.`,
            codeLineNumber: 5,
            layout: "point",
            meta: { epoch, w0, w1, b, loss: crossEntropy(points, labels, w0, w1, b), accuracy },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, labels, w0, w1, b),
        edges: [],
        description: `Done: decision boundary w0*x0 + w1*x1 + b = 0 with final loss ${crossEntropy(points, labels, w0, w1, b).toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { epoch: epochs, w0, w1, b, loss: crossEntropy(points, labels, w0, w1, b), converged: true },
    };
}

/** The logistic regression module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A straight line cannot output probabilities, so squash its score through the sigmoid function to get a number between zero and one. Gradient descent then lowers the cross-entropy: predictions that are confidently wrong are punished heavily, pushing the weights toward a sensible separating line.",
        invariants: [
            "The predicted probability is the sigmoid of w0*x0 + w1*x1 + b.",
            "The gradient of the average cross-entropy is the average of (prediction minus label) times each feature.",
            "A prediction of class 1 is made when the probability is at least one half.",
        ],
        correctness:
            "The binary cross-entropy is convex in the weights, and its gradient is exactly the average residual times the features. Gradient descent with a small enough step on a convex function converges to the global optimum, which is the maximum-likelihood separating boundary for linearly separable data.",
        complexityRationale:
            "Each epoch scans all n points and updates d = 2 weights, so time is O(epochs * n * d). Only the n point entities and three parameters are stored, giving O(n) space.",
        uses: [
            "Binary classification such as spam or fraud detection",
            "Risk scoring where a calibrated probability is needed",
            "A baseline model before trying more complex classifiers",
        ],
        references: [
            "Nelder and Wedderburn, Generalized Linear Models, 1972",
            "Hosmer and Lemeshow, Applied Logistic Regression, 2000",
        ],
        workedExample:
            "On six points with class 1 in the upper right, the initial model predicts 0.5 everywhere. The first gradient step pushes w0 and w1 positive because the class 1 points have larger features, tilting the boundary so that the upper-right points cross the 0.5 threshold and turn green.",
    },
    id: "logistic-regression-gradient-descent",
    name: "Logistic Regression (Gradient Descent)",
    category: "ml-ai",
    complexity: { time: "O(epochs * n * d)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
            [2, 1],
            [2, 2],
        ],
        labels: [0, 0, 0, 1, 1, 1],
        epochs: 60,
        learningRate: 0.5,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize weights w0, w1 and bias b to zero",
        "for each epoch",
        "zero the gradient accumulators",
        "for each point compute sigmoid of the linear score",
        "add prediction minus label times each feature to the gradients",
        "subtract learning rate times averaged gradient from each parameter",
        "measure accuracy at the decision threshold one half",
        "done: report the fitted boundary and its loss",
    ],
};

export default module;
