/**
 * stochastic-gradient-descent.test.ts - Reference trajectory, loss decrease, frame shape.
 */

import { describe, expect, it } from "vitest";
import mod from "./stochastic-gradient-descent";
import type { VisualFrame } from "@/types";

interface Input {
    points: number[];
    targets: number[];
    epochs: number;
    learningRate: number;
}

/** Independent replay of the SGD update rule. */
function reference(input: Input) {
    let w = 0;
    let b = 0;
    for (let epoch = 0; epoch < input.epochs; epoch += 1) {
        for (let i = 0; i < input.points.length; i += 1) {
            const x = input.points[i] ?? 0;
            const target = input.targets[i] ?? 0;
            const error = w * x + b - target;
            w -= input.learningRate * error * x;
            b -= input.learningRate * error;
        }
    }
    return { w, b };
}

function checkFrames(frames: VisualFrame[], pointCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(pointCount + 2);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(1);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["w"]).toBeTypeOf("number");
        expect(frame.meta["b"]).toBeTypeOf("number");
        expect(frame.meta["loss"]).toBeTypeOf("number");
        expect(Number.isFinite(frame.entities[0]?.x)).toBe(true);
        expect(Number.isFinite(frame.entities[0]?.y)).toBe(true);
    });
}

describe("Stochastic Gradient Descent", () => {
    it("matches an independent reference trajectory on the default input", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["w"]).toBeCloseTo(expected.w, 10);
        expect(final?.["b"]).toBeCloseTo(expected.b, 10);
    });

    it("monotonically reduces the loss and fits a linear data set", () => {
        const input: Input = {
            points: [0, 1, 2, 3, 4],
            targets: [1, 3, 5, 7, 9],
            epochs: 40,
            learningRate: 0.05,
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const initialLoss = Number(frames[0]?.meta["loss"]);
        const finalLoss = Number(frames[frames.length - 1]?.meta["loss"]);
        expect(finalLoss).toBeLessThan(initialLoss);
        expect(finalLoss).toBeLessThan(0.01);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["w"])).toBeCloseTo(2, 1);
        expect(Number(final?.["b"])).toBeCloseTo(1, 1);
    });

    it("handles a constant target and terminates cleanly", () => {
        const frames = [...mod.run({ points: [0, 0, 0], targets: [5, 5, 5], epochs: 20, learningRate: 0.1 })];
        checkFrames(frames, 3);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["b"])).toBeCloseTo(5, 1);
        expect(final?.["updates"]).toBe(60);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
