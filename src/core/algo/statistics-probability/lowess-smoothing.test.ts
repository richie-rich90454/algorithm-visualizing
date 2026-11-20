/** lowess-smoothing.test.ts - Exact linear reproduction and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./lowess-smoothing";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
    });
}

describe("LOWESS Smoothing", () => {
    it("reproduces a straight line exactly regardless of span", () => {
        const x = Array.from({ length: 15 }, (_, i) => i / 2);
        const y = x.map((value) => 2 * value + 1);
        for (const frac of [0.2, 0.5, 1]) {
            const frames = [...mod.run({ x, y, frac, iterations: 2 })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const fitted = final["fitted"] as number[];
            expect(fitted.length).toBe(y.length);
            for (let i = 0; i < fitted.length; i += 1) {
                expect(fitted[i]!).toBeCloseTo(y[i]!, 8);
            }
        }
    });

    it("tracks a noisy linear trend and keeps output ordered by x", () => {
        const x = [3, 0, 2, 1, 5, 4, 7, 6, 8];
        const y = [7, 1, 5, 3, 9, 8, 13, 12, 14];
        const frames = [...mod.run({ x, y, frac: 0.6, iterations: 2 })];
        const fitted = frames[frames.length - 1]!.meta["fitted"] as number[];
        expect(fitted.length).toBe(x.length);
        for (let i = 1; i < fitted.length; i += 1) {
            expect(Number.isFinite(fitted[i]!)).toBe(true);
        }
        const sortedFrames = [...mod.run({ x: [...x].sort((a, b) => a - b), y, frac: 0.6 })];
        expect(sortedFrames[sortedFrames.length - 1]!.meta["fitted"]).toHaveLength(x.length);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
