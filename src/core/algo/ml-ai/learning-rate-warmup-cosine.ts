/**
 * learning-rate-warmup-cosine.ts - Linear Warmup with Cosine Decay
 *
 * A standard learning-rate schedule: ramp linearly from zero to a peak during
 * warmup, then follow a cosine curve down to a minimum. Each bar shows the
 * rate at one training step.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Schedule {
    steps: number;
    warmup: number;
    maxLr: number;
    minLr: number;
}

function rateAt(t: number, cfg: Schedule): number {
    if (cfg.warmup > 0 && t < cfg.warmup) {
        return (cfg.maxLr * (t + 1)) / cfg.warmup;
    }
    const decaySteps = Math.max(1, cfg.steps - cfg.warmup - 1);
    const progress = Math.min(1, Math.max(0, (t - cfg.warmup) / decaySteps));
    return cfg.minLr + 0.5 * (cfg.maxLr - cfg.minLr) * (1 + Math.cos(Math.PI * progress));
}

function makeBars(rates: number[], current: number, done: boolean): VisualEntity[] {
    return rates.map((rate, index) => ({
        id: `lr-${index}`,
        type: "bar" as const,
        label: rate.toFixed(3),
        value: done || index <= current ? rate : 0,
        state: done ? ("sorted" as const) : index === current ? ("active" as const) : index < current ? ("sorted" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        steps?: number;
        warmup?: number;
        maxLr?: number;
        minLr?: number;
    } | null) ?? {};
    const steps = Math.max(2, Math.floor(typeof task.steps === "number" ? task.steps : 20));
    const warmup = Math.max(0, Math.min(steps - 1, Math.floor(typeof task.warmup === "number" ? task.warmup : 4)));
    const maxLr = typeof task.maxLr === "number" && task.maxLr > 0 ? task.maxLr : 0.001;
    const minLrRaw = typeof task.minLr === "number" ? task.minLr : maxLr * 0.01;
    const minLr = Math.max(0, Math.min(minLrRaw, maxLr));
    const cfg: Schedule = { steps, warmup, maxLr, minLr };
    const rates = Array.from({ length: steps }, (_, t) => rateAt(t, cfg));

    yield {
        stepNumber: 0,
        entities: makeBars(rates, -1, false),
        edges: [],
        description: `Building a ${steps}-step schedule with ${warmup} warmup step(s), peaking at ${maxLr}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { steps, warmup, maxLr, minLr, step: 0, lr: 0 },
    };

    for (let t = 0; t < steps; t += 1) {
        yield {
            stepNumber: t + 1,
            entities: makeBars(rates, t, false),
            edges: [],
            description: `Step ${t}: ${t < warmup ? "warmup" : "cosine decay"} learning rate = ${rates[t]?.toFixed(6)}.`,
            codeLineNumber: t < warmup ? 2 : 4,
            layout: "array",
            meta: { steps, warmup, maxLr, minLr, step: t, lr: Number((rates[t] ?? 0).toFixed(8)) },
        };
    }

    yield {
        stepNumber: steps + 1,
        entities: makeBars(rates, steps - 1, true),
        edges: [],
        description: `Schedule complete: peak ${maxLr} at step ${warmup - 1}, decaying to ${(rates[steps - 1] ?? 0).toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            steps,
            warmup,
            maxLr,
            minLr,
            step: steps - 1,
            lr: Number((rates[steps - 1] ?? 0).toFixed(8)),
            peak: Number((rates[warmup > 0 ? warmup - 1 : 0] ?? 0).toFixed(8)),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A large learning rate at the start of training can destabilize a randomly initialized model, while a rate that never decays prevents fine convergence. Warmup ramps the rate up over a few steps, and cosine decay then eases it smoothly toward a small floor.",
        invariants: [
            "Every rate lies between the minimum and the maximum.",
            "During warmup the rate rises linearly, reaching the maximum at the last warmup step.",
            "After warmup the rate follows a half cosine and never increases.",
        ],
        correctness:
            "The schedule is a closed-form function of the step index. Warmup gives lr = max * (t + 1) / warmup, and the decay gives min + (max - min) * (1 + cos(pi * progress)) / 2 with progress from zero to one. These formulas hit the maximum exactly at the transition and the minimum at the final step, so monotonicity and endpoints are guaranteed.",
        complexityRationale:
            "Computing one rate is constant time, so the whole schedule takes O(steps) time and O(steps) space to display as bars.",
        uses: [
            "Warming up large-batch training of transformer language models",
            "Stabilizing stochastic gradient descent in the early epochs",
            "Decaying the rate smoothly for fine-tuning runs",
        ],
        references: [
            "Goyal et al., Accurate, Large Minibatch SGD, 2017",
            "Loshchilov and Hutter, SGDR: Stochastic Gradient Descent with Warm Restarts, 2017",
        ],
        workedExample:
            "With 20 steps, 4 warmup steps, peak 0.001, and floor 0.00001, the first four rates are 0.00025, 0.0005, 0.00075, 0.001. The remaining steps trace a cosine from 0.001 down toward the floor.",
    },
    id: "learning-rate-warmup-cosine",
    name: "Learning Rate Warmup with Cosine Decay",
    category: "ml-ai",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { steps: 20, warmup: 4, maxLr: 0.001, minLr: 0.00001 },
    visualType: "array",
    run,
    pseudocode: [
        "set the step counter to zero and choose peak and floor rates",
        "if the step is within warmup",
        "set the rate to peak times (step plus one) over warmup",
        "otherwise compute cosine progress from warmup to the end",
        "set the rate to floor plus half the range times one plus cosine",
        "record the rate for this step and advance",
        "done: report the full schedule",
    ],
};

export default module;
