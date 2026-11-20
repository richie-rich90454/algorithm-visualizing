/**
 * perceptron.ts - The Perceptron Learning Rule
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The perceptron is the simplest neural classifier. It computes a weighted sum
 * of the inputs plus a bias, predicts +1 when that score is nonnegative and
 * -1 otherwise, and nudges its weights toward the target after every mistake.
 * On linearly separable data the updates stop after a finite number of errors.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(epochs * n * d) for n points in d dimensions
 *   Space: O(d) for the weight vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Training points are plotted at their coordinates.
 *   - A correctly classified point is GREEN; a mistake is RED.
 *   - The final frame is GREEN when training converged.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

/** Build the training-point entities with per-point states. */
function makePoints(
    points: Point[],
    labels: number[],
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return points.map(([x, y], index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: (labels[index] ?? 0) > 0 ? "+" : "-",
        value: [x, y],
        state: states.get(index) ?? "unvisited",
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index, label: labels[index] ?? 0 },
    }));
}

/** Train a two-dimensional perceptron, emitting one frame per decision. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[]; labels?: number[]; epochs?: number } | null) ?? {};
    const points: Point[] = task.points ?? [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
    ];
    const labels: number[] = task.labels ?? [-1, 1, 1, 1];
    const epochs = typeof task.epochs === "number" ? Math.max(1, task.epochs) : 10;

    let w0 = 0;
    let w1 = 0;
    let bias = 0;
    let mistakes = 0;
    let converged = false;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makePoints(points, labels),
        edges: [],
        description: `Training a perceptron on ${points.length} points for up to ${epochs} epoch(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epoch: 0, mistakes, w0, w1, bias },
    };
    step += 1;

    for (let epoch = 0; epoch < epochs && !converged; epoch += 1) {
        converged = true;
        for (let i = 0; i < points.length; i += 1) {
            const point = points[i];
            const target = labels[i];
            if (!point || target === undefined) {
                continue;
            }
            const score = w0 * point[0] + w1 * point[1] + bias;
            const predicted = score >= 0 ? 1 : -1;
            const correct = predicted === target;
            if (!correct) {
                converged = false;
                mistakes += 1;
                w0 += target * point[0];
                w1 += target * point[1];
                bias += target;
            }
            const states = new Map<number, EntityState>([[i, correct ? "sorted" : "swapped"]]);
            yield {
                stepNumber: step,
                entities: makePoints(points, labels, states),
                edges: [],
                description: `Epoch ${epoch + 1}, point ${i}: score ${score}, predicted ${predicted}, target ${target}${correct ? " - correct" : " - update weights"}.`,
                codeLineNumber: correct ? 3 : 6,
                layout: "point",
                meta: { epoch: epoch + 1, mistakes, w0, w1, bias, correct },
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
        entities: makePoints(points, labels, finalStates),
        edges: [],
        description: converged
            ? `Converged after ${mistakes} update(s); weights (${w0}, ${w1}), bias ${bias}.`
            : `Stopped after ${epochs} epoch(s) without full convergence; ${mistakes} update(s).`,
        codeLineNumber: 8,
        layout: "point",
        meta: { converged, mistakes, w0, w1, bias, epochs },
    };
}

/** The perceptron module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Treat each input point as a vector and draw a line through the origin by adjusting its weights. When the line puts a point on the wrong side, move it in the direction of the correct label. Repeat until a full pass makes no mistakes.",
        invariants: [
            "The score is the dot product of the weights with the point plus the bias.",
            "A prediction is +1 when the score is nonnegative and -1 otherwise.",
            "Each mistake moves the weight vector toward the target label by the input vector.",
        ],
        correctness:
            "For linearly separable data there is a weight vector with a positive margin on every point. Each mistake increases the dot product with that separating vector by at least the margin, while the squared norm of the weights grows by at most a bounded amount, so the number of mistakes is finite.",
        complexityRationale:
            "Each of the epochs visits n points and updates d weights, giving O(epochs * n * d) time; only the d weights and bias are stored, so space is O(d).",
        uses: [
            "Binary text classification with bag-of-words features",
            "Online learning where examples arrive one at a time",
            "A teaching model for the foundations of neural networks",
        ],
        references: [
            "Rosenblatt, The Perceptron: A Probabilistic Model, 1958",
            "Novikoff, On Convergence Proofs on Perceptrons, 1962",
        ],
        workedExample:
            "On the OR points (0,0), (0,1), (1,0), (1,1) with labels -1, +1, +1, +1, the first point is a mistake and sets the bias to -1, the second adds the weight (0,1), and the remaining points are correct. Epoch two makes no updates, so training converges.",
    },
    id: "perceptron",
    name: "Perceptron",
    category: "ml-ai",
    complexity: { time: "O(epochs * n * d)", space: "O(d)" },
    defaultInput: {
        points: [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
        ],
        labels: [-1, 1, 1, 1],
        epochs: 10,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize weights and bias to zero",
        "repeat for a fixed number of epochs",
        "for each training point compute score w dot x plus bias",
        "predict plus one when score is nonnegative, minus one otherwise",
        "compare the prediction with the target label",
        "on a mistake add target times the point to the weights",
        "also add the target to the bias",
        "stop early when a whole epoch makes no mistakes",
        "done: report final weights, bias, and convergence",
    ],
};

export default module;
