/**
 * grubbs-test.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./grubbs-test";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent statistic: largest z-score using the sample standard deviation. */
function referenceStatistic(values: number[]): { statistic: number; outlier: number } {
    const n = values.length;
    const mean = values.reduce((total, x) => total + x, 0) / n;
    const sd = Math.sqrt(values.reduce((total, x) => total + (x - mean) ** 2, 0) / (n - 1));
    let maxDeviation = 0;
    let outlier = 0;
    values.forEach((value, index) => {
        const deviation = Math.abs(value - mean);
        if (deviation > maxDeviation) {
            maxDeviation = deviation;
            outlier = index;
        }
    });
    return { statistic: maxDeviation / sd, outlier };
}

describe("Grubbs Test", () => {
    it("matches an independent statistic and detects a clear outlier", () => {
        const values = [10, 11, 10, 12, 11, 48];
        const frames = [...mod.run({ values, alpha: 0.05 })];
        checkFrames(frames, values.length);
        const expected = referenceStatistic(values);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["statistic"])).toBeCloseTo(expected.statistic, 9);
        expect(final?.["outlierIndex"]).toBe(expected.outlier);
        expect(final?.["reject"]).toBe(true);
    });

    it("matches the published critical value for n = 6 at five percent", () => {
        const frames = [...mod.run({ values: [1, 2, 3, 4, 5, 6], alpha: 0.05 })];
        const critical = Number(frames[frames.length - 1]?.meta["critical"]);
        expect(critical).toBeGreaterThan(1.8);
        expect(critical).toBeLessThan(1.95);
    });

    it("does not reject a uniform sample and guards tiny samples", () => {
        const uniform = [...mod.run({ values: [5, 5, 5, 5, 5], alpha: 0.05 })];
        expect(uniform[uniform.length - 1]?.meta["reject"]).toBe(false);
        const tiny = [...mod.run({ values: [2, 4] })];
        checkFrames(tiny, 2);
        expect(tiny[tiny.length - 1]?.meta["critical"]).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
