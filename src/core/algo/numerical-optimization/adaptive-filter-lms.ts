/**
 * adaptive-filter-lms.ts - Least Mean Squares Adaptive Filter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The least mean squares (LMS) adaptive filter adjusts a finite impulse
 * response one sample at a time. It computes the output as the dot product of
 * its weights with the newest input window, forms the error against a desired
 * signal, and nudges each weight by a small step times that error times the
 * corresponding input sample. It is the stochastic-gradient descent solution
 * to the Wiener filtering problem and needs no matrix inversion.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(samples * order)
 *   Space: O(order + samples) for the weights and the input history
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current weight vector beside the unknown system weights.
 *   - The weight receiving the largest update is gold; converged weights green.
 *   - meta carries the weights, target, step size, and squared error history.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Deterministic signed pseudo-random signal in [-1, 1). */
function makeSignal(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return (state / 4294967296) * 2 - 1;
    };
}

function makeBars(weights: number[], target: number[], hot: number, converged: boolean): VisualEntity[] {
    return weights.map((value, index) => {
        let state: "comparing" | "sorted" | "idle" = "idle";
        if (index === hot) {
            state = "comparing";
        } else if (converged) {
            state = "sorted";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, target: target[index] ?? 0 },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { order?: number; mu?: number; samples?: number; seed?: number } | null) ?? {};
    const order = Math.max(1, Math.min(8, Math.floor(Number(task.order ?? 3)) || 3));
    const mu = Math.max(0.001, Math.min(0.5, Number(task.mu ?? 0.05) || 0.05));
    const samples = Math.max(order + 1, Math.min(400, Math.floor(Number(task.samples ?? 60)) || 60));
    const seed = Number.isFinite(Number(task.seed)) ? Math.floor(Number(task.seed)) : 7;
    const target = Array.from({ length: order }, (_, i) => 1 / (i + 1) * (i % 2 === 0 ? 1 : -1));

    const random = makeSignal(seed);
    const signal = Array.from({ length: samples }, () => random());
    const desired = Array.from({ length: samples }, () => 0);
    for (let n = 0; n < samples; n += 1) {
        let value = 0;
        for (let k = 0; k < order; k += 1) {
            const index = n - k;
            if (index >= 0) value += (target[k] ?? 0) * (signal[index] ?? 0);
        }
        desired[n] = value;
    }

    const weights = Array.from({ length: order }, () => 0);
    const errors: number[] = [];
    let hot = -1;

    const metaFor = (n: number, error: number) => ({
        order,
        mu,
        samples,
        iteration: n,
        error,
        avgError: errors.reduce((sum, value) => sum + value, 0) / Math.max(1, errors.length),
        weights: weights.slice(),
        target: target.slice(),
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(weights, target, -1, false),
        edges: [],
        description: `Initializing an ${order}-tap LMS filter with step size ${mu} to identify a fixed system.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(0, 0),
    };
    step += 1;

    for (let n = order - 1; n < samples; n += 1) {
        let output = 0;
        for (let k = 0; k < order; k += 1) output += (weights[k] ?? 0) * (signal[n - k] ?? 0);
        const error = (desired[n] ?? 0) - output;
        hot = 0;
        let largest = -Infinity;
        for (let k = 0; k < order; k += 1) {
            const magnitude = Math.abs(mu * error * (signal[n - k] ?? 0));
            if (magnitude > largest) {
                largest = magnitude;
                hot = k;
            }
        }
        for (let k = 0; k < order; k += 1) {
            weights[k] = (weights[k] ?? 0) + mu * error * (signal[n - k] ?? 0);
        }
        errors.push(error * error);

        const recent = errors.slice(-10);
        const recentMean = recent.reduce((sum, value) => sum + value, 0) / recent.length;
        const converged = recentMean < 1e-4;
        if (n === order - 1 || (n - (order - 1)) % 6 === 0 || n === samples - 1 || converged) {
            yield {
                stepNumber: step,
                entities: makeBars(weights, target, hot, converged),
                edges: [],
                description: `Sample ${n}: output ${output.toFixed(3)}, error ${error.toFixed(3)}; updated tap ${hot} by gradient step ${largest.toExponential(2)}.`,
                codeLineNumber: error >= 0 ? 2 : 3,
                layout: "array",
                meta: metaFor(n, error),
            };
            step += 1;
            if (converged) break;
        }
    }

    const recent = errors.slice(-10);
    const finalMean = recent.reduce((sum, value) => sum + value, 0) / Math.max(1, recent.length);
    yield {
        stepNumber: step,
        entities: makeBars(weights, target, -1, finalMean < 1e-4),
        edges: [],
        description: `Finished after ${errors.length} samples: mean squared error ${finalMean.toExponential(3)}; weights track the unknown system.`,
        codeLineNumber: 5,
        layout: "array",
        meta: metaFor(samples - 1, errors[errors.length - 1] ?? 0),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An adaptive filter does not know the system it is tracking, so it treats each new sample as a small vote on which way to move its weights. When the output is too low it pushes weights up in proportion to the current inputs; when it is too high it pushes them down. A small step size makes the motion gradual but steady, like walking downhill in fog using only the local slope.",
        invariants: [
            "Only samples from the current input window influence the current update.",
            "Each weight changes by the same scalar step multiplied by its own input sample.",
            "The step size is positive and bounded, so the direction always reduces the instantaneous squared error locally.",
        ],
        correctness:
            "The instantaneous squared error is a convex quadratic in the weights. Its exact gradient is minus twice the error times the input window, so taking a step proportional to the input times the error is stochastic gradient descent on the mean squared error. With a step size below twice the reciprocal of the input power the expected weights converge to the Wiener solution, which for noise-free system identification is the unknown system itself.",
        complexityRationale:
            "Each sample forms one dot product and one outer-product-style update over the order of the filter, so the cost is O(samples * order). Only the weight vector and the short input history need to be stored, giving O(order) working space besides the recorded signal.",
        uses: [
            "Echo cancellation in telephony and conference systems",
            "Adaptive noise cancellation and system identification",
            "Channel equalization in digital communications",
        ],
        references: [
            "Widrow and Hoff, Adaptive Switching Circuits, 1960",
            "Haykin, Adaptive Filter Theory, Chapter 5",
        ],
        workedExample:
            "With a single tap, step 0.1, input 0.8, and desired 1.0, the zero filter outputs 0 and sees error 1.0. The weight becomes 0 + 0.1 * 1.0 * 0.8 = 0.08, output rises to 0.064, and repeated samples walk the weight toward the value that makes output match the desired signal.",
    },
    id: "adaptive-filter-lms",
    name: "LMS Adaptive Filter",
    category: "numerical-optimization",
    complexity: { time: "O(samples * order)", space: "O(order)" },
    defaultInput: { order: 3, mu: 0.05, samples: 60, seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the filter weights to zero and choose a step size",
        "for each new sample build the input window",
        "compute the output as the dot product of weights and window",
        "form the error as desired minus output",
        "add step times error times each window sample to its weight",
        "record the squared error and repeat",
        "done: report the converged weights and mean squared error",
    ],
};

export default module;
