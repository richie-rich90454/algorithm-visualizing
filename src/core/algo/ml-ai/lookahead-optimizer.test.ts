/**
 * lookahead-optimizer.test.ts - Independent replay, frame shape, properties, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lookahead-optimizer";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function reference(
    points: Point[],
    innerRate: number,
    alpha: number,
    k: number,
    epochs: number,
) {
    let slowW = 0;
    let slowB = 0;
    let fastW = slowW;
    let fastB = slowB;
    for (let epoch = 0; epoch < epochs; epoch += 1) {
        fastW = slowW;
        fastB = slowB;
        for (let inner = 0; inner < k; inner += 1) {
            let dw = 0;
            let db = 0;
            for (const [x, y] of points) {
                const err = fastW * x + fastB - y;
                dw += err * x;
                db += err;
            }
            const n = Math.max(1, points.length);
            fastW -= (innerRate * dw) / n;
            fastB -= (innerRate * db) / n;
        }
        slowW += alpha * (fastW - slowW);
        slowB += alpha * (fastB - slowB);
    }
    const loss =
        points.reduce((acc, [x, y]) => acc + 0.5 * (slowW * x + slowB - y) ** 2, 0) /
        Math.max(1, points.length);
    return { slowW, slowB, fastW, fastB, loss };
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
        expect(typeof frame.meta["slowW"]).toBe("number");
        expect(typeof frame.meta["fastW"]).toBe("number");
        expect(Number(frame.meta["w"])).toBe(Number(frame.meta["slowW"]));
    });
}

describe("Lookahead Optimizer", () => {
    it("matches an independent replay and decreases the loss", () => {
        const input = mod.defaultInput as {
            points: Point[];
            innerRate: number;
            alpha: number;
            k: number;
            epochs: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(
            input.points,
            input.innerRate,
            input.alpha,
            input.k,
            input.epochs,
        );
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["w"])).toBeCloseTo(expected.slowW, 10);
        expect(Number(last?.["b"])).toBeCloseTo(expected.slowB, 10);
        expect(Number(last?.["fastW"])).toBeCloseTo(expected.fastW, 10);
        expect(Number(last?.["fastB"])).toBeCloseTo(expected.fastB, 10);
        expect(Number(last?.["loss"])).toBeCloseTo(expected.loss, 10);
        expect(Number(last?.["loss"])).toBeLessThan(Number(frames[0]?.meta["initialLoss"]));
    });

    it("keeps slow weights between the old slow weights and the fast weights", () => {
        const input = mod.defaultInput as {
            points: Point[];
            innerRate: number;
            alpha: number;
            k: number;
            epochs: number;
        };
        const frames = [...mod.run({ ...input, alpha: 0.5, epochs: 6 })];
        for (let i = 2; i < frames.length - 1; i += 1) {
            const prevSlow = Number(frames[i - 1]?.meta["slowW"]);
            const curSlow = Number(frames[i]?.meta["slowW"]);
            const curFast = Number(frames[i]?.meta["fastW"]);
            const expected = prevSlow + 0.5 * (curFast - prevSlow);
            expect(curSlow).toBeCloseTo(expected, 10);
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
