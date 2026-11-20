/**
 * adahessian.ts - AdaHessian Second-Order Optimizer
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AdaHessian brings curvature information to adaptive optimization. Instead of
 * storing a full Hessian matrix, it estimates the diagonal with a Hutchinson
 * probe: multiply the Hessian by a random sign vector and multiply by the sign
 * vector again. On the one-dimensional quadratic used here the true second
 * derivative is the constant 2, so the probe is exact and fully replayable.
 * The curvature estimate then rescales an Adam-like step.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations) (one Hessian-vector probe per step)
 *   Space: O(iterations) for the plotted loss history
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame appends a (iteration, loss) point to the loss curve.
 *   - The newest point is highlighted; earlier points are visited.
 *   - Meta records the estimated diagonal curvature at each step.
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

/** Hessian-vector product by central differences of the exact gradient. */
function hessianVector(w: number, target: number, vector: number, epsilon: number): number {
    const plus = 2 * (w + epsilon * vector - target);
    const minus = 2 * (w - epsilon * vector - target);
    return (plus - minus) / (2 * epsilon);
}

/** Deterministic Rademacher sign for a step, avoiding a random dependency. */
function rademacher(iteration: number): number {
    return iteration % 2 === 0 ? 1 : -1;
}

/** The AdaHessian generator. */
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
    const rate = typeof task.learningRate === "number" ? task.learningRate : 0.15;
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
        description: `AdaHessian minimizing (w - ${target})^2 from w = ${start}, learning rate ${rate}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { iteration: 0, weight: w, loss: history[0], curvature: 2, m, v },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const gradient = 2 * (w - target);
        const sign = rademacher(iteration);
        const curvature = sign * hessianVector(w, target, sign, 1e-4);
        m = beta1 * m + (1 - beta1) * gradient;
        v = beta2 * v + (1 - beta2) * curvature * curvature;
        const mHat = m / (1 - Math.pow(beta1, iteration));
        const vHat = v / (1 - Math.pow(beta2, iteration));
        w -= (rate * mHat) / (Math.sqrt(vHat) + epsilon);
        const loss = lossAt(w, target);
        history.push(loss);

        yield {
            stepNumber: step,
            entities: makeEntities(history, history.length - 1),
            edges: [],
            description: `Iteration ${iteration}: gradient ${gradient.toFixed(3)}, curvature ${curvature.toFixed(3)}, loss ${loss.toFixed(4)}.`,
            codeLineNumber: iteration < iterations ? 6 : 7,
            layout: "point",
            meta: { iteration, weight: w, loss, gradient, curvature, m, v },
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
        meta: { iteration: iterations, weight: w, loss: lossAt(w, target), converged: lossAt(w, target) < 0.01, curvature: 2 },
    };
}

/** The AdaHessian module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "First-order optimizers only know which way is downhill; AdaHessian also senses how sharply the surface bends. It estimates the diagonal of the Hessian with a cheap random probe instead of building the full matrix, then uses that curvature to scale an Adam-style step. Regions with high curvature get smaller steps and flat regions get larger ones.",
        invariants: [
            "The Hutchinson probe returns the exact diagonal on a quadratic because the Hessian is constant.",
            "The estimated curvature is always positive for this convex objective.",
            "The bias-corrected moments follow the standard Adam convention.",
        ],
        correctness:
            "For f(w) = (w - target)^2 the Hessian is the constant 2, so the central-difference Hessian-vector product is exactly 2 times the probe direction and the sign multiplication recovers 2 at every step. With positive curvature the denominator is positive, each step keeps the descent direction of the bias-corrected moment, and the weight converges to the minimizer, which the independent reference reproduces exactly.",
        complexityRationale:
            "Each iteration adds one Hessian-vector probe, a constant number of arithmetic operations, so time is O(iterations). Only the per-step loss curve is retained, giving O(iterations) space.",
        uses: [
            "Training transformer models where curvature varies widely across parameters",
            "Second-order fine-tuning with a memory footprint close to first-order methods",
            "A teaching bridge between Adam and full second-order optimization",
        ],
        references: [
            "Yao et al., ADAHESSIAN: An Adaptive Second Order Optimizer, AAAI 2021",
            "Hutchinson, A Stochastic Estimator of the Trace, 1989",
        ],
        workedExample:
            "From w = 0 toward target 3 the gradient is -6 and the curvature probe with sign +1 performs a central difference of the gradient at plus and minus a small offset, returning exactly 2. The bias-corrected moment is -6, v is 4, and the first step subtracts about rate times -6 over 2, pushing w toward 3.",
    },
    id: "adahessian",
    name: "AdaHessian Optimizer",
    category: "ml-ai",
    complexity: { time: "O(iterations)", space: "O(iterations)" },
    defaultInput: { target: 3, start: 0, iterations: 30, learningRate: 0.15 },
    visualType: "point",
    run,
    pseudocode: [
        "initialize weight, first moment m = 0, second moment v = 0",
        "for each iteration compute the gradient of the loss",
        "draw a random sign and estimate the diagonal Hessian with a probe",
        "update m from the gradient and v from the squared curvature",
        "bias-correct m and v by their decay powers",
        "subtract the learning rate times corrected m over corrected square root of v",
        "record the new loss on the curve",
        "done: report the final weight and loss",
    ],
};

export default module;
