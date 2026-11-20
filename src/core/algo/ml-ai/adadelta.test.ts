/**
 * adadelta.test.ts - Independent replay, frame shape, property checks, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./adadelta";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function reference(points: Point[], lr: number, rho: number, epochs: number) {
    let w = 0;
    let b = 0;
    let accW = 0;
    let accB = 0;
    let deltaW = 0;
    let deltaB = 0;
    const eps = 1e-6;
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
        const updateW =
            -lr * ((Math.sqrt(deltaW) + eps) / (Math.sqrt(accW) + eps)) * dw;
        const updateB =
            -lr * ((Math.sqrt(deltaB) + eps) / (Math.sqrt(accB) + eps)) * db;
        accW = rho * accW + (1 - rho) * dw * dw;
        accB = rho * accB + (1 - rho) * db * db;
        deltaW = rho * deltaW + (1 - rho) * updateW * updateW;
        deltaB = rho * deltaB + (1 - rho) * updateB * updateB;
        w += updateW;
        b += updateB;
    }
    const loss =
        points.reduce((acc, [x, y]) => acc + 0.5 * (w * x + b - y) ** 2, 0) /
        Math.max(1, points.length);
    return { w, b, loss, accW, accB, deltaW, deltaB };
}

function checkFrames(frames: VisualFrame[], pointCount: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(pointCount + 2);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(1);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        const line = frame.codeLineNumber ?? -1;
        expect(line).toBeGreaterThanOrEqual(0);
        expect(line).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(typeof frame.meta["accW"]).toBe("number");
        expect(typeof frame.meta["deltaW"]).toBe("number");
    });
}

describe("Adadelta", () => {
    it("matches an independent replay and decreases the loss", () => {
        const input = mod.defaultInput as {
            points: Point[];
            learningRate: number;
            rho: number;
            epochs: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(input.points, input.learningRate, input.rho, input.epochs);
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["w"])).toBeCloseTo(expected.w, 10);
        expect(Number(last?.["b"])).toBeCloseTo(expected.b, 10);
        expect(Number(last?.["accW"])).toBeCloseTo(expected.accW, 10);
        expect(Number(last?.["accB"])).toBeCloseTo(expected.accB, 10);
        expect(Number(last?.["loss"])).toBeCloseTo(expected.loss, 10);
        expect(Number(last?.["loss"])).toBeLessThan(Number(frames[0]?.meta["initialLoss"]));
    });

    it("agrees with the reference for other decay values", () => {
        const points: Point[] = [
            [0, 2],
            [1, 0],
            [2, 3],
            [3, 1],
        ];
        for (const rho of [0.5, 0.8, 0.99]) {
            const frames = [...mod.run({ points, rho, epochs: 50 })];
            checkFrames(frames, points.length);
            const expected = reference(points, 0.1, rho, 50);
            const last = frames[frames.length - 1]?.meta;
            expect(Number(last?.["w"])).toBeCloseTo(expected.w, 10);
            expect(Number(last?.["b"])).toBeCloseTo(expected.b, 10);
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
