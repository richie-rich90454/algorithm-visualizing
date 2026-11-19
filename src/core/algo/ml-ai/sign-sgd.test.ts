/**
 * sign-sgd.test.ts - Independent replay, frame shape, property checks, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./sign-sgd";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function reference(points: Point[], lr: number, epochs: number) {
    let w = 0;
    let b = 0;
    let signW = 0;
    let signB = 0;
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
        signW = dw > 0 ? 1 : dw < 0 ? -1 : 0;
        signB = db > 0 ? 1 : db < 0 ? -1 : 0;
        w -= lr * signW;
        b -= lr * signB;
    }
    const loss =
        points.reduce((acc, [x, y]) => acc + 0.5 * (w * x + b - y) ** 2, 0) /
        Math.max(1, points.length);
    return { w, b, loss, signW, signB };
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
        expect(typeof frame.meta["signW"]).toBe("number");
        expect([-1, 0, 1]).toContain(Number(frame.meta["signW"]));
    });
}

describe("SignSGD", () => {
    it("matches an independent replay and decreases the loss", () => {
        const input = mod.defaultInput as { points: Point[]; learningRate: number; epochs: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(input.points, input.learningRate, input.epochs);
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["w"])).toBeCloseTo(expected.w, 10);
        expect(Number(last?.["b"])).toBeCloseTo(expected.b, 10);
        expect(Number(last?.["signW"])).toBe(expected.signW);
        expect(Number(last?.["loss"])).toBeCloseTo(expected.loss, 10);
        expect(Number(last?.["loss"])).toBeLessThan(Number(frames[0]?.meta["initialLoss"]));
    });

    it("moves each parameter by exactly one learning-rate step", () => {
        const input = mod.defaultInput as { points: Point[]; learningRate: number; epochs: number };
        const frames = [...mod.run({ ...input, epochs: 3 })];
        for (let i = 2; i < frames.length - 1; i += 1) {
            const prev = frames[i - 1];
            const cur = frames[i];
            if (prev && cur && Number(cur.meta["signW"]) !== 0) {
                const delta = Math.abs(Number(cur.meta["w"]) - Number(prev.meta["w"]));
                expect(delta).toBeCloseTo(input.learningRate, 12);
            }
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
