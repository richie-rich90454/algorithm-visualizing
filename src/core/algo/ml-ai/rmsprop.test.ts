/**
 * rmsprop.test.ts - Independent replay, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./rmsprop";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function reference(points: Point[], lr: number, decay: number, epochs: number) {
    let w = 0;
    let b = 0;
    let avgW = 0;
    let avgB = 0;
    const eps = 1e-8;
    for (let epoch = 0; epoch < epochs; epoch += 1) {
        let dw = 0;
        let db = 0;
        for (const [x, y] of points) {
            const err = w * x + b - y;
            dw += err * x;
            db += err;
        }
        const n = Math.max(1, points.length);
        dw /= n;
        db /= n;
        avgW = decay * avgW + (1 - decay) * dw * dw;
        avgB = decay * avgB + (1 - decay) * db * db;
        w -= (lr * dw) / (Math.sqrt(avgW) + eps);
        b -= (lr * db) / (Math.sqrt(avgB) + eps);
    }
    const loss =
        points.reduce((acc, [x, y]) => acc + 0.5 * (w * x + b - y) ** 2, 0) /
        Math.max(1, points.length);
    return { w, b, loss, avgW, avgB };
}

function checkFrames(frames: VisualFrame[], pointCount: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(pointCount + 2);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(1);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(typeof frame.meta["avgW"]).toBe("number");
        expect(typeof frame.meta["avgB"]).toBe("number");
    });
}

describe("RMSProp", () => {
    it("matches an independent replay and decreases the loss", () => {
        const input = mod.defaultInput as {
            points: Point[];
            learningRate: number;
            decay: number;
            epochs: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(input.points, input.learningRate, input.decay, input.epochs);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["w"])).toBeCloseTo(expected.w, 10);
        expect(Number(finalMeta?.["b"])).toBeCloseTo(expected.b, 10);
        expect(Number(finalMeta?.["loss"])).toBeCloseTo(expected.loss, 10);
        expect(Number(finalMeta?.["avgW"])).toBeCloseTo(expected.avgW, 12);
        expect(Number(finalMeta?.["avgB"])).toBeCloseTo(expected.avgB, 12);
        expect(Number(finalMeta?.["loss"])).toBeLessThan(Number(frames[0]?.meta["initialLoss"]));
    });

    it("agrees with the reference for other decay values", () => {
        const points: Point[] = [
            [0, 2],
            [1, 0],
            [2, 3],
            [3, 1],
        ];
        for (const decay of [0.5, 0.8, 0.99]) {
            const frames = [...mod.run({ points, decay, epochs: 20 })];
            checkFrames(frames, points.length);
            const expected = reference(points, 0.08, decay, 20);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(Number(finalMeta?.["w"])).toBeCloseTo(expected.w, 10);
            expect(Number(finalMeta?.["b"])).toBeCloseTo(expected.b, 10);
        }
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
