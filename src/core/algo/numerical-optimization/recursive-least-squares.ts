/**
 * recursive-least-squares.ts - Recursive Least Squares Adaptive Filter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Recursive least squares adapts a finite impulse response filter so that its
 * output tracks a desired signal. Instead of storing the whole data history, it
 * maintains an inverse correlation matrix P and updates the weight vector once
 * per sample using a gain vector. With a forgetting factor of one and enough
 * data, the weights converge to the ordinary least squares solution of the
 * accumulated regression problem.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(samples * order^2) for the rank-one matrix update
 *   Space: O(order^2) for the inverse correlation matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current filter weights, one per tap.
 *   - The most recently adapted weight vector is yellow, the final one green.
 *   - meta carries the prediction error, sample index, and mean squared error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function dot(left: number[], right: number[]): number {
    return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function makeBars(vector: number[], state: EntityState): VisualEntity[] {
    return vector.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, tap: index },
    }));
}

/** Adapt an FIR filter with the recursive least squares recursion. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { order?: number; lambda?: number; delta?: number; inputs?: number[]; desired?: number[] } | null) ?? {};
    const order = typeof task.order === "number" ? Math.max(1, Math.floor(task.order)) : 2;
    const lambda = typeof task.lambda === "number" && task.lambda > 0 && task.lambda <= 1 ? task.lambda : 1;
    const delta = typeof task.delta === "number" && task.delta > 0 ? task.delta : 1e-4;

    let inputs: number[] = Array.isArray(task.inputs) ? [...task.inputs] : [];
    let desired: number[] = Array.isArray(task.desired) ? [...task.desired] : [];
    if (inputs.length === 0 || desired.length === 0) {
        let state = 12345;
        const raw = Array.from({ length: 60 }, () => {
            state = (1103515245 * state + 12345) % 2147483647;
            return state / 2147483647 - 0.5;
        });
        inputs = raw;
        desired = raw.map((_, index) => {
            if (index < order) return 0;
            return 1.5 * (raw[index] ?? 0) - 0.8 * (raw[index - 1] ?? 0) + 0.4 * (raw[index - 2] ?? 0);
        });
    }

    let weights: number[] = Array.from({ length: order }, () => 0);
    let P: number[][] = Array.from({ length: order }, (_, row) =>
        Array.from({ length: order }, (_, col) => (row === col ? 1 / delta : 0)),
    );
    let errorSum = 0;
    let processed = 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(weights, "idle"),
        edges: [],
        description: `Adapting an order-${order} FIR filter with forgetting factor ${lambda}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { sample: 0, weights: [...weights], error: 0, mse: 0, processed: 0 },
    };
    step += 1;

    for (let index = order; index < inputs.length; index += 1) {
        const regressor = Array.from({ length: order }, (_, tap) => inputs[index - tap] ?? 0);
        const prediction = dot(regressor, weights);
        const error = (desired[index] ?? 0) - prediction;
        const Pphi = P.map((row) => dot(row, regressor));
        const denominator = lambda + dot(regressor, Pphi);
        if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-18) {
            continue;
        }
        const gain = Pphi.map((value) => value / denominator);
        weights = weights.map((value, tap) => value + (gain[tap] ?? 0) * error);
        P = P.map((row, rowIndex) =>
            row.map((value, colIndex) => (value - (gain[rowIndex] ?? 0) * (Pphi[colIndex] ?? 0)) / lambda),
        );
        processed += 1;
        errorSum += error * error;
        yield {
            stepNumber: step,
            entities: makeBars(weights, "comparing"),
            edges: [],
            description: `Sample ${index}: prediction ${prediction.toFixed(4)}, error ${error.toFixed(4)}, tap 0 now ${(weights[0] ?? 0).toFixed(4)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { sample: index, weights: [...weights], error, mse: errorSum / processed, processed },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(weights, "sorted"),
        edges: [],
        description: `After ${processed} update(s) the final weights are [${weights.map((value) => value.toFixed(4)).join(", ")}].`,
        codeLineNumber: 7,
        layout: "array",
        meta: { sample: inputs.length, weights: [...weights], error: 0, mse: errorSum / Math.max(1, processed), processed },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Recursive least squares is an online version of fitting a line: it keeps a running estimate of the filter weights and a matrix that summarizes how uncertain it is about them. Each new sample produces a small correction whose size is scaled by that uncertainty, so large surprises move the weights a lot and routine samples barely move them. With no forgetting it reproduces the batch least squares answer once enough data has arrived.",
        invariants: [
            "The gain vector is the inverse correlation matrix times the regressor, normalized by the prediction error variance.",
            "The inverse correlation matrix update is a rank-one downdate divided by the forgetting factor.",
            "With a forgetting factor of one the weights equal the least squares solution of all samples seen so far.",
        ],
        correctness:
            "The recursion is the Kalman filter specialized to a linear observation model with no process noise. Applying the matrix inversion lemma to the accumulated regressor outer products shows that P stays equal to the inverse of the regularized sample correlation matrix. The weight update is therefore the exact minimizer of the accumulated weighted squared error, so for a forget factor of one it coincides with the batch least squares solution.",
        complexityRationale:
            "Each sample forms an order-by-order matrix-vector product and an outer product update, both O(order squared). Storing the inverse correlation matrix requires O(order squared) space.",
        uses: [
            "Adaptive noise cancellation and echo cancellation in signal processing",
            "Online system identification for tracking plant parameters",
            "Channel estimation in wireless receivers",
        ],
        references: [
            "Haykin, Adaptive Filter Theory, Chapter 5",
            "Goodwin and Sin, Adaptive Filtering Prediction and Control, Chapter 2",
        ],
        workedExample:
            "With order two and desired samples generated by 1.5 x[t] minus 0.8 x[t-1] plus 0.4 x[t-2], the filter starts at zero. After a few dozen samples the first tap settles near 1.5, the second near minus 0.8, and the third near 0.4, matching the system that generated the data.",
    },
    id: "recursive-least-squares",
    name: "Recursive Least Squares Filter",
    category: "numerical-optimization",
    complexity: { time: "O(samples * order^2)", space: "O(order^2)" },
    defaultInput: { order: 3, lambda: 1, delta: 1e-4 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize weights to zero and P to the inverse regularization times identity",
        "for each sample once the regressor is full",
        "form the regressor from the current and previous inputs",
        "compute the prediction error against the desired signal",
        "form the gain as P times regressor over lambda plus regressor dot P regressor",
        "update the weights by the gain times the error",
        "downdate P by the rank-one outer product and divide by lambda",
        "done: report the final weight vector and mean squared error",
    ],
};

export default module;
