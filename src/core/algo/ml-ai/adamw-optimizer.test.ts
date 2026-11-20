/**
 * adamw-optimizer.test.ts - Exact AdamW formula replay, decoupled-decay
 * property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./adamw-optimizer";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(5);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(5);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent replay of the AdamW moment and parameter recurrences. */
function reference(
    theta0: number,
    target: number,
    lr: number,
    beta1: number,
    beta2: number,
    eps: number,
    decay: number,
    steps: number,
): number[] {
    const thetas: number[] = [];
    let theta = theta0;
    let m = 0;
    let v = 0;
    for (let t = 1; t <= steps; t += 1) {
        const g = 2 * (theta - target);
        m = beta1 * m + (1 - beta1) * g;
        v = beta2 * v + (1 - beta2) * g * g;
        const mh = m / (1 - beta1 ** t);
        const vh = v / (1 - beta2 ** t);
        theta = theta - (lr * mh) / (Math.sqrt(vh) + eps) - lr * decay * theta;
        thetas.push(theta);
    }
    return thetas;
}

describe("AdamWOptimizer", () => {
    it("matches an independent moment replay at every step", () => {
        const input = mod.defaultInput as {
            theta: number;
            target: number;
            learningRate: number;
            beta1: number;
            beta2: number;
            epsilon: number;
            weightDecay: number;
            steps: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const thetas = reference(
            input.theta,
            input.target,
            input.learningRate,
            input.beta1,
            input.beta2,
            input.epsilon,
            input.weightDecay,
            input.steps,
        );
        expect(frames.length).toBe(thetas.length + 2);
        thetas.forEach((expected, k) => {
            expect(Number(frames[k + 1]?.meta["theta"])).toBeCloseTo(expected, 9);
        });
    });

    it("applies decoupled decay multiplicatively when the gradient is zero", () => {
        const lr = 0.1;
        const decay = 0.2;
        const theta0 = 5;
        const single = [...mod.run({ theta: theta0, target: theta0, learningRate: lr, weightDecay: decay, steps: 1 })];
        checkFrames(single);
        expect(Number(single[1]?.meta["gradient"])).toBeCloseTo(0, 12);
        expect(Number(single[1]?.meta["theta"])).toBeCloseTo(theta0 * (1 - lr * decay), 9);

        // With no decay and a zero gradient the parameter must stay put.
        const none = [...mod.run({ theta: theta0, target: theta0, learningRate: lr, weightDecay: 0, steps: 6 })];
        checkFrames(none);
        for (let t = 1; t <= 6; t += 1) {
            expect(Number(none[t]?.meta["gradient"])).toBeCloseTo(0, 12);
            expect(Number(none[t]?.meta["theta"])).toBeCloseTo(theta0, 12);
        }
    });

    it("reduces loss on the quadratic objective", () => {
        const frames = [...mod.run({ theta: 9, target: 2, learningRate: 0.1, steps: 40 })];
        checkFrames(frames);
        const firstLoss = Number(frames[0]?.meta["loss"]);
        const lastLoss = Number(frames[frames.length - 1]?.meta["loss"]);
        expect(lastLoss).toBeLessThan(firstLoss);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
