/**
 * rprop.test.ts - Independent replay, frame shape, property checks, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./rprop";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function sign(value: number): number {
    return value > 0 ? 1 : value < 0 ? -1 : 0;
}

function reference(
    points: Point[],
    initialStep: number,
    increase: number,
    decrease: number,
    epochs: number,
) {
    let w = 0;
    let b = 0;
    let stepW = initialStep;
    let stepB = initialStep;
    let prevSignW = 0;
    let prevSignB = 0;
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
        const sW = sign(dw);
        const sB = sign(db);
        if (sW * prevSignW > 0) {
            stepW *= increase;
        } else if (sW * prevSignW < 0) {
            stepW *= decrease;
        }
        if (sB * prevSignB > 0) {
            stepB *= increase;
        } else if (sB * prevSignB < 0) {
            stepB *= decrease;
        }
        w -= sW * stepW;
        b -= sB * stepB;
        prevSignW = sW;
        prevSignB = sB;
    }
    const loss =
        points.reduce((acc, [x, y]) => acc + 0.5 * (w * x + b - y) ** 2, 0) /
        Math.max(1, points.length);
    return { w, b, loss, stepW, stepB, prevSignW, prevSignB };
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
        expect(typeof frame.meta["stepW"]).toBe("number");
        expect(typeof frame.meta["prevSignW"]).toBe("number");
    });
}

describe("RProp", () => {
    it("matches an independent replay and decreases the loss", () => {
        const input = mod.defaultInput as {
            points: Point[];
            initialStep: number;
            increase: number;
            decrease: number;
            epochs: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(
            input.points,
            input.initialStep,
            input.increase,
            input.decrease,
            input.epochs,
        );
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["w"])).toBeCloseTo(expected.w, 10);
        expect(Number(last?.["b"])).toBeCloseTo(expected.b, 10);
        expect(Number(last?.["stepW"])).toBeCloseTo(expected.stepW, 10);
        expect(Number(last?.["stepB"])).toBeCloseTo(expected.stepB, 10);
        expect(Number(last?.["prevSignW"])).toBe(expected.prevSignW);
        expect(Number(last?.["prevSignB"])).toBe(expected.prevSignB);
        expect(Number(last?.["loss"])).toBeCloseTo(expected.loss, 10);
        expect(Number(last?.["loss"])).toBeLessThan(Number(frames[0]?.meta["initialLoss"]));
    });

    it("grows the step on a repeated sign and shrinks it after a flip", () => {
        const input = mod.defaultInput as {
            points: Point[];
            initialStep: number;
            increase: number;
            decrease: number;
            epochs: number;
        };
        const frames = [...mod.run({ ...input, epochs: 4 })];
        const first = frames[1];
        const second = frames[2];
        expect(first).toBeDefined();
        expect(second).toBeDefined();
        expect(Number(second?.meta["stepW"])).toBeCloseTo(input.initialStep * input.increase, 12);
        expect(Number(second?.meta["stepB"])).toBeCloseTo(input.initialStep * input.increase, 12);
        const third = frames[3];
        expect(third).toBeDefined();
        expect(Number(third?.meta["stepW"])).toBeCloseTo(
            input.initialStep * input.increase * input.increase,
            12,
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
