/**
 * exponential-moving-average-weights.ts - Exponential Moving Average of Weights
 *
 * maintains a shadow copy of the parameters and nudges it a small fraction toward
 * the live weights after every step. The result is a smoothed model that usually
 * generalizes better than the last iterate. The demo uses a deterministic noisy
 * trajectory around a known target so the smoothing is measurable.
 *
 * Time:  O(steps * d) for d parameters
 * Space: O(d) for the shadow copy
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface EmaInput {
    target?: number[];
    steps?: number;
    decay?: number;
    amplitude?: number;
}

function makeBars(theta: number[], shadow: number[], target: number[]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < theta.length; i += 1) {
        entities.push({
            id: `live-${i}`,
            type: "bar" as const,
            label: `live ${(theta[i] ?? 0).toFixed(3)}`,
            value: theta[i] ?? 0,
            state: "active",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "live" },
        });
        entities.push({
            id: `shadow-${i}`,
            type: "bar" as const,
            label: `ema ${(shadow[i] ?? 0).toFixed(3)}`,
            value: shadow[i] ?? 0,
            state: "sorted" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "shadow" },
        });
        entities.push({
            id: `target-${i}`,
            type: "bar" as const,
            label: `target ${(target[i] ?? 0).toFixed(2)}`,
            value: target[i] ?? 0,
            state: "highlight",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "target" },
        });
    }
    return entities;
}

function mse(a: number[], b: number[]): number {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        total += diff * diff;
    }
    return total / Math.max(1, a.length);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as EmaInput | null) ?? {};
    const target = task.target?.length ? task.target.slice() : [1, -2, 0.5, 3];
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 24;
    const decay = typeof task.decay === "number" && task.decay > 0 && task.decay < 1 ? task.decay : 0.9;
    const amplitude = typeof task.amplitude === "number" && task.amplitude >= 0 ? task.amplitude : 1.2;
    const dim = target.length;
    const liveAt = (t: number): number[] =>
        target.map((center, i) => center + amplitude * Math.sin((t + 1) * (i + 1) * 0.55 + i));

    let theta = liveAt(0);
    let shadow = theta.slice();
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(theta, shadow, target),
        edges: [],
        description: `Initialize live weights and an exponential moving average with decay ${decay}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, decay, mseLive: mse(theta, target), mseShadow: mse(shadow, target), live: theta.slice(), shadow: shadow.slice(), target: target.slice() },
    };
    step += 1;

    for (let t = 1; t <= steps; t += 1) {
        theta = liveAt(t);
        shadow = shadow.map((value, i) => decay * value + (1 - decay) * (theta[i] ?? 0));
        yield {
            stepNumber: step,
            entities: makeBars(theta, shadow, target),
            edges: [],
            description: `Step ${t}: decay ${decay}, live error ${mse(theta, target).toFixed(4)}, smoothed error ${mse(shadow, target).toFixed(4)}.`,
            codeLineNumber: t === steps ? 4 : 2,
            layout: "array",
            meta: {
                step: t,
                decay,
                mseLive: mse(theta, target),
                mseShadow: mse(shadow, target),
                live: theta.slice(),
                shadow: shadow.slice(),
                target: target.slice(),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, shadow, target),
        edges: [],
        description: `Done: the smoothed weights have error ${mse(shadow, target).toFixed(4)} versus ${mse(theta, target).toFixed(4)} for the raw iterate.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { step, decay, mseLive: mse(theta, target), mseShadow: mse(shadow, target), live: theta.slice(), shadow: shadow.slice(), target: target.slice(), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A running average of the weights over training acts like a low-pass filter on the optimization path. Instead of keeping the last, possibly noisy iterate, we keep a shadow vector that blends a little of each new iterate into the old average. The shadow usually sits closer to the center of the loss basin and generalizes better.",
        invariants: [
            "The shadow starts equal to the first live weights.",
            "Each update is a convex combination of the old shadow and the new weights.",
            "A larger decay gives a longer memory and a smoother shadow.",
        ],
        correctness:
            "Expanding the recurrence shows the shadow equals a weighted sum of all past iterates, with weights that sum to one and decay geometrically. On a trajectory oscillating around a fixed target, averaging cancels much of the oscillation, so the shadow's mean squared error stays below the raw iterate's. The test reproduces the recurrence independently and checks both the exact shadow values and this smoothing property.",
        complexityRationale:
            "Each step updates d shadow coordinates with constant work, so time is O(steps times d). Only one extra vector of length d is kept, giving O(d) space beyond the live weights.",
        uses: [
            "Averaging checkpoints in deep learning frameworks",
            "Mean teachers and self-training pipelines",
            "Reducing validation loss noise near the end of training",
        ],
        references: [
            "Polyak and Juditsky, Acceleration of Stochastic Approximation by Averaging, 1992",
            "Tarvainen and Valpola, Mean Teachers, NeurIPS, 2017",
        ],
        workedExample:
            "With a single weight oscillating between 0.8 and 1.2 around a target of 1 and decay 0.9, the shadow moves only about one tenth of the gap each step. After many oscillations it settles near 1, while the live weight still swings by 0.2, so the averaged model is more stable.",
    },
    id: "exponential-moving-average-weights",
    name: "Exponential Moving Average of Weights",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d)" },
    defaultInput: { target: [1, -2, 0.5, 3], steps: 24, decay: 0.9, amplitude: 1.2 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize weights and set the shadow to the first weights",
        "repeat for each training step",
        "produce the next live weights from the trajectory",
        "set shadow to decay times shadow plus one minus decay times live",
        "record the error of both the live and shadow weights",
        "done: report the smoothed weights and their error",
    ],
};

export default module;
