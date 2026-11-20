/**
 * schedule-free-optimizer.ts - Schedule-Free AdamW
 *
 * Schedule-Free learning replaces a decaying step-size schedule with a blend
 * of interpolation and averaging. It keeps a fast iterate z, an averaged
 * iterate x, and evaluates gradients at a point y between them. Because x is
 * an average of the iterates, the learner can be queried at any time without
 * knowing the total number of steps in advance.
 *
 * Time O(steps * d), space O(d) for the state vectors.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FreeInput {
    target: number[];
    x0: number[];
    lr: number;
    beta: number;
    beta1: number;
    beta2: number;
    weightDecay: number;
    steps: number;
}

export interface FreeStep {
    t: number;
    y: number[];
    grad: number[];
    z: number[];
    x: number[];
    loss: number;
}

interface State {
    z: number[];
    x: number[];
    m: number[];
    v: number[];
    t: number;
}

/** Advance one Schedule-Free AdamW step on a quadratic objective. */
export function scheduleFreeStep(state: State, input: FreeInput): State {
    const d = input.x0.length;
    const t = state.t + 1;
    const y = state.z.map((v, i) => (1 - input.beta) * v + input.beta * (state.x[i] ?? 0));
    const g = y.map((v, i) => v - (input.target[i] ?? 0));
    const m = g.map((v, i) => input.beta1 * (state.m[i] ?? 0) + (1 - input.beta1) * v);
    const v2 = g.map((v, i) => input.beta2 * (state.v[i] ?? 0) + (1 - input.beta2) * v * v);
    const z = state.z.map((zi, i) => {
        const mHat = (m[i] ?? 0) / (1 - Math.pow(input.beta1, t));
        const vHat = (v2[i] ?? 0) / (1 - Math.pow(input.beta2, t));
        const adam = mHat / (Math.sqrt(vHat) + 1e-8);
        return zi - input.lr * (adam + input.weightDecay * zi);
    });
    const c = 1 / t;
    const x = state.x.map((xi, i) => (1 - c) * xi + c * (z[i] ?? 0));
    return { z, x, m, v: v2, t };
}

/** Run the optimizer and record one frame of state per step. */
export function scheduleFreeRun(input: FreeInput): FreeStep[] {
    let state: State = {
        z: [...input.x0],
        x: [...input.x0],
        m: new Array(input.x0.length).fill(0),
        v: new Array(input.x0.length).fill(0),
        t: 0,
    };
    const log: FreeStep[] = [];
    for (let t = 1; t <= input.steps; t += 1) {
        const before = state;
        state = scheduleFreeStep(state, input);
        const y = before.z.map((v, i) => (1 - input.beta) * v + input.beta * (before.x[i] ?? 0));
        const g = y.map((v, i) => v - (input.target[i] ?? 0));
        const loss = state.x.reduce((acc, v, i) => acc + 0.5 * Math.pow(v - (input.target[i] ?? 0), 2), 0);
        log.push({ t, y, grad: g, z: [...state.z], x: [...state.x], loss });
    }
    return log;
}

function makeCells(log: FreeStep[], revealedFrom: number, d: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    log.forEach((s, r) => {
        for (let c = 0; c < d; c += 1) {
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: r >= revealedFrom ? `t${s.t} x${c}=${(s.x[c] ?? 0).toFixed(3)}` : "?",
                value: r >= revealedFrom ? (s.x[c] ?? 0) : 0,
                state: r >= revealedFrom ? "sorted" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<FreeInput> | null) ?? {};
    const target = task.target ?? [1, -1];
    const x0 = task.x0 ?? [0, 0];
    const lr = typeof task.lr === "number" ? task.lr : 0.1;
    const beta = typeof task.beta === "number" ? task.beta : 0.9;
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.9;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.999;
    const weightDecay = typeof task.weightDecay === "number" ? task.weightDecay : 0;
    const steps = typeof task.steps === "number" ? Math.max(1, task.steps) : 30;
    const inputFull: FreeInput = { target, x0, lr, beta, beta1, beta2, weightDecay, steps };
    const log = scheduleFreeRun(inputFull);
    const d = x0.length;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(log, log.length, d),
        edges: [],
        description: `Schedule-Free AdamW for ${steps} steps: average the iterates instead of decaying the learning rate.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: log.length, cols: d, x: log[log.length - 1]?.x ?? x0 },
    };
    step += 1;
    for (let i = 0; i < log.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(log, i, d),
            edges: [],
            description: `Step ${log[i]?.t}: interpolate y, take an AdamW step on z, loss at x = ${(log[i]?.loss ?? 0).toFixed(4)}.`,
            codeLineNumber: i === 0 ? 2 : 5,
            layout: "grid",
            meta: { rows: log.length, cols: d, current: i, x: log[i]?.x ?? x0, loss: log[i]?.loss ?? 0 },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(log, 0, d),
        edges: [],
        description: `Done: averaged iterate [${(log[log.length - 1]?.x ?? []).map((v) => v.toFixed(3)).join(", ")}].`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: log.length, cols: d, x: log[log.length - 1]?.x ?? x0, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A fixed learning rate usually needs a schedule that shrinks it near the end of training, but that requires knowing the stopping time. Schedule-Free learning instead averages the iterates it visits and evaluates gradients at a blend of the fast and averaged points. The average acts like an implicit schedule, so the model is good at every point in training rather than only at the final step.",
        invariants: [
            "Gradients are evaluated at y, a blend of the fast iterate z and the averaged iterate x.",
            "The averaged iterate x interpolates toward z with weight one over the step count.",
            "The Adam step on z uses bias-corrected moments and decoupled weight decay.",
        ],
        correctness:
            "At each step the code forms y as one minus beta times z plus beta times x, evaluates the quadratic gradient at y, updates the Adam first and second moments with bias correction, and moves z by the Adam step plus decoupled weight decay. It then sets x to the previous x interpolated toward z with weight one over t. This is the reference Schedule-Free AdamW recursion; the test reproduces the full trajectory with an independent loop and checks that the averaged iterate approaches the target.",
        complexityRationale:
            "Each step updates d coordinates with constant work each, so time is O(steps * d). Storing z, x, the two moment vectors, and the current gradient uses O(d) space.",
        uses: [
            "Training large models without a learning-rate schedule",
            "Anytime model checkpoints during training",
            "Hyperparameter tuning with fewer schedule choices",
        ],
        references: [
            "Defazio et al., The Road Less Scheduled, arXiv 2024",
            "Defazio, Yang, and Mehta, Schedule-Free Optimization in PyTorch, facebookresearch/schedule_free, 2024",
        ],
        workedExample:
            "Minimizing the distance to target [1, -1] from [0, 0] with a moderate learning rate, the fast iterate z moves quickly toward the target while x lags as a running average. Early gradients are evaluated mostly at z for fast progress, and as the step count grows the averaging weight shrinks so x settles near the target without any learning-rate decay.",
    },
    id: "schedule-free-optimizer",
    name: "Schedule-Free Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: {
        target: [1, -1],
        x0: [0, 0],
        lr: 0.1,
        beta: 0.9,
        beta1: 0.9,
        beta2: 0.999,
        weightDecay: 0,
        steps: 30,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize fast iterate z and averaged iterate x to the start point",
        "for each step t",
        "set y to one minus beta times z plus beta times x",
        "evaluate the gradient at y and update Adam moments",
        "move z by the bias-corrected Adam step plus decoupled weight decay",
        "interpolate x toward z with weight one over t",
        "done: report the averaged iterate x",
    ],
};

export default module;
