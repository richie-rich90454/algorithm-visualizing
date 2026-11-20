/**
 * diffgrad.ts - DiffGrad Adaptive Optimizer
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DiffGrad scales Adam's first-moment step by a factor derived from the change
 * between consecutive gradients. When gradients barely change the optimizer
 * takes a larger step; when they oscillate it damps the step. The demo
 * minimizes a one-dimensional quadratic with an exact gradient, so every
 * update is replayable and checkable.
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
 *   - Each frame adds a (iteration, loss) point to the loss curve.
 *   - The newest point is highlighted; earlier points are visited.
 *   - The final frame reports the learned weight and factor.
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

/** The DiffGrad generator. */
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
    const rate = typeof task.learningRate === "number" ? task.learningRate : 0.3;
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.9;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.999;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;

    let w = start;
    let m = 0;
    let v = 0;
    let previousGradient = 0;
    const history: number[] = [lossAt(w, target)];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(history, 0),
        edges: [],
        description: `DiffGrad minimizing (w - ${target})^2 from w = ${start}, learning rate ${rate}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { iteration: 0, weight: w, loss: history[0], factor: 1, m, v },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const gradient = 2 * (w - target);
        m = beta1 * m + (1 - beta1) * gradient;
        v = beta2 * v + (1 - beta2) * gradient * gradient;
        const difference = Math.abs(gradient - previousGradient);
        const factor = 1 / (1 + Math.exp(-difference));
        w -= (rate * factor * m) / (Math.sqrt(v) + epsilon);
        previousGradient = gradient;
        const loss = lossAt(w, target);
        history.push(loss);

        yield {
            stepNumber: step,
            entities: makeEntities(history, history.length - 1),
            edges: [],
            description: `Iteration ${iteration}: gradient ${gradient.toFixed(3)}, DiffGrad factor ${factor.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: iteration < iterations ? 5 : 7,
            layout: "point",
            meta: { iteration, weight: w, loss, factor, gradient, m, v },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(history, -1),
        edges: [],
        description: `Finished after ${iterations} iteration(s); weight ${w.toFixed(4)}, loss ${lossAt(w, target).toFixed(6)}.`,
        codeLineNumber: 8,
        layout: "point",
        meta: { iteration: iterations, weight: w, loss: lossAt(w, target), converged: lossAt(w, target) < 0.01, factor: 0.5 },
    };
}

/** The DiffGrad module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "DiffGrad is Adam with a gradient-aware step size. It watches how much the gradient changes from one step to the next: a slowly changing gradient suggests a stable region where a big step is safe, while a rapidly changing gradient suggests a noisy region where we should be careful. A sigmoid of the gradient difference turns that idea into a multiplier between zero and one.",
        invariants: [
            "The factor always lies strictly between 0 and 1 because it is a sigmoid.",
            "The first and second moments are exponential moving averages of the gradient and its square.",
            "On the quadratic objective the loss equals (weight - target) squared.",
        ],
        correctness:
            "Each update moves the weight opposite the sign of the moment, scaled by a positive factor and a positive denominator, so the step always points downhill for this convex objective. Because the factor is bounded and the moment decay is standard Adam, the iterate converges to the minimizer for a suitable learning rate, and the replayed loss history records every intermediate weight exactly.",
        complexityRationale:
            "Every iteration performs a constant number of scalar operations, so the time is O(iterations). Storing one loss point per iteration for the curve uses O(iterations) space.",
        uses: [
            "Training convolutional networks where gradient stability varies by layer",
            "Fine-tuning with noisy mini-batch gradients",
            "A teaching example of gradient-adaptive step sizing beyond Adam",
        ],
        references: [
            "Dubey et al., When An Adam Is Not Enough: DiffGrad, WACV 2020",
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
        ],
        workedExample:
            "Starting at w = 0 with target 3, the first gradient is -6, m becomes -0.6 and v becomes 0.036. With no previous gradient the factor is sigmoid(6), nearly 1, so w moves toward 3. As w approaches 3 the gradients shrink, the factor stays near 1, and the loss falls toward zero.",
    },
    id: "diffgrad",
    name: "DiffGrad Optimizer",
    category: "ml-ai",
    complexity: { time: "O(iterations)", space: "O(iterations)" },
    defaultInput: { target: 3, start: 0, iterations: 30, learningRate: 0.3 },
    visualType: "point",
    run,
    pseudocode: [
        "initialize weight, first moment m = 0, second moment v = 0",
        "set previous gradient to zero",
        "for each iteration compute gradient of the loss",
        "update m and v as exponential moving averages",
        "set factor to sigmoid of the absolute gradient change",
        "subtract learning rate times factor times m over square root of v",
        "remember the current gradient as the previous gradient",
        "record the new loss on the curve",
        "done: report the final weight and loss",
    ],
};

export default module;
