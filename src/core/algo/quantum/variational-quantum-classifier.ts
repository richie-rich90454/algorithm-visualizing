/**
 * variational-quantum-classifier.ts - Variational Quantum Classifier (One-Qubit Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A variational quantum classifier uses a parameterized quantum circuit as a
 * model and a classical loop to tune its parameters. Each feature is encoded
 * as a rotation angle, a trainable rotation is applied, and measuring the Pauli
 * Z observable gives a real-valued prediction whose sign is the class. The
 * classical optimizer adjusts the rotation using the parameter-shift rule,
 * which gives the exact derivative of a quantum expectation value with two
 * extra circuit evaluations.
 *
 * This is a deterministic one-qubit teaching model with a single trainable
 * rotation. It evaluates the analytic expectation exactly, so every number is
 * faithful for this tiny circuit, but it does NOT include data-encoding
 * repetition, entanglement, shot noise, barren-plateau studies, or hardware
 * execution. Only the parameter-shift training loop is real.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(epochs * n) prediction and parameter-shift evaluations
 *   Space: O(n) for the stored dataset and predictions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per training point shows its current expectation prediction.
 *   - Correctly classified points are green, mistakes are red.
 *   - meta carries the rotation angle, loss, accuracy, and gradient.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Exact Z expectation of RY(theta + x) acting on |0>. */
function expectation(theta: number, x: number): number {
    return Math.cos(theta + x);
}

/** Parameter-shift derivative of the Z expectation with respect to theta. */
function shiftedGradient(theta: number, x: number): number {
    const shift = Math.PI / 2;
    return 0.5 * (expectation(theta + shift, x) - expectation(theta - shift, x));
}

/** Build prediction bars for the current parameters. */
function makeBars(points: number[], labels: number[], theta: number): VisualEntity[] {
    return points.map((x, index) => {
        const prediction = expectation(theta, x);
        const correct = (prediction >= 0 ? 1 : -1) === labels[index];
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `x${index}=${x.toFixed(2)}:${prediction >= 0 ? "+" : "-"}`,
            value: prediction,
            state: (correct ? "sorted" : "error") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, feature: x, prediction, label: labels[index] ?? 0, correct },
        };
    });
}

/** The variational quantum classifier generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { points?: number[]; labels?: number[]; hiddenTheta?: number; theta0?: number; learningRate?: number; epochs?: number }
        | null
    ) ?? {};
    const points: number[] = Array.isArray(task.points) && task.points.length > 0
        ? task.points.map((v) => Number(v) || 0)
        : [0.1, 0.4, 0.7, 1.0, 1.3, 1.6, 1.9, 2.2, 2.5, 2.8];
    const hiddenTheta = typeof task.hiddenTheta === "number" ? task.hiddenTheta : 0;
    const labels: number[] = Array.isArray(task.labels) && task.labels.length === points.length
        ? task.labels.map((v) => (Number(v) >= 0 ? 1 : -1))
        : points.map((x) => (expectation(hiddenTheta, x) >= 0 ? 1 : -1));
    const theta0 = typeof task.theta0 === "number" ? task.theta0 : 1.2;
    const learningRate = typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.15;
    const epochs = Math.min(500, Math.max(1, Math.floor(Number(task.epochs ?? 30)) || 30));

    let theta = theta0;
    const lossAt = (angle: number) =>
        points.reduce((sum, x, i) => sum + (expectation(angle, x) - (labels[i] ?? 0)) ** 2, 0) / points.length;
    const accuracyAt = (angle: number) =>
        points.filter((x, i) => (expectation(angle, x) >= 0 ? 1 : -1) === labels[i]).length / points.length;
    const gradientAt = (angle: number) =>
        points.reduce((sum, x, i) => sum + 2 * (expectation(angle, x) - (labels[i] ?? 0)) * shiftedGradient(angle, x), 0) / points.length;

    const meta = (epoch: number, done: boolean) => ({
        n: points.length,
        epoch,
        theta,
        loss: lossAt(theta),
        accuracy: accuracyAt(theta),
        learningRate,
        hiddenTheta,
        done,
        note: "one-qubit variational classifier: exact Z expectation and parameter-shift training, no shot noise or hardware",
    });

    yield {
        stepNumber: 0,
        entities: makeBars(points, labels, theta),
        edges: [],
        description: `Training a one-qubit variational classifier with ${points.length} points from rotation ${theta.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, false),
    };
    let step = 1;

    for (let epoch = 0; epoch < epochs; epoch += 1) {
        const gradient = gradientAt(theta);
        theta -= learningRate * gradient;
        yield {
            stepNumber: step,
            entities: makeBars(points, labels, theta),
            edges: [],
            description: `Epoch ${epoch + 1}: parameter-shift gradient ${gradient.toFixed(4)}, rotation now ${theta.toFixed(4)}, loss ${lossAt(theta).toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: meta(epoch + 1, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(points, labels, theta),
        edges: [],
        description: `Trained rotation ${theta.toFixed(4)} gives accuracy ${(accuracyAt(theta) * 100).toFixed(0)} percent and loss ${lossAt(theta).toFixed(5)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: meta(epochs, true),
    };
}

/** The variational quantum classifier module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A variational classifier is a small quantum circuit whose rotation angles act as model weights. Data sets the input rotation, a trainable rotation produces a measurement outcome, and the sign of that outcome is the predicted class. A classical loop nudges the rotation to reduce a loss, and the parameter-shift rule supplies the exact gradient by evaluating the same circuit at two shifted angles, just as backpropagation supplies gradients in a neural network.",
        invariants: [
            "The Z expectation of RY(theta plus x) on the ground state is cosine of theta plus x.",
            "The parameter-shift rule gives the exact derivative as half the difference of the two shifted expectations.",
            "Each gradient step changes the rotation in the direction that lowers the squared loss locally.",
        ],
        correctness:
            "For the single-qubit circuit, measuring Z after RY(theta plus x) yields exactly cos(theta plus x), so the model's decision boundary is where that cosine changes sign. The parameter-shift identity holds for any expectation of the form cos(theta plus x) because the shifted cosines differ by exactly twice the negative sine, which is the derivative. Gradient descent on the mean squared loss therefore follows the true derivative and, for data generated by a single rotation, converges to a parameter that recovers the generating boundary and labels the training points correctly.",
        complexityRationale:
            "Each epoch evaluates the expectation on all n points once for the loss and twice per point through the shift rule, so the cost is O(epochs * n). Storing the dataset, labels, and predictions uses O(n) space.",
        uses: [
            "A teaching example of hybrid quantum-classical training",
            "Near-term quantum machine learning on noisy devices",
            "Understanding the parameter-shift rule for quantum gradients",
        ],
        references: [
            "Mitarai, Negoro, Kitagawa and Fujii, Quantum Circuit Learning, 2018",
            "Schuld, Sweke and Meyer, The Effect of Data Encoding on the Expressive Power of Variational Quantum Machine Learning Models, 2021",
        ],
        workedExample:
            "With ten feature angles from 0.1 to 2.8 and labels given by the sign of cosine of the feature, the ideal rotation is 0. Starting from 1.2, parameter-shift gradient descent moves the rotation toward 0 over a few dozen epochs, driving the loss toward zero and classifying every training point correctly.",
    },
    id: "variational-quantum-classifier",
    name: "Variational Quantum Classifier (One-Qubit Model)",
    category: "quantum",
    complexity: { time: "O(epochs * n)", space: "O(n)" },
    defaultInput: { hiddenTheta: 0, theta0: 1.2, learningRate: 0.15, epochs: 30 },
    visualType: "array",
    run,
    pseudocode: [
        "encode each feature as the angle of a data rotation",
        "apply a trainable rotation theta and measure the Z observable",
        "predict the class from the sign of the expectation cosine",
        "compute the loss as mean squared prediction error",
        "estimate each gradient with the two shifted circuits",
        "update theta by subtracting the learning rate times the gradient",
        "repeat for a fixed number of epochs",
        "done: report the trained rotation, accuracy, and loss",
    ],
};

export default module;
