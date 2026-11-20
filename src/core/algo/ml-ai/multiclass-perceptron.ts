/**
 * multiclass-perceptron.ts - Multiclass (One-Vs-All Style) Perceptron
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The multiclass perceptron keeps one weight vector and bias per class. For an
 * input it computes a score for every class and predicts the highest scoring
 * one. When the prediction is wrong, it nudges the true class's weights toward
 * the input and the predicted class's weights away from it. On linearly
 * separable data the updates eventually stop.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(epochs * n * C * d) for n points, C classes, d dimensions
 *   Space: O(C * d) for the class weight vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Points are colored by whether the current prediction is right.
 *   - Each point's label shows true class and predicted class.
 *   - meta carries the full weight matrix, biases, mistakes, and convergence.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

interface Input {
    points?: Point[];
    labels?: number[];
    classes?: number;
    epochs?: number;
}

function makePoints(
    points: Point[],
    labels: number[],
    predictions: number[],
    states: Map<number, EntityState>,
): VisualEntity[] {
    return points.map(([x, y], i) => ({
        id: `point-${i}`,
        type: "node" as const,
        label: `${labels[i] ?? 0}/${predictions[i] ?? 0}`,
        value: [x, y],
        state: states.get(i) ?? "unvisited",
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index: i, label: labels[i] ?? 0, prediction: predictions[i] ?? 0 },
    }));
}

/** The multiclass perceptron generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const points: Point[] = task.points ?? [
        [-0.1, 0.1],
        [0.2, -0.1],
        [3, 0.1],
        [2.8, 0.3],
        [0.1, 3],
        [-0.1, 2.8],
    ];
    const labels: number[] = task.labels ?? [0, 0, 1, 1, 2, 2];
    const classes = typeof task.classes === "number" ? task.classes : 3;
    const epochs = typeof task.epochs === "number" ? Math.max(1, task.epochs) : 15;
    const dim = points[0]?.length ?? 2;

    const weights: number[][] = Array.from({ length: classes }, () => new Array<number>(dim).fill(0));
    const biases = new Array<number>(classes).fill(0);
    const predictions = new Array<number>(points.length).fill(0);
    let mistakes = 0;
    let converged = false;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makePoints(points, labels, predictions, new Map()),
        edges: [],
        description: `Training a ${classes}-class perceptron on ${points.length} points for up to ${epochs} epochs.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { mistakes, converged, classes, weights: weights.flat(), biases },
    };
    step += 1;

    for (let epoch = 0; epoch < epochs && !converged; epoch += 1) {
        converged = true;
        for (let i = 0; i < points.length; i += 1) {
            const point = points[i];
            const trueLabel = labels[i];
            if (!point || trueLabel === undefined || trueLabel < 0 || trueLabel >= classes) {
                continue;
            }
            let best = 0;
            let bestScore = -Infinity;
            for (let c = 0; c < classes; c += 1) {
                let score = biases[c] ?? 0;
                for (let d = 0; d < dim; d += 1) {
                    score += (weights[c]?.[d] ?? 0) * (point[d] ?? 0);
                }
                if (score > bestScore) {
                    bestScore = score;
                    best = c;
                }
            }
            predictions[i] = best;
            const correct = best === trueLabel;
            if (!correct) {
                converged = false;
                mistakes += 1;
                const trueW = weights[trueLabel];
                const bestW = weights[best];
                if (trueW && bestW) {
                    for (let d = 0; d < dim; d += 1) {
                        trueW[d] = (trueW[d] ?? 0) + (point[d] ?? 0);
                        bestW[d] = (bestW[d] ?? 0) - (point[d] ?? 0);
                    }
                }
                biases[trueLabel] = (biases[trueLabel] ?? 0) + 1;
                biases[best] = (biases[best] ?? 0) - 1;
            }
            const states = new Map<number, EntityState>([[i, correct ? "sorted" : "swapped"]]);
            yield {
                stepNumber: step,
                entities: makePoints(points, labels, predictions, states),
                edges: [],
                description: `Epoch ${epoch + 1}, point ${i}: true ${trueLabel}, predicted ${best}${correct ? " - correct" : " - update both class vectors"}.`,
                codeLineNumber: correct ? 4 : 6,
                layout: "point",
                meta: {
                    epoch: epoch + 1,
                    mistakes,
                    converged,
                    classes,
                    weights: weights.flat(),
                    biases,
                    correct,
                },
            };
            step += 1;
        }
    }

    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < points.length; i += 1) {
        finalStates.set(i, converged ? "sorted" : "unvisited");
    }
    yield {
        stepNumber: step,
        entities: makePoints(points, labels, predictions, finalStates),
        edges: [],
        description: converged
            ? `Converged after ${mistakes} mistake(s) with ${classes} class weight vectors.`
            : `Stopped after ${epochs} epoch(s) without full convergence; ${mistakes} mistake(s).`,
        codeLineNumber: 9,
        layout: "point",
        meta: { mistakes, converged, classes, weights: weights.flat(), biases, epochs },
    };
}

/** The multiclass perceptron module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of one separator, imagine one scoring line per class. A new point goes to the class whose line scores it highest. After a mistake, reward the correct class's line for the point and penalize the line that won by mistake, so next time the right one is more likely to win.",
        invariants: [
            "Each class owns one weight vector and one bias, updated only when that class is involved in a mistake.",
            "Prediction is the class with the strictly largest score, breaking ties by the smallest class index.",
            "A mistake always increments the true class's weights and decrements the predicted class's weights by the input vector.",
        ],
        correctness:
            "When the classes are linearly separable in the multiclass sense, there exist class weight vectors that score every point highest for its true class. Each mistake increases the agreement with such a target set by a positive margin while growing the squared norm by a bounded amount, so only finitely many mistakes can occur before a clean pass ends training.",
        complexityRationale:
            "Scoring a point costs O(C * d) and training visits n points per epoch, giving O(epochs * n * C * d) time. The C weight vectors of length d occupy O(C * d) space.",
        uses: [
            "Multiclass text and document categorization",
            "Online classification where labels arrive incrementally",
            "A teaching bridge from binary perceptrons to softmax classifiers",
        ],
        references: [
            "Rosenblatt, The Perceptron: A Probabilistic Model, 1958",
            "Collins and Singer, Online Algorithms for Multiclass Problems with the Perceptron Update, 2002",
        ],
        workedExample:
            "With three point clusters near (0,0), (3,0), and (0,3), weights start at zero so the first point is assigned to class 0 on a tie. Each subsequent mistake adds the point to the true class's vector and subtracts it from the wrong class's vector; after a few passes every cluster is scored correctly.",
    },
    id: "multiclass-perceptron",
    name: "Multiclass Perceptron",
    category: "ml-ai",
    complexity: { time: "O(epochs * n * C * d)", space: "O(C * d)" },
    defaultInput: {
        points: [
            [-0.1, 0.1],
            [0.2, -0.1],
            [3, 0.1],
            [2.8, 0.3],
            [0.1, 3],
            [-0.1, 2.8],
        ],
        labels: [0, 0, 1, 1, 2, 2],
        classes: 3,
        epochs: 15,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize one zero weight vector and bias per class",
        "repeat for a fixed number of epochs",
        "for each training point with its true label",
        "compute each class score and predict the largest",
        "if the prediction equals the true label, continue",
        "add the point to the true class weight vector and one to its bias",
        "subtract the point from the predicted class vector and one from its bias",
        "stop early when a whole epoch makes no mistakes",
        "mark correctly classified points and finalize the vectors",
        "done: report the class weight vectors and mistake count",
    ],
};

export default module;
