/**
 * logistic-regression-gradient-descent.test.ts - Reference fit, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./logistic-regression-gradient-descent";
import type { VisualFrame } from "@/types";

type Point = [number, number];
interface Input {
    points: Point[];
    labels: number[];
    epochs: number;
    learningRate: number;
}

function sigmoid(z: number): number {
    return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

/** Independent batch-gradient replay. */
function reference(input: Input) {
    let w0 = 0;
    let w1 = 0;
    let b = 0;
    const n = Math.max(1, input.points.length);
    for (let epoch = 0; epoch < input.epochs; epoch += 1) {
        let g0 = 0;
        let g1 = 0;
        let gb = 0;
        for (let i = 0; i < input.points.length; i += 1) {
            const p = input.points[i] ?? [0, 0];
            const diff = sigmoid(w0 * p[0] + w1 * p[1] + b) - (input.labels[i] ?? 0);
            g0 += diff * p[0];
            g1 += diff * p[1];
            gb += diff;
        }
        w0 -= (input.learningRate * g0) / n;
        w1 -= (input.learningRate * g1) / n;
        b -= (input.learningRate * gb) / n;
    }
    return { w0, w1, b };
}

function checkFrames(frames: VisualFrame[], pointCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(pointCount);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["loss"]).toBeTypeOf("number");
        expect(Number.isFinite(frame.entities[0]?.x)).toBe(true);
        expect(Number.isFinite(frame.entities[0]?.y)).toBe(true);
        for (const entity of frame.entities) {
            expect(["sorted", "error"]).toContain(entity.state);
        }
    });
}

describe("Logistic Regression Gradient Descent", () => {
    it("matches an independent reference fit", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["w0"]).toBeCloseTo(expected.w0, 10);
        expect(final?.["w1"]).toBeCloseTo(expected.w1, 10);
        expect(final?.["b"]).toBeCloseTo(expected.b, 10);
    });

    it("decreases the loss and classifies all separable points", () => {
        const input: Input = { ...(mod.defaultInput as Input), epochs: 400 };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const initialLoss = Number(frames[0]?.meta["loss"]);
        const finalLoss = Number(frames[frames.length - 1]?.meta["loss"]);
        expect(finalLoss).toBeLessThan(initialLoss);
        expect(finalLoss).toBeLessThan(0.1);
        expect(Number(frames[frames.length - 1]?.meta["accuracy"] ?? 0)).toBeGreaterThanOrEqual(0);
        const final = frames[frames.length - 1]?.meta;
        const w0 = Number(final?.["w0"]);
        const w1 = Number(final?.["w1"]);
        const b = Number(final?.["b"]);
        for (let i = 0; i < input.points.length; i += 1) {
            const p = input.points[i] ?? [0, 0];
            const predicted = sigmoid(w0 * p[0] + w1 * p[1] + b) >= 0.5 ? 1 : 0;
            expect(predicted).toBe(input.labels[i]);
        }
        const lastFrame = frames[frames.length - 1];
        expect(lastFrame?.entities.every((e) => e.state === "sorted")).toBe(true);
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
