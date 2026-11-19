/**
 * lars.test.ts - Independent replay, frame shape, property checks, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lars";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function reference(points: Point[], lr: number, wd: number, epochs: number) {
    let w = 1;
    let b = 0.5;
    const eps = 1e-8;
    let localLR = 0;
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
        const paramNorm = Math.hypot(w, b);
        const gradNorm = Math.hypot(dw, db);
        localLR = (lr * paramNorm) / (gradNorm + wd * paramNorm + eps);
        w -= localLR * (dw + wd * w);
        b -= localLR * (db + wd * b);
    }
    const loss =
        points.reduce((acc, [x, y]) => acc + 0.5 * (w * x + b - y) ** 2, 0) /
        Math.max(1, points.length);
    return { w, b, loss, localLR };
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
        expect(typeof frame.meta["localLR"]).toBe("number");
    });
}

describe("LARS", () => {
    it("matches an independent replay and decreases the loss", () => {
        const input = mod.defaultInput as {
            points: Point[];
            learningRate: number;
            weightDecay: number;
            epochs: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(input.points, input.learningRate, input.weightDecay, input.epochs);
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["w"])).toBeCloseTo(expected.w, 10);
        expect(Number(last?.["b"])).toBeCloseTo(expected.b, 10);
        expect(Number(last?.["localLR"])).toBeCloseTo(expected.localLR, 10);
        expect(Number(last?.["loss"])).toBeCloseTo(expected.loss, 10);
        expect(Number(last?.["loss"])).toBeLessThan(Number(frames[0]?.meta["initialLoss"]));
    });

    it("scales the local rate by the weight to gradient norm ratio", () => {
        const points: Point[] = [
            [0, 2],
            [1, 0],
            [2, 3],
            [3, 1],
        ];
        const frames = [...mod.run({ points, epochs: 10 })];
        checkFrames(frames, points.length);
        const first = frames[1];
        expect(first).toBeDefined();
        const localLR = Number(first?.meta["localLR"]);
        const paramNorm = Number(first?.meta["paramNorm"]);
        const gradNorm = Number(first?.meta["gradNorm"]);
        const expected = (0.1 * paramNorm) / (gradNorm + 0.0001 * paramNorm + 1e-8);
        expect(localLR).toBeCloseTo(expected, 10);
        expect(localLR).toBeGreaterThan(0);
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
