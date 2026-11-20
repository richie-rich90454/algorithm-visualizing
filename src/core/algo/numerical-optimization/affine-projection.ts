/**
 * affine-projection.ts - Affine Projection Adaptive Filter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The affine projection algorithm is an adaptive filter that reuses the last P
 * input vectors at every update. Instead of minimizing the error on one sample
 * as LMS does, it minimizes the summed error on a small affine subspace of the
 * last P samples. This gives much faster convergence than LMS for correlated
 * inputs at a modest extra cost: inverting a P by P matrix.
 *
 * The simulation identifies a known finite-impulse-response system from a
 * deterministic input signal, so the learned weights can be checked against
 * the true system.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * (L P + P^3)) for L filter taps and P projections
 *   Space: O(L + P^2) for the weight vector and the small matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current estimate of each filter tap.
 *   - The tap with the largest change is highlighted yellow.
 *   - meta carries the weights, output error, and true tap values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AffineInput {
    trueWeights?: number[];
    order?: number;
    projections?: number;
    stepSize?: number;
    regularization?: number;
    iterations?: number;
}

/** Invert a small square matrix by Gauss-Jordan elimination. */
function invert(matrix: number[][]): number[][] | null {
    const size = matrix.length;
    const augmented = matrix.map((row, index) => [
        ...row,
        ...Array.from({ length: size }, (_, col) => (col === index ? 1 : 0)),
    ]);
    for (let pivot = 0; pivot < size; pivot += 1) {
        let best = pivot;
        for (let row = pivot + 1; row < size; row += 1) {
            if (Math.abs(augmented[row]?.[pivot] ?? 0) > Math.abs(augmented[best]?.[pivot] ?? 0)) {
                best = row;
            }
        }
        if (Math.abs(augmented[best]?.[pivot] ?? 0) < 1e-12) {
            return null;
        }
        const swap = augmented[pivot]!;
        augmented[pivot] = augmented[best]!;
        augmented[best] = swap;
        const divisor = augmented[pivot]![pivot] ?? 1;
        for (let col = 0; col < size * 2; col += 1) {
            augmented[pivot]![col] = (augmented[pivot]![col] ?? 0) / divisor;
        }
        for (let row = 0; row < size; row += 1) {
            if (row === pivot) {
                continue;
            }
            const factor = augmented[row]![pivot] ?? 0;
            for (let col = 0; col < size * 2; col += 1) {
                augmented[row]![col] = (augmented[row]![col] ?? 0) - factor * (augmented[pivot]![col] ?? 0);
            }
        }
    }
    return augmented.map((row) => row.slice(size));
}

function makeBars(weights: number[], active: number, done: boolean): VisualEntity[] {
    return weights.map((value, index) => {
        const state: EntityState = done ? "sorted" : index === active ? "active" : "visited";
        return {
            id: `tap-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, tap: index, weight: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AffineInput | null) ?? {};
    const trueWeights: number[] = Array.isArray(task.trueWeights) && task.trueWeights.length > 0
        ? task.trueWeights.map((value) => Number(value) || 0)
        : [0.5, -0.3, 0.8];
    const order = Math.min(8, Math.max(1, Math.floor(Number(task.order ?? trueWeights.length)) || trueWeights.length));
    const weightsTrue = Array.from({ length: order }, (_, index) => trueWeights[index] ?? 0);
    const projections = Math.min(order, Math.max(1, Math.floor(Number(task.projections ?? 2)) || 2));
    const stepSize = Math.max(0.01, Math.min(1, Number(task.stepSize ?? 0.3) || 0.3));
    const regularization = Math.max(1e-6, Number(task.regularization ?? 0.01) || 0.01);
    const iterations = Math.min(400, Math.max(1, Math.floor(Number(task.iterations ?? 80)) || 80));

    const signal: number[] = [];
    const desired: number[] = [];
    for (let index = 0; index < iterations + order + projections + 2; index += 1) {
        const value = Math.sin(0.31 * index) + 0.5 * Math.cos(0.73 * index);
        signal.push(value);
    }
    for (let index = 0; index < signal.length; index += 1) {
        let value = 0;
        for (let tap = 0; tap < order; tap += 1) {
            value += (weightsTrue[tap] ?? 0) * (signal[index - tap] ?? 0);
        }
        desired.push(value + 0.0005 * Math.sin(1.7 * index));
    }

    const weights: number[] = Array.from({ length: order }, () => 0);
    let step = 0;

    const outputErrorAt = (current: number[], index: number) => {
        let predicted = 0;
        for (let tap = 0; tap < order; tap += 1) {
            predicted += (current[tap] ?? 0) * (signal[index - tap] ?? 0);
        }
        return (desired[index] ?? 0) - predicted;
    };

    yield {
        stepNumber: step,
        entities: makeBars(weights, -1, false),
        edges: [],
        description: `Identifying a ${order}-tap system with ${projections} affine projections per update.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { order, projections, weights: [...weights], trueWeights: weightsTrue, error: 0, iteration: 0, done: false },
    };
    step += 1;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const columns: number[][] = [];
        const targets: number[] = [];
        for (let projection = 0; projection < projections; projection += 1) {
            const sample = iteration + projections - 1 - projection + order;
            columns.push(Array.from({ length: order }, (_, tap) => signal[sample - tap] ?? 0));
            targets.push(desired[sample] ?? 0);
        }
        // X is order by projections; compute X^T X plus delta I and X^T (d - X^T w).
        const gram: number[][] = Array.from({ length: projections }, () => Array.from({ length: projections }, () => 0));
        const cross: number[] = Array.from({ length: projections }, () => 0);
        for (let p = 0; p < projections; p += 1) {
            for (let q = 0; q < projections; q += 1) {
                let sum = 0;
                for (let tap = 0; tap < order; tap += 1) {
                    sum += (columns[p]?.[tap] ?? 0) * (columns[q]?.[tap] ?? 0);
                }
                gram[p]![q] = sum + (p === q ? regularization : 0);
            }
            let currentPrediction = 0;
            for (let tap = 0; tap < order; tap += 1) {
                currentPrediction += (weights[tap] ?? 0) * (columns[p]?.[tap] ?? 0);
            }
            cross[p] = (targets[p] ?? 0) - currentPrediction;
        }
        const inverse = invert(gram);
        if (inverse === null) {
            yield {
                stepNumber: step,
                entities: makeBars(weights, -1, false),
                edges: [],
                description: "The regularized correlation matrix is singular, so the update is skipped.",
                codeLineNumber: 4,
                layout: "array",
                meta: { order, projections, weights: [...weights], trueWeights: weightsTrue, error: 0, iteration: iteration + 1, singular: true, done: false },
            };
            return;
        }
        const coefficients: number[] = Array.from({ length: projections }, (_, p) => {
            let sum = 0;
            for (let q = 0; q < projections; q += 1) {
                sum += (inverse[p]?.[q] ?? 0) * (cross[q] ?? 0);
            }
            return stepSize * sum;
        });
        let largestChange = 0;
        for (let tap = 0; tap < order; tap += 1) {
            let update = 0;
            for (let p = 0; p < projections; p += 1) {
                update += (columns[p]?.[tap] ?? 0) * (coefficients[p] ?? 0);
            }
            const previous = weights[tap] ?? 0;
            weights[tap] = previous + update;
            if (Math.abs(update) > Math.abs(largestChange)) {
                largestChange = update;
            }
        }
        const error = outputErrorAt(weights, iteration + order + projections);
        yield {
            stepNumber: step,
            entities: makeBars(weights, -1, false),
            edges: [],
            description: `Update ${iteration + 1}: output error ${error.toExponential(2)}; weights [${weights.map((value) => value.toFixed(3)).join(", ")}].`,
            codeLineNumber: iteration === 0 ? 2 : 6,
            layout: "array",
            meta: { order, projections, weights: [...weights], trueWeights: weightsTrue, error, iteration: iteration + 1, done: false },
        };
        step += 1;
    }

    const finalError = outputErrorAt(weights, iterations + order + projections - 1);
    yield {
        stepNumber: step,
        entities: makeBars(weights, -1, true),
        edges: [],
        description: `Learned weights [${weights.map((value) => value.toFixed(4)).join(", ")}] versus true weights [${weightsTrue.map((value) => value.toFixed(4)).join(", ")}].`,
        codeLineNumber: 7,
        layout: "array",
        meta: { order, projections, weights, trueWeights: weightsTrue, error: finalError, iteration: iterations, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "LMS corrects a filter using only the most recent sample, so correlated inputs make it wander. Affine projection keeps the last several input vectors and finds the weight change that fits all of them at once, like taking several gradient steps along a small subspace. The result is much faster convergence for a small extra matrix inversion.",
        invariants: [
            "The correlation matrix is positive definite because of the diagonal regularization term.",
            "Each update minimizes the summed squared error over the last P samples.",
            "The desired signal is generated from the true weights plus a tiny deterministic perturbation.",
        ],
        correctness:
            "With X the matrix of recent input vectors and d the matching desired responses, the affine projection update is the minimum-norm solution of minimizing the squared norm of d minus X transpose w. Setting the gradient to zero gives the normal equations (X X transpose plus delta I) times the gain equals the error vector, and the regularized matrix is invertible, so the derived step is exact for that subproblem. Repeated exact subproblem minimization converges to the system that generated the data, which is why the learned taps approach the true taps.",
        complexityRationale:
            "Each iteration builds an order by projections correlation matrix, inverts a projections by projections matrix, and applies the gain, costing O(order*projections + projections cubed). The state is the order-length weight vector and the small matrices, which is O(order + projections squared) space.",
        uses: [
            "System identification in adaptive signal processing",
            "Acoustic echo cancellation for hands-free communication",
            "Channel equalization in digital receivers",
        ],
        references: [
            "Ozeki and Umeda, An Adaptive Filtering Algorithm Using an Orthogonal Projection to an Affine Subspace, 1984",
            "Haykin, Adaptive Filter Theory, 5th edition, chapter on affine projection",
        ],
        workedExample:
            "A three-tap filter tries to match the system [0.5, -0.3, 0.8]. With two projections and a step size of 0.3, the first update uses two consecutive input vectors and drives the weights away from zero; after dozens of updates the learned taps settle close to the true taps and the output error becomes small.",
    },
    id: "affine-projection",
    name: "Affine Projection Filter",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * (L P + P^3))", space: "O(L + P^2)" },
    defaultInput: {
        trueWeights: [0.5, -0.3, 0.8],
        order: 3,
        projections: 2,
        stepSize: 0.5,
        regularization: 0.001,
        iterations: 250,
    },
    visualType: "array",
    run,
    pseudocode: [
        "generate a deterministic input and desired response from the true system",
        "initialize the weight vector to zero",
        "collect the last P input vectors into a matrix X",
        "form the regularized correlation matrix X X transpose plus delta I",
        "solve for the gain using the recent output errors",
        "add X times the gain to the weight vector",
        "repeat until the iteration budget is exhausted",
        "done: report the learned weights and output error",
    ],
};

export default module;
