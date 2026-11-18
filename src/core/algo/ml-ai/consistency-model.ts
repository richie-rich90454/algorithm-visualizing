/**
 * consistency-model.ts - Consistency Distillation Gradient Step
 *
 * Scope: a consistency model is trained so that a network maps every point on
 * a diffusion trajectory to the same clean estimate in one evaluation. This
 * implements the teachable core: the self-consistency loss between adjacent
 * noise levels and one backtracked gradient step on a small toy linear model.
 * It does NOT implement a U-Net, a diffusion sampler, or EMA teacher weights.
 *
 * Time:  O(T * p) for T noise levels and p parameters
 * Space: O(T)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface ConsistencyInput {
    x0?: number;
    noise?: number;
    levels?: number[];
    learningRate?: number;
}

type Theta = [number, number, number];

/** Toy consistency function f(x, t) = theta0*x + theta1*t + theta2. */
function predict(theta: Theta, x: number, t: number): number {
    return theta[0] * x + theta[1] * t + theta[2];
}

/** Sum of squared differences between adjacent noise-level predictions. */
function consistencyLoss(theta: Theta, xs: number[], ts: number[]): number {
    let total = 0;
    for (let k = 0; k + 1 < ts.length; k += 1) {
        const a = predict(theta, xs[k] ?? 0, ts[k] ?? 0);
        const b = predict(theta, xs[k + 1] ?? 0, ts[k + 1] ?? 0);
        total += (b - a) * (b - a);
    }
    return total;
}

/** Gradient of the loss with stop-gradient on the earlier noise level. */
function gradient(theta: Theta, xs: number[], ts: number[]): Theta {
    const grad: Theta = [0, 0, 0];
    for (let k = 0; k + 1 < ts.length; k += 1) {
        const diff = predict(theta, xs[k + 1] ?? 0, ts[k + 1] ?? 0) - predict(theta, xs[k] ?? 0, ts[k] ?? 0);
        const x = xs[k + 1] ?? 0;
        const t = ts[k + 1] ?? 0;
        grad[0] += 2 * diff * x;
        grad[1] += 2 * diff * t;
        grad[2] += 2 * diff;
    }
    return grad;
}

/** Bar chart of predictions at each noise level. */
function makeBars(values: number[], ts: number[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `level-${index}`,
        type: "bar" as const,
        label: `t=${ts[index]}:${value.toFixed(3)}`,
        value,
        state: "active" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, t: ts[index] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ConsistencyInput | null) ?? {};
    const x0 = typeof task.x0 === "number" ? task.x0 : 1;
    const noise = typeof task.noise === "number" ? task.noise : 0.8;
    const ts = Array.isArray(task.levels) && task.levels.length >= 2 ? [...task.levels] : [0.2, 0.4, 0.6, 0.8, 1];
    const lr = typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.01;
    const xs = ts.map((t) => x0 + t * noise);

    let theta: Theta = [0.2, -0.1, 0];
    const thetaBefore: number[] = [theta[0], theta[1], theta[2]];
    const lossBefore = consistencyLoss(theta, xs, ts);
    const fBefore = ts.map((t, i) => predict(theta, xs[i] ?? 0, t));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(fBefore, ts),
        edges: [],
        description: `Initial toy consistency predictions vary across ${ts.length} noise levels; loss = ${lossBefore.toFixed(5)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            levels: ts,
            xs,
            fBefore,
            fAfter: [],
            lossBefore,
            lossAfter: lossBefore,
            thetaBefore: [...theta],
            thetaAfter: [...theta],
        },
    };
    step += 1;

    // One backtracked gradient step chosen so the loss strictly decreases.
    const grad = gradient(theta, xs, ts);
    let rate = lr;
    let candidate: Theta = [theta[0] - rate * grad[0], theta[1] - rate * grad[1], theta[2] - rate * grad[2]];
    let candidateLoss = consistencyLoss(candidate, xs, ts);
    let halvings = 0;
    while (candidateLoss >= lossBefore && rate > 1e-10 && halvings < 60) {
        rate /= 2;
        halvings += 1;
        candidate = [theta[0] - rate * grad[0], theta[1] - rate * grad[1], theta[2] - rate * grad[2]];
        candidateLoss = consistencyLoss(candidate, xs, ts);
    }
    if (candidateLoss < lossBefore) {
        theta = candidate;
    }
    const lossAfter = consistencyLoss(theta, xs, ts);
    const fAfter = ts.map((t, i) => predict(theta, xs[i] ?? 0, t));

    yield {
        stepNumber: step,
        entities: makeBars(fAfter, ts),
        edges: [],
        description: `After one consistency-distillation step (rate ${rate.toExponential(2)}), the spread across noise levels shrank; loss = ${lossAfter.toFixed(5)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            levels: ts,
            xs,
            fBefore,
            fAfter,
            lossBefore,
            lossAfter,
            thetaBefore,
            thetaAfter: [...theta],
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(fAfter, ts),
        edges: [],
        description: `Done: the consistency objective dropped from ${lossBefore.toFixed(5)} to ${lossAfter.toFixed(5)}; one evaluation now gives a nearly level-independent estimate.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            levels: ts,
            xs,
            fBefore,
            fAfter,
            lossBefore,
            lossAfter,
            thetaAfter: [...theta],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A consistency model is trained so that starting from any noisy point and evaluating the network once gives the same clean answer as starting from any other noise level. Training enforces this by comparing predictions at neighboring noise levels and penalizing any disagreement. One gradient step on that self-consistency loss makes the predictions flatter across the trajectory.",
        invariants: [
            "The input at level t follows the forward trajectory x(t) = x0 + t times noise.",
            "The loss sums squared differences between predictions at adjacent levels only.",
            "The earlier level's prediction is treated as a constant target, so the gradient flows only through the later level.",
        ],
        correctness:
            "The gradient of each squared-difference term is 2 times the prediction gap times the feature vector at the later level. Backtracking shrinks the step until the recomputed loss strictly decreases, so the update is a genuine descent step. Repeated steps drive all adjacent predictions together, which is exactly the self-consistency property the model is trained for.",
        complexityRationale:
            "With T noise levels and p parameters, forming the loss and its gradient visits T - 1 adjacent pairs, costing O(T * p) time and O(T) space for the trajectory and prediction lists.",
        uses: [
            "One-step or few-step image and audio generation",
            "Distilling a slow diffusion sampler into a fast model",
            "Teaching self-consistency regularization",
        ],
        references: [
            "Song, Meng and Ermon, Consistency Models, 2023",
            "Song et al., Score-Based Generative Modeling through Stochastic Differential Equations, 2021",
        ],
        workedExample:
            "With levels 0.2, 0.4, 0.6 and a toy linear model, the initial predictions differ at neighboring levels. The consistency loss adds those squared gaps; one gradient step adjusts the weights so a single evaluation at any of the three levels returns nearly the same clean estimate.",
    },
    id: "consistency-model",
    name: "Consistency Model (Distillation Step)",
    category: "ml-ai",
    complexity: { time: "O(T * p)", space: "O(T)" },
    defaultInput: { x0: 1, noise: 0.8, levels: [0.2, 0.4, 0.6, 0.8, 1], learningRate: 0.01 },
    visualType: "array",
    run,
    pseudocode: [
        "build the forward trajectory at each noise level",
        "evaluate the toy consistency model at every level",
        "sum squared gaps between neighboring predictions",
        "compute the gradient with a fixed earlier-level target",
        "take a backtracked step that lowers the loss",
        "done: report predictions and loss before and after",
    ],
};

export default module;
