/**
 * ftrl.test.ts - Independent replay, frame shape, property checks, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./ftrl";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function sign(value: number): number {
    return value > 0 ? 1 : value < 0 ? -1 : 0;
}

function reference(
    points: Point[],
    lr: number,
    alpha: number,
    beta: number,
    lambda1: number,
    lambda2: number,
    epochs: number,
) {
    let w = 0;
    let b = 0;
    let nW = 0;
    let nB = 0;
    let zW = 0;
    let zB = 0;
    const eps = 1e-8;
    for (let epoch = 0; epoch < epochs; epoch += 1) {
        let dw = 0;
        let db = 0;
        for (const [x, y] of points) {
            const err = w * x + b - y;
            dw += err * x;
            db += err;
        }
        const count = Math.max(1, points.length);
        dw /= count;
        db /= count;
        const prevNW = nW;
        const prevNB = nB;
        nW += dw * dw;
        nB += db * db;
        const sigmaW = (Math.pow(nW, alpha) - Math.pow(prevNW, alpha)) / lr;
        const sigmaB = (Math.pow(nB, alpha) - Math.pow(prevNB, alpha)) / lr;
        zW += dw - sigmaW * w;
        zB += db - sigmaB * b;
        const denomW = (beta + Math.sqrt(nW) + eps) / lr + lambda2;
        const denomB = (beta + Math.sqrt(nB) + eps) / lr + lambda2;
        w = Math.abs(zW) > lambda1 ? -(zW - sign(zW) * lambda1) / denomW : 0;
        b = Math.abs(zB) > lambda1 ? -(zB - sign(zB) * lambda1) / denomB : 0;
    }
    const loss =
        points.reduce((acc, [x, y]) => acc + 0.5 * (w * x + b - y) ** 2, 0) /
        Math.max(1, points.length);
    return { w, b, loss, nW, nB, zW, zB };
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
        expect(typeof frame.meta["nW"]).toBe("number");
        expect(typeof frame.meta["zW"]).toBe("number");
    });
}

describe("FTRL-Proximal", () => {
    it("matches an independent replay and decreases the loss", () => {
        const input = mod.defaultInput as {
            points: Point[];
            learningRate: number;
            alpha: number;
            beta: number;
            lambda1: number;
            lambda2: number;
            epochs: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(
            input.points,
            input.learningRate,
            input.alpha,
            input.beta,
            input.lambda1,
            input.lambda2,
            input.epochs,
        );
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["w"])).toBeCloseTo(expected.w, 10);
        expect(Number(last?.["b"])).toBeCloseTo(expected.b, 10);
        expect(Number(last?.["nW"])).toBeCloseTo(expected.nW, 10);
        expect(Number(last?.["zW"])).toBeCloseTo(expected.zW, 10);
        expect(Number(last?.["loss"])).toBeCloseTo(expected.loss, 10);
        expect(Number(last?.["loss"])).toBeLessThan(Number(frames[0]?.meta["initialLoss"]));
    });

    it("the squared-gradient accumulators never decrease", () => {
        const input = mod.defaultInput as {
            points: Point[];
            epochs: number;
        };
        const frames = [...mod.run({ ...input, epochs: 12 })];
        for (let i = 2; i < frames.length - 1; i += 1) {
            const prev = Number(frames[i - 1]?.meta["nW"]);
            const cur = Number(frames[i]?.meta["nW"]);
            expect(cur).toBeGreaterThanOrEqual(prev);
        }
    });

    it("L1 regularization can drive small weights to exactly zero", () => {
        const input = mod.defaultInput as {
            points: Point[];
            learningRate: number;
            alpha: number;
            beta: number;
            epochs: number;
        };
        const frames = [...mod.run({ ...input, lambda1: 1000, epochs: 4 })];
        checkFrames(frames, input.points.length);
        expect(Number(frames[frames.length - 1]?.meta["w"])).toBe(0);
        expect(Number(frames[frames.length - 1]?.meta["b"])).toBe(0);
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
