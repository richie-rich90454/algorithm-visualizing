/**
 * novograd.ts - NovoGrad Normalized Gradient Optimizer
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * NovoGrad normalizes each gradient by the running root-mean-square of squared
 * gradients before folding it into a momentum estimate. Normalizing first makes
 * the optimizer far less sensitive to the scale of the loss and to the
 * learning-rate warmup that plain Adam needs. The demo minimizes a one-
 * dimensional quadratic with an exact gradient so every step is reproducible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations)
 *   Space: O(iterations) for the plotted loss history
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame appends a (iteration, loss) point to the loss curve.
 *   - The most recent point is highlighted; earlier points are visited.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build the loss-curve points seen so far. */
function makeEntities(history: number[], current: number): VisualEntity[] {
    return history.map((loss, index) => ({
        id: `loss-${index}`,
        type: "node" as const,
        label: loss.toFixed(3),
        value: loss,
        state: (index === current ? "comparing" : "visited") as EntityState,
        x: index,
        y: loss,
        width: 0,
        height: 0,
        metadata: { iteration: index, loss },
    }));
}

/** Objective: (w - target)^2, whose exact gradient is 2*(w - target). */
function lossAt(w: number, target: number): number {
    return (w - target) * (w - target);
}

/** The NovoGrad generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            target?: number;
            start?: number;
            iterations?: number;
            learningRate?: number;
            beta1?: number;
            beta2?: number;
            epsilon?: number;
        } | null
    ) ?? {};
    const target = typeof task.target === "number" ? task.target : 3;
    const start = typeof task.start === "number" ? task.start : 0;
    const iterations = typeof task.iterations === "number" ? Math.max(1, task.iterations) : 30;
    const rate = typeof task.learningRate === "number" ? task.learningRate : 0.1;
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.95;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.999;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;

    let w = start;
    let m = 0;
    let v = 0;
    const history: number[] = [lossAt(w, target)];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(history, 0),
        edges: [],
        description: `NovoGrad minimizing (w - ${target})^2 from w = ${start}, learning rate ${rate}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { iteration: 0, weight: w, loss: history[0], m, v },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const gradient = 2 * (w - target);
        v = beta2 * v + (1 - beta2) * gradient * gradient;
        const normalized = gradient / (Math.sqrt(v) + epsilon);
        m = beta1 * m + (1 - beta1) * normalized;
        w -= rate * m;
        const loss = lossAt(w, target);
        history.push(loss);

        yield {
            stepNumber: step,
            entities: makeEntities(history, history.length - 1),
            edges: [],
            description: `Iteration ${iteration}: gradient ${gradient.toFixed(3)} normalized to ${normalized.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: iteration < iterations ? 5 : 7,
            layout: "point",
            meta: { iteration, weight: w, loss, gradient, normalized, m, v },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(history, -1),
        edges: [],
        description: `Finished after ${iterations} iteration(s); weight ${w.toFixed(4)}, loss ${lossAt(w, target).toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { iteration: iterations, weight: w, loss: lossAt(w, target), converged: lossAt(w, target) < 0.01, v },
    };
}

/** The NovoGrad module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "NovoGrad asks a simple question: why wait for a bias-correction warmup when you can divide the gradient by its own running root-mean-square first? Each gradient is normalized to roughly unit scale before it enters the momentum accumulator, so layers with very different gradient magnitudes still make balanced progress. The weight then moves by the learning rate times that normalized momentum.",
        invariants: [
            "The second moment v is an exponential moving average of squared gradients and stays nonnegative.",
            "The normalized gradient has magnitude governed by the running RMS, not by the raw loss scale.",
            "The first moment m accumulates normalized rather than raw gradients.",
        ],
        correctness:
            "Because v is nonnegative, the normalization denominator is positive and the normalized gradient is well defined. The momentum average has the same sign as the descent direction on a convex quadratic, so each step decreases the distance to the minimizer for a suitable learning rate. The independent reference in the tests reproduces the identical closed sequence of weights, confirming the replay is exact.",
        complexityRationale:
            "The update uses a fixed number of scalar operations per iteration, giving O(iterations) time. One loss sample is retained per iteration for the curve, so the stored history is O(iterations).",
        uses: [
            "Training large language models with mixed-precision gradients",
            "Optimizing objectives whose gradient scale varies across parameter groups",
            "Avoiding the warmup sensitivity of unnormalized Adam",
        ],
        references: [
            "Ginsburg et al., Stochastic Gradient Methods with Layer-wise Adaptive Moments, NeurIPS 2019",
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
        ],
        workedExample:
            "From w = 0 toward target 3 the first gradient is -6. With beta2 = 0.999 the first v is about 0.036, so the normalized gradient is near -1 and m moves slightly negative. Each later iteration keeps m pointing downhill, and w converges toward 3 while the plotted loss falls toward zero.",
    },
    id: "novograd",
    name: "NovoGrad Optimizer",
    category: "ml-ai",
    complexity: { time: "O(iterations)", space: "O(iterations)" },
    defaultInput: { target: 3, start: 0, iterations: 30, learningRate: 0.1 },
    visualType: "point",
    run,
    pseudocode: [
        "initialize weight, first moment m = 0, second moment v = 0",
        "for each iteration compute the gradient of the loss",
        "update v as an exponential average of the squared gradient",
        "divide the gradient by the square root of v to normalize it",
        "update m as an exponential average of the normalized gradient",
        "subtract the learning rate times m from the weight",
        "record the new loss on the curve",
        "done: report the final weight and loss",
    ],
};

export default module;
