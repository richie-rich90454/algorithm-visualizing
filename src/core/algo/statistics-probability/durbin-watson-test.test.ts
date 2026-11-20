/**
 * durbin-watson-test.test.ts - Independent ratio computation, known limiting
 * values, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./durbin-watson-test";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(2 * n + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeTypeOf("object");
    });
}

function reference(residuals: number[]): number {
    let numerator = 0;
    let denominator = 0;
    for (const value of residuals) {
        denominator += value * value;
    }
    for (let i = 1; i < residuals.length; i += 1) {
        numerator += (residuals[i] - residuals[i - 1]) ** 2;
    }
    return denominator > 0 ? numerator / denominator : 0;
}

describe("DurbinWatsonTest", () => {
    it("matches an independent ratio computation", () => {
        const residuals = [1.5, -0.3, 0.7, 2.1, -1.2, 0.4, 0.9];
        const frames = [...mod.run({ residuals })];
        checkFrames(frames, residuals.length);
        const final = frames[frames.length - 1];
        expect(Number(final.meta["statistic"])).toBeCloseTo(reference(residuals), 12);
        expect(Number(final.meta["numerator"])).toBeCloseTo(3.24 + 1 + 1.96 + 10.89 + 2.56 + 0.25, 10);
    });

    it("reproduces known limiting values", () => {
        const positive = [...mod.run({ residuals: [1, 2, 3, 4] })].at(-1);
        expect(Number(positive?.meta["statistic"])).toBeCloseTo(0.1, 12);
        const negative = [...mod.run({ residuals: [1, -1, 1, -1] })].at(-1);
        expect(Number(negative?.meta["statistic"])).toBeCloseTo(3, 12);
    });

    it("returns zero for a flat series", () => {
        const final = [...mod.run({ residuals: [2, 2, 2, 2] })].at(-1);
        expect(Number(final?.meta["statistic"])).toBeCloseTo(0, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(17);
        expect(generator.next().done).toBe(true);
    });
});
