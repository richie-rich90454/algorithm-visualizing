/**
 * adam-optimizer.test.ts - Reference trajectory, bias correction, frame shape.
 */

import { describe, expect, it } from "vitest";
import mod from "./adam-optimizer";
import type { VisualFrame } from "@/types";

interface Input {
    target: number;
    start: number;
    iterations: number;
    learningRate: number;
    beta1: number;
    beta2: number;
    epsilon: number;
}

/** Independent replay of the Adam update rule. */
function reference(input: Input) {
    let w = input.start;
    let m = 0;
    let v = 0;
    const trajectory: number[] = [w];
    for (let t = 1; t <= input.iterations; t += 1) {
        const g = 2 * (w - input.target);
        m = input.beta1 * m + (1 - input.beta1) * g;
        v = input.beta2 * v + (1 - input.beta2) * g * g;
        const mHat = m / (1 - Math.pow(input.beta1, t));
        const vHat = v / (1 - Math.pow(input.beta2, t));
        w -= (input.learningRate * mHat) / (Math.sqrt(vHat) + input.epsilon);
        trajectory.push(w);
    }
    return { w, trajectory };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["w"]).toBeTypeOf("number");
        expect(Number.isFinite(frame.entities[0]?.y)).toBe(true);
    });
    for (let i = 1; i < frames.length; i += 1) {
        expect(frames[i]?.entities.length).toBeGreaterThanOrEqual(frames[i - 1]?.entities.length ?? 0);
    }
}

describe("Adam Optimizer", () => {
    it("matches an independent reference trajectory", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["w"]).toBeCloseTo(expected.w, 10);
        for (let t = 1; t <= input.iterations; t += 1) {
            const frame = frames[t];
            expect(Number(frame?.meta["w"])).toBeCloseTo(expected.trajectory[t] ?? 0, 10);
        }
    });

    it("applies bias correction and descends the loss", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const first = frames[1]?.meta;
        expect(first?.["mHat"]).toBeTypeOf("number");
        expect(first?.["vHat"]).toBeTypeOf("number");
        const m = Number(first?.["m"]);
        const mHat = Number(first?.["mHat"]);
        expect(mHat).toBeCloseTo(m / (1 - input.beta1), 12);
        expect(Number(frames[frames.length - 1]?.meta["loss"])).toBeLessThan(
            Number(frames[0]?.meta["loss"]),
        );
    });

    it("converges toward the target and terminates cleanly", () => {
        const frames = [...mod.run({ target: 3, start: 0, iterations: 200, learningRate: 0.3, beta1: 0.9, beta2: 0.999, epsilon: 1e-8 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["w"])).toBeCloseTo(3, 2);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
