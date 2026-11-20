/** peaks-over-threshold.test.ts - Return-level inversion and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./peaks-over-threshold";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    });
}

describe("Peaks Over Threshold Extreme Value Method", () => {
    it("returns levels whose fitted survival matches the target annual rate", () => {
        const periods = [2, 5, 10, 25, 50, 100];
        const frames = [...mod.run({ threshold: 10, years: 10, returnPeriods: periods, points: 40 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const xi = Number(final["xi"]);
        const sigma = Number(final["sigma"]);
        const rate = Number(final["rate"]);
        const threshold = Number(final["threshold"]);
        const levels = final["returnLevels"] as { period: number; level: number; annualExceedance: number }[];
        expect(levels.length).toBe(periods.length);
        for (const { period, level } of levels) {
            const z = level - threshold;
            const survival = Math.abs(xi) < 1e-9
                ? Math.exp(-z / sigma)
                : Math.pow(Math.max(0, 1 + (xi * z) / sigma), -1 / xi);
            expect(survival).toBeCloseTo(1 / (period * rate), 6);
        }
    });

    it("gives strictly increasing levels for longer return periods", () => {
        const frames = [...mod.run({ returnPeriods: [2, 10, 50], points: 30 })];
        const levels = (frames[frames.length - 1]!.meta["returnLevels"] as { level: number }[]).map((l) => l.level);
        expect(levels[0]!).toBeLessThan(levels[1]!);
        expect(levels[1]!).toBeLessThan(levels[2]!);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
