/**
 * support-vector-machine-smooth.ts - Smooth-Margin Linear SVM by Gradient Descent
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A soft-margin linear SVM can be trained by minimizing an unconstrained
 * objective: one half of the squared weight norm plus a penalty for points
 * inside the margin. Using a squared hinge loss makes the objective smooth and
 * differentiable everywhere, so plain gradient descent works. This teaching
 * model trains a two-dimensional separator and exposes the analytic gradient
 * for a finite-difference check.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n * d) for n points in d dimensions
 *   Space: O(d) for the weight vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Training points are colored by their margin: outside (green), inside
 *     the margin (yellow), or misclassified (red).
 *   - meta carries the current gradient and loss for verification.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

interface Input {
    points?: Point[];
    labels?: number[];
    lr?: number;
    C?: number;
    iterations?: number;
}

const DEFAULT_POINTS: Point[] = [
    [1, 1],
    [1, 2],
    [2, 1],
    [2, 2],
    [-1, -1],
    [-1, -2],
    [-2, -1],
    [-2, -2],
];
const DEFAULT_LABELS = [1, 1, 1, 1, -1, -1, -1, -1];

function makePoints(points: Point[], labels: number[], w: number[], b: number): VisualEntity[] {
    return points.map(([x, y], i) => {
        const label = labels[i] ?? 1;
        const margin = label * ((w[0] ?? 0) * x + (w[1] ?? 0) * y + b);
        const state: EntityState = margin >= 1 ? "sorted" : margin > 0 ? "comparing" : "error";
        return {
            id: `point-${i}`,
            type: "node" as const,
            label: label > 0 ? "+" : "-",
            value: [x, y],
            state,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index: i, label, margin },
        };
    });
}

/** Objective value at (w, b). */
function lossAt(points: Point[], labels: number[], w: number[], b: number, C: number): number {
    let total = 0.5 * ((w[0] ?? 0) ** 2 + (w[1] ?? 0) ** 2);
    for (let i = 0; i < points.length; i += 1) {
        const p = points[i]!;
        const margin = (labels[i] ?? 1) * ((w[0] ?? 0) * p[0]! + (w[1] ?? 0) * p[1]! + b);
        const hinge = Math.max(0, 1 - margin);
        total += C * hinge * hinge;
    }
    return total;
}

/** Analytic gradient of the smooth objective at (w, b). */
function gradientAt(
    points: Point[],
    labels: number[],
    w: number[],
    b: number,
    C: number,
): { g0: number; g1: number; gb: number } {
    let g0 = w[0] ?? 0;
    let g1 = w[1] ?? 0;
    let gb = 0;
    for (let i = 0; i < points.length; i += 1) {
        const p = points[i]!;
        const label = labels[i] ?? 1;
        const margin = label * ((w[0] ?? 0) * p[0]! + (w[1] ?? 0) * p[1]! + b);
        if (margin < 1) {
            const factor = -2 * C * (1 - margin) * label;
            g0 += factor * p[0]!;
            g1 += factor * p[1]!;
            gb += factor;
        }
    }
    return { g0, g1, gb };
}

/** The smooth-margin SVM generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const points: Point[] = task.points ?? DEFAULT_POINTS;
    const labels: number[] = task.labels ?? DEFAULT_LABELS;
    const lr = typeof task.lr === "number" ? task.lr : 0.01;
    const C = typeof task.C === "number" ? task.C : 1;
    const iterations = typeof task.iterations === "number" ? Math.max(1, task.iterations) : 20;

    const w = [0, 0];
    let b = 0;
    let step = 0;
    let grad = gradientAt(points, labels, w, b, C);

    yield {
        stepNumber: step,
        entities: makePoints(points, labels, w, b),
        edges: [],
        description: `Training a smooth-margin linear SVM on ${points.length} points (lr ${lr}, C ${C}).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { w0: w[0], w1: w[1], b, loss: lossAt(points, labels, w, b, C), g0: grad.g0, g1: grad.g1, gb: grad.gb },
    };
    step += 1;

    for (let t = 0; t < iterations; t += 1) {
        grad = gradientAt(points, labels, w, b, C);
        const before = lossAt(points, labels, w, b, C);
        w[0] = (w[0] ?? 0) - lr * grad.g0;
        w[1] = (w[1] ?? 0) - lr * grad.g1;
        b -= lr * grad.gb;
        const after = lossAt(points, labels, w, b, C);
        const postGrad = gradientAt(points, labels, w, b, C);
        yield {
            stepNumber: step,
            entities: makePoints(points, labels, w, b),
            edges: [],
            description: `Iteration ${t + 1}: gradient (${grad.g0.toFixed(4)}, ${grad.g1.toFixed(4)}, ${grad.gb.toFixed(4)}), loss ${before.toFixed(4)} to ${after.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: {
                w0: w[0],
                w1: w[1],
                b,
                loss: after,
                g0: postGrad.g0,
                g1: postGrad.g1,
                gb: postGrad.gb,
                iteration: t + 1,
            },
        };
        step += 1;
    }

    let correct = 0;
    for (let i = 0; i < points.length; i += 1) {
        const p = points[i]!;
        if ((labels[i] ?? 1) * ((w[0] ?? 0) * p[0]! + (w[1] ?? 0) * p[1]! + b) > 0) {
            correct += 1;
        }
    }
    yield {
        stepNumber: step,
        entities: makePoints(points, labels, w, b),
        edges: [],
        description: `Trained separator w = (${w[0]!.toFixed(3)}, ${w[1]!.toFixed(3)}), b = ${b.toFixed(3)}; ${correct}/${points.length} points on the correct side.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { w0: w[0], w1: w[1], b, loss: lossAt(points, labels, w, b, C), correct, total: points.length },
    };
}

/** The smooth-margin SVM module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A support vector machine looks for a line that separates two classes with a wide margin. Instead of solving a constrained optimization directly, this version writes down a single smooth objective: keep the weights small but penalize any point that falls inside the margin. Gradient descent then walks downhill on that objective until the separator stabilizes.",
        invariants: [
            "The regularizer is one half of the squared weight norm, which pulls the separator toward smaller weights.",
            "A point contributes to the gradient only when its margin is below one, so points far from the boundary drop out.",
            "The gradient is the weight vector plus the summed contributions of all margin violations.",
        ],
        correctness:
            "Squaring the hinge loss makes the objective continuously differentiable, so the analytic gradient is defined everywhere. Differentiating the regularizer gives w, and differentiating each squared hinge term gives minus two times C times the hinge amount times the label and the point. Finite differences of the objective agree with this gradient, and taking a small step against it decreases the objective for a sufficiently small learning rate.",
        complexityRationale:
            "Each iteration evaluates the margin of every point once, costing O(n * d) time, so the full run is O(iterations * n * d). Only the d weights and the bias are stored, giving O(d) space.",
        uses: [
            "Binary text classification with a maximum-margin boundary",
            "A teaching introduction to regularization and hinge losses",
            "A smooth gateway to kernel methods and soft-margin SVMs",
        ],
        references: [
            "Cortes and Vapnik, Support-Vector Networks, 1995",
            "Lee and Mangasarian, SSVM: A Smooth Support Vector Machine, 2001",
        ],
        workedExample:
            "With points near (1,1) labeled plus and (-1,-1) labeled minus, the initial weights are zero so every margin is zero and all points are penalized. The first gradient pushes w toward the positive points; after repeated small steps the boundary settles near the line w0*x + w1*y = 0 with all points correctly classified.",
    },
    id: "support-vector-machine-smooth",
    name: "Smooth-Margin Support Vector Machine",
    category: "ml-ai",
    complexity: { time: "O(iterations * n * d)", space: "O(d)" },
    defaultInput: { points: DEFAULT_POINTS, labels: DEFAULT_LABELS, lr: 0.01, C: 1, iterations: 20 },
    visualType: "point",
    run,
    pseudocode: [
        "initialize the weight vector and bias to zero",
        "for each training iteration",
        "start the gradient with the current weight vector",
        "for every point whose margin is below one",
        "add its weighted label and coordinates to the gradient",
        "subtract the learning rate times the gradient from w and b",
        "record the new objective value and class margins",
        "done: report the learned separator and training accuracy",
    ],
};

export default module;
