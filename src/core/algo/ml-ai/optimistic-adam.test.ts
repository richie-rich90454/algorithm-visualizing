/**
 * optimistic-adam.test.ts - Independent replay, frame shape, property checks, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./optimistic-adam";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function reference(
    points: Point[],
    lr: number,
    b1: number,
    b2: number,
    optimism: number,
    epochs: number,
) {
    let w = 0;
    let b = 0;
    let mW = 0;
    let mB = 0;
    let vW = 0;
    let vB = 0;
    let prevDw = 0;
    let prevDb = 0;
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
        const optDw = dw + optimism * (dw - prevDw);
        const optDb = db + optimism * (db - prevDb);
        mW = b1 * mW + (1 - b1) * optDw;
        mB = b1 * mB + (1 - b1) * optDb;
        vW = b2 * vW + (1 - b2) * optDw * optDw;
        vB = b2 * vB + (1 - b2) * optDb * optDb;
        const mHatW = mW / (1 - Math.pow(b1, epoch));
        const mHatB = mB / (1 - Math.pow(b1, epoch));
        const vHatW = vW / (1 - Math.pow(b2, epoch));
        const vHatB = vB / (1 - Math.pow(b2, epoch));
        w -= (lr * mHatW) / (Math.sqrt(vHatW) + eps);
        b -= (lr * mHatB) / (Math.sqrt(vHatB) + eps);
        prevDw = dw;
        prevDb = db;
    }
    const loss =
        points.reduce((acc, [x, y]) => acc + 0.5 * (w * x + b - y) ** 2, 0) /
        Math.max(1, points.length);
    return { w, b, loss, mW, mB, vW, vB, prevDw, prevDb };
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
        expect(typeof frame.meta["vW"]).toBe("number");
        expect(typeof frame.meta["prevDw"]).toBe("number");
    });
}

describe("Optimistic Adam", () => {
    it("matches an independent replay and decreases the loss", () => {
        const input = mod.defaultInput as {
            points: Point[];
            learningRate: number;
            beta1: number;
            beta2: number;
            optimism: number;
            epochs: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(
            input.points,
            input.learningRate,
            input.beta1,
            input.beta2,
            input.optimism,
            input.epochs,
        );
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["w"])).toBeCloseTo(expected.w, 10);
        expect(Number(last?.["b"])).toBeCloseTo(expected.b, 10);
        expect(Number(last?.["mW"])).toBeCloseTo(expected.mW, 10);
        expect(Number(last?.["vW"])).toBeCloseTo(expected.vW, 10);
        expect(Number(last?.["prevDw"])).toBeCloseTo(expected.prevDw, 10);
        expect(Number(last?.["loss"])).toBeCloseTo(expected.loss, 10);
        expect(Number(last?.["loss"])).toBeLessThan(Number(frames[0]?.meta["initialLoss"]));
    });

    it("equals Adam on the first step and reacts to the optimism coefficient later", () => {
        const input = mod.defaultInput as {
            points: Point[];
            learningRate: number;
            beta1: number;
            beta2: number;
            optimism: number;
            epochs: number;
        };
        const low = [...mod.run({ ...input, optimism: 0 })];
        const high = [...mod.run({ ...input, optimism: 1 })];
        expect(Number(low[1]?.meta["w"])).toBeCloseTo(Number(high[1]?.meta["w"]), 10);
        expect(Number(low[low.length - 1]?.meta["w"])).not.toBeCloseTo(
            Number(high[high.length - 1]?.meta["w"]),
            6,
        );
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
