/**
 * ranger-optimizer.ts - Ranger Optimizer Step (RAdam + Lookahead + GC)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Ranger combines three ideas in one update. Gradient centralization subtracts
 * the mean gradient so updates do not drift in a common direction. RAdam uses
 * a variance rectification term that grows from zero during warmup, avoiding
 * oversized early steps. Lookahead keeps a slow copy of the weights and only
 * folds in the fast weights every few steps. This module replays one exact
 * Ranger step on a small parameter vector.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d) for d parameters
 *   Space: O(d) for the moment, fast, and slow vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the parameters, centered gradient, and resulting weights.
 *   - The last frame marks the slow weights when the lookahead is applied.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RangerInput {
    params?: number[];
    grads?: number[];
    state?: Partial<RangerState>;
    lr?: number;
    beta1?: number;
    beta2?: number;
    eps?: number;
    alpha?: number;
    lookaheadEvery?: number;
}

export interface RangerState {
    t: number;
    m: number[];
    v: number[];
    slow: number[];
}

/** Compute one Ranger update without mutating the supplied state. */
export function rangerStep(
    params: number[],
    grads: number[],
    state: RangerState,
    config: { lr?: number; beta1?: number; beta2?: number; eps?: number; alpha?: number; lookaheadEvery?: number } = {},
) {
    const d = params.length;
    const lr = config.lr ?? 0.01;
    const b1 = config.beta1 ?? 0.9;
    const b2 = config.beta2 ?? 0.9;
    const eps = config.eps ?? 1e-8;
    const alpha = config.alpha ?? 0.5;
    const every = Math.max(1, config.lookaheadEvery ?? 5);
    const t = state.t + 1;

    const mean = d === 0 ? 0 : grads.reduce((sum, g) => sum + g, 0) / d;
    const centered = grads.map((g) => g - mean);

    const m: number[] = [];
    const v: number[] = [];
    for (let i = 0; i < d; i += 1) {
        const g = centered[i] ?? 0;
        m.push(b1 * (state.m[i] ?? 0) + (1 - b1) * g);
        v.push(b2 * (state.v[i] ?? 0) + (1 - b2) * g * g);
    }
    const mhat = m.map((value) => value / (1 - Math.pow(b1, t)));
    const vhat = v.map((value) => value / (1 - Math.pow(b2, t)));

    const rhoInf = 2 / (1 - b2) - 1;
    const bt = Math.pow(b2, t);
    const rho = rhoInf - (2 * t * bt) / (1 - bt);
    let rect: number;
    if (rhoInf <= 4) {
        rect = 1;
    } else if (rho > 4) {
        rect = Math.sqrt(((rho - 4) * (rho - 2) * rhoInf) / ((rhoInf - 4) * (rhoInf - 2) * rho));
    } else {
        rect = 0;
    }

    const stepVec = mhat.map((value, i) => (rect * value) / (Math.sqrt(vhat[i] ?? 0) + eps));
    const fast = state.slow.map((base, i) => base - lr * (stepVec[i] ?? 0));
    const applied = t % every === 0;
    const slow = state.slow.map((base, i) => (applied ? base + alpha * ((fast[i] ?? 0) - base) : base));

    return { t, centered, m, v, mhat, vhat, rho, rect, stepVec, fast, slow, applied };
}

function bars(values: number[], mode: "idle" | "grad" | "moment" | "fast" | "slow"): VisualEntity[] {
    const state: EntityState =
        mode === "idle" ? "idle" : mode === "grad" ? "comparing" : mode === "moment" ? "active" : mode === "fast" ? "highlight" : "sorted";
    return values.map((value, index) => ({
        id: `p-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, phase: mode },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RangerInput | null) ?? {};
    const params: number[] = (task.params ?? [0.4, -0.3, 0.8, -0.6]).slice();
    const grads: number[] = (task.grads ?? [0.5, 0.2, -0.4, 0.1]).slice();
    const d = params.length;
    const base: RangerState = {
        t: typeof task.state?.t === "number" ? task.state.t : 4,
        m: task.state?.m?.slice() ?? new Array(d).fill(0),
        v: task.state?.v?.slice() ?? new Array(d).fill(0),
        slow: task.state?.slow?.slice() ?? params.slice(),
    };
    const config = {
        lr: task.lr ?? 0.01,
        beta1: task.beta1 ?? 0.9,
        beta2: task.beta2 ?? 0.9,
        eps: task.eps ?? 1e-8,
        alpha: task.alpha ?? 0.5,
        lookaheadEvery: task.lookaheadEvery ?? 5,
    };
    const out = rangerStep(params, grads, base, config);
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(params, "idle"),
        edges: [],
        description: `One Ranger step on ${d} parameter(s) at iteration ${out.t}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "input", t: out.t, params, grads },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(out.centered, "grad"),
        edges: [],
        description: "Gradient centralization removes the mean so updates are not correlated.",
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "centralize", centered: out.centered },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(out.mhat, "moment"),
        edges: [],
        description: `Bias-corrected moments with RAdam rectification factor ${out.rect.toFixed(3)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "radam", mhat: out.mhat, vhat: out.vhat, rho: out.rho, rect: out.rect },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(out.fast, "fast"),
        edges: [],
        description: "The fast weights take the rectified adaptive step from the slow weights.",
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "fast", fast: out.fast, stepVec: out.stepVec },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(out.slow, "slow"),
        edges: [],
        description: out.applied
            ? `Lookahead folded the fast weights into the slow weights at step ${out.t}.`
            : `Lookahead skipped this step; the slow weights are unchanged.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { phase: "done", applied: out.applied, slow: out.slow, fast: out.fast, t: out.t },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain adaptive optimizer can take an oversized step before it has seen enough gradients, and its weights can oscillate. Ranger addresses both: it centers the gradient, warms up its step size with RAdam's variance estimate, and keeps a slow copy of the weights that only occasionally absorbs the fast weights. The result is steadier early training.",
        invariants: [
            "The centered gradient has zero mean across parameters.",
            "The RAdam rectification factor lies between zero and one.",
            "The slow weights change only when the step number is a multiple of the lookahead period.",
        ],
        correctness:
            "Subtracting the arithmetic mean makes the centered gradients sum to zero. The rectification factor is derived from the effective sample size rho; it is zero during warmup and approaches one as rho grows, so early steps are damped. The fast weights are the slow weights minus the learning rate times the rectified moment ratio. Lookahead then moves the slow weights by the interpolation factor alpha toward the fast weights, which is a convex combination because alpha lies in (0,1).",
        complexityRationale:
            "Each phase scans the d parameters a constant number of times, so time is O(d). The moment, fast, and slow vectors require O(d) space.",
        uses: [
            "Training convolutional and transformer vision models",
            "Replacing a stock Adam step with a warmer, steadier update",
            "Teaching composed optimizers and variance rectification",
        ],
        references: [
            "Zhang et al., Ranger: Synergistic Combination of RAdam and Lookahead, 2019",
            "Liu et al., On the Variance of the Adaptive Learning Rate and Beyond, ICLR 2020",
        ],
        workedExample:
            "With gradients 0.5, 0.2, negative 0.4, 0.1 the mean is 0.1, so the centered gradients are 0.4, 0.1, negative 0.5, 0. At step five the rectification factor is about 0.16 and the fast weights move a small distance from the slow weights; because five is the lookahead period, the slow weights move half way toward them.",
    },
    id: "ranger-optimizer",
    name: "Ranger Optimizer",
    category: "ml-ai",
    complexity: { time: "O(d)", space: "O(d)" },
    defaultInput: {
        params: [0.4, -0.3, 0.8, -0.6],
        grads: [0.5, 0.2, -0.4, 0.1],
        lr: 0.01,
        beta1: 0.9,
        beta2: 0.9,
        alpha: 0.5,
        lookaheadEvery: 5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read parameters, gradients, moments, and the step number",
        "center the gradients by subtracting their mean",
        "update first and second moment estimates",
        "bias-correct the moments and compute RAdam rectification",
        "form the fast weights with the rectified adaptive step",
        "every few steps interpolate the slow weights toward the fast weights",
        "done: report the updated slow weights",
    ],
};

export default module;
