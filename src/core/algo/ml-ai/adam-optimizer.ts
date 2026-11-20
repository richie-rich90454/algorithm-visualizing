/**
 * adam-optimizer.ts - Adam Adaptive Moment Estimation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adam maintains an exponentially decaying average of gradients (the first
 * moment) and of squared gradients (the second moment). Both averages are
 * bias-corrected early in training and then used to scale a single step per
 * parameter. This demo minimizes a one-dimensional quadratic, where the exact
 * gradient is known, so every update can be replayed precisely.
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
 *   - Each frame adds a point (iteration, loss) to the loss curve.
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

/** Objective: minimize (w - target)^2. Its gradient is 2*(w - target). */
function lossAt(w: number, target: number): number {
    return (w - target) * (w - target);
}

/** The Adam generator. */
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
    const history: number[] = [lossAt(w, target)];
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(history, 0),
        edges: [],
        description: `Adam minimizing (w - ${target})^2 from w = ${start}, learning rate ${rate}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { iteration: 0, w, m, v, loss: history[0] ?? 0 },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const gradient = 2 * (w - target);
        m = beta1 * m + (1 - beta1) * gradient;
        v = beta2 * v + (1 - beta2) * gradient * gradient;
        const mHat = m / (1 - Math.pow(beta1, iteration));
        const vHat = v / (1 - Math.pow(beta2, iteration));
        w -= (rate * mHat) / (Math.sqrt(vHat) + epsilon);
        const currentLoss = lossAt(w, target);
        history.push(currentLoss);
        yield {
            stepNumber: step,
            entities: makeEntities(history, history.length - 1),
            edges: [],
            description: `Iteration ${iteration}: gradient ${gradient.toFixed(3)}, w -> ${w.toFixed(4)}, loss ${currentLoss.toFixed(5)}.`,
            codeLineNumber: 5,
            layout: "point",
            meta: { iteration, w, m, v, mHat, vHat, gradient, loss: currentLoss },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(history, -1),
        edges: [],
        description: `Done: w = ${w.toFixed(5)} after ${iterations} iterations, final loss ${(history[history.length - 1] ?? 0).toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { iteration: iterations, w, m, v, loss: history[history.length - 1] ?? 0, converged: true },
    };
}

/** The Adam module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Adam keeps two running averages for each parameter: one of the gradients and one of the squared gradients. Dividing the averaged gradient by the square root of the averaged square makes the step size nearly independent of the gradient's scale, while bias correction prevents tiny steps at the very beginning.",
        invariants: [
            "The first moment m is an exponential moving average of the gradient.",
            "The second moment v is an exponential moving average of the squared gradient.",
            "Bias correction divides m and v by 1 minus the decay raised to the iteration count.",
        ],
        correctness:
            "On a smooth convex objective, the bias-corrected moments are unbiased estimates of the first and second moments of the gradient, so the update is a gradient step whose scale is normalized per coordinate. For the quadratic demo the gradient is exact, and the iterates provably converge to the minimizer for a suitable learning rate.",
        complexityRationale:
            "Each iteration performs a constant number of scalar operations, so time is O(iterations). The visualization stores one point per iteration, giving O(iterations) space; the optimizer state itself is O(1).",
        uses: [
            "Default optimizer for training deep neural networks",
            "Fine-tuning transformers and other large models",
            "Any setting with sparse or differently scaled gradients",
        ],
        references: [
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
            "Loshchilov and Hutter, Decoupled Weight Decay Regularization, ICLR 2019",
        ],
        workedExample:
            "Minimizing (w - 3)^2 from w = 0 with learning rate 0.3: the first gradient is -6, the bias-corrected moment ratio is -1, so the first step sets w to 0.3. Successive steps grow w toward 3 while the loss curve falls toward zero.",
    },
    id: "adam-optimizer",
    name: "Adam Optimizer",
    category: "ml-ai",
    complexity: { time: "O(iterations)", space: "O(iterations)" },
    defaultInput: { target: 3, start: 0, iterations: 30, learningRate: 0.3, beta1: 0.9, beta2: 0.999, epsilon: 1e-8 },
    visualType: "point",
    run,
    pseudocode: [
        "initialize parameter w, first moment m, second moment v to zero",
        "for each iteration t from one to T",
        "compute gradient g of the loss at w",
        "update m to beta1 times m plus (1 - beta1) times g",
        "update v to beta2 times v plus (1 - beta2) times g squared",
        "form bias-corrected m hat and v hat",
        "subtract learning rate times m hat over square root of v hat plus epsilon from w",
        "done: report the fitted parameter and final loss",
    ],
};

export default module;
