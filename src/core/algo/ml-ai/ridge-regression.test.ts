/**
 * ridge-regression.test.ts - Brute-force optimum, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./ridge-regression";
import type { VisualFrame } from "@/types";

interface Sample {
    x: number;
    y: number;
}

function objective(samples: Sample[], w: number, lambda: number): number {
    let total = lambda * w * w;
    for (const s of samples) {
        total += (s.y - w * s.x) ** 2;
    }
    return total;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThanOrEqual(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("RidgeRegression", () => {
    it("finds the brute-force minimum of the ridge objective", () => {
        const input = mod.defaultInput as { points: Sample[]; lambda: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const final = frames[frames.length - 1];
        const slope = Number(final?.meta["slope"]);
        const expectedObj = Number(final?.meta["objective"]);

        let bestW = 0;
        let bestObj = Infinity;
        for (let i = 0; i <= 20000; i += 1) {
            const w = -2 + (i * 8) / 20000;
            const value = objective(input.points, w, input.lambda);
            if (value < bestObj) {
                bestObj = value;
                bestW = w;
            }
        }
        expect(slope).toBeCloseTo(bestW, 2);
        expect(expectedObj).toBeLessThanOrEqual(bestObj + 1e-6);
        expect(expectedObj).toBeCloseTo(objective(input.points, slope, input.lambda), 5);
    });

    it("matches the closed form across lambdas", () => {
        const points: Sample[] = [
            { x: -2, y: -3 },
            { x: -1, y: -1 },
            { x: 1, y: 2 },
            { x: 3, y: 5 },
            { x: 4, y: 9 },
        ];
        for (const lambda of [0, 0.5, 2, 10]) {
            const frames = [...mod.run({ points, lambda })];
            checkFrames(frames, points.length);
            const final = frames[frames.length - 1];
            const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
            const sumX2 = points.reduce((acc, p) => acc + p.x * p.x, 0);
            expect(Number(final?.meta["slope"])).toBeCloseTo(sumXY / (sumX2 + lambda), 5);
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
