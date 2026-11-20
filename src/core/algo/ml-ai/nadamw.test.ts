/**
 * nadamw.test.ts - Independent replay, frame shape, property checks, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./nadamw";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function reference(
    points: Point[],
    lr: number,
    b1: number,
    b2: number,
    wd: number,
    epochs: number,
) {
    let w = 0;
    let b = 0;
    let mW = 0;
    let mB = 0;
    let vW = 0;
    let vB = 0;
    const eps = 1e-8;
    for (let epoch = 1; epoch <= epochs; epoch += 1) {
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
        const decay = 1 - lr * wd;
        w *= decay;
        b *= decay;
        mW = b1 * mW + (1 - b1) * dw;
        mB = b1 * mB + (1 - b1) * db;
        vW = b2 * vW + (1 - b2) * dw * dw;
        vB = b2 * vB + (1 - b2) * db * db;
        const bc1 = 1 - Math.pow(b1, epoch);
        const bc2 = 1 - Math.pow(b2, epoch);
        const nesterovW = (b1 * mW + (1 - b1) * dw) / bc1;
        const nesterovB = (b1 * mB + (1 - b1) * db) / bc1;
        const denomW = Math.sqrt(vW / bc2) + eps;
        const denomB = Math.sqrt(vB / bc2) + eps;
        const stepSize = lr / bc1;
        w -= stepSize * (nesterovW / denomW);
        b -= stepSize * (nesterovB / denomB);
    }
    const loss =
        points.reduce((acc, [x, y]) => acc + 0.5 * (w * x + b - y) ** 2, 0) /
        Math.max(1, points.length);
    return { w, b, loss, mW, mB, vW, vB };
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
        expect(typeof frame.meta["mW"]).toBe("number");
        expect(typeof frame.meta["decayFactor"] === "number" || frame.stepNumber === 0).toBe(true);
    });
}

describe("NadamW", () => {
    it("matches an independent replay and decreases the loss", () => {
        const input = mod.defaultInput as {
            points: Point[];
            learningRate: number;
            beta1: number;
            beta2: number;
            weightDecay: number;
            epochs: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(
            input.points,
            input.learningRate,
            input.beta1,
            input.beta2,
            input.weightDecay,
            input.epochs,
        );
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["w"])).toBeCloseTo(expected.w, 10);
        expect(Number(last?.["b"])).toBeCloseTo(expected.b, 10);
        expect(Number(last?.["mW"])).toBeCloseTo(expected.mW, 10);
        expect(Number(last?.["vW"])).toBeCloseTo(expected.vW, 10);
        expect(Number(last?.["loss"])).toBeCloseTo(expected.loss, 10);
        expect(Number(last?.["loss"])).toBeLessThan(Number(frames[0]?.meta["initialLoss"]));
    });

    it("applies decoupled decay to the parameters before the gradient step", () => {
        const input = mod.defaultInput as {
            points: Point[];
            learningRate: number;
            weightDecay: number;
            epochs: number;
            beta1: number;
            beta2: number;
        };
        const noDecay = [...mod.run({ ...input, weightDecay: 0 })];
        const withDecay = [...mod.run({ ...input, weightDecay: 0.5 })];
        const wNo = Number(noDecay[noDecay.length - 1]?.meta["w"]);
        const wYes = Number(withDecay[withDecay.length - 1]?.meta["w"]);
        expect(Math.abs(wYes)).toBeLessThan(Math.abs(wNo));
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
