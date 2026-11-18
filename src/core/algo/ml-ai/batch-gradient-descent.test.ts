/**
 * batch-gradient-descent.test.ts - Independent reference, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./batch-gradient-descent";
import type { VisualFrame } from "@/types";

type Point = [number, number];

/** Independent replay of the same full-batch update rule. */
function reference(points: Point[], lr: number, epochs: number) {
    let w = 0;
    let b = 0;
    for (let epoch = 0; epoch < epochs; epoch += 1) {
        let dw = 0;
        let db = 0;
        for (const [x, y] of points) {
            const err = w * x + b - y;
            dw += err * x;
            db += err;
        }
        const n = Math.max(1, points.length);
        w -= (lr * dw) / n;
        b -= (lr * db) / n;
    }
    const loss =
        points.reduce((acc, [x, y]) => acc + 0.5 * (w * x + b - y) ** 2, 0) /
        Math.max(1, points.length);
    return { w, b, loss };
}

function checkFrames(frames: VisualFrame[], pointCount: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(pointCount + 2);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([
            {
                id: "fit-line",
                sourceId: "fit-start",
                targetId: "fit-end",
                label: "y = wx + b",
                state: "path",
                directed: false,
            },
        ]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("BatchGradientDescent", () => {
    it("matches an independent replay and reduces the loss", () => {
        const input = mod.defaultInput as { points: Point[]; learningRate: number; epochs: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(input.points, input.learningRate, input.epochs);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["w"])).toBeCloseTo(expected.w, 10);
        expect(Number(finalMeta?.["b"])).toBeCloseTo(expected.b, 10);
        expect(Number(finalMeta?.["loss"])).toBeCloseTo(expected.loss, 10);
        expect(Number(startLoss(frames))).toBeGreaterThan(Number(finalMeta?.["loss"]));
        expect(finalMeta?.["converged"]).toBe(true);
        expect(Number(finalMeta?.["w"])).toBeCloseTo(2, 1);
        expect(Number(finalMeta?.["b"])).toBeCloseTo(1, 1);
    });

    it("agrees with the reference across several learning rates", () => {
        const points: Point[] = [
            [-2, -3],
            [-1, -1],
            [0, 1],
            [1, 3],
            [2, 5],
        ];
        for (const lr of [0.01, 0.03, 0.08]) {
            const frames = [...mod.run({ points, learningRate: lr, epochs: 25 })];
            checkFrames(frames, points.length);
            const expected = reference(points, lr, 25);
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

function startLoss(frames: VisualFrame[]): number {
    return Number(frames[0]?.meta["initialLoss"] ?? 0);
}
