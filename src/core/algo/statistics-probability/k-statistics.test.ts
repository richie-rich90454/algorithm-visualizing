/**
 * k-statistics.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./k-statistics";
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

/** Independent formulas based on deviations about the sample mean. */
function reference(values: number[]) {
    const n = values.length;
    const mean = values.reduce((total, x) => total + x, 0) / n;
    const k1 = mean;
    const k2 = values.reduce((total, x) => total + (x - mean) ** 2, 0) / (n - 1);
    const k3 = (n * values.reduce((total, x) => total + (x - mean) ** 3, 0)) / ((n - 1) * (n - 2));
    return { k1, k2, k3 };
}

describe("k-Statistics", () => {
    it("matches independent deviation-based formulas", () => {
        const samples = [
            [1, 2, 3, 5, 9],
            [-4, -1, 0, 2, 7, 11],
            [2, 2, 2, 2],
        ];
        for (const values of samples) {
            const frames = [...mod.run({ values })];
            checkFrames(frames, values.length);
            const expected = reference(values);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["k1"])).toBeCloseTo(expected.k1, 9);
            expect(Number(final?.["k2"])).toBeCloseTo(expected.k2, 9);
            expect(Number(final?.["k3"])).toBeCloseTo(expected.k3, 9);
        }
    });

    it("gives a zero third cumulant for a symmetric sample", () => {
        const values = [-3, -1, 0, 1, 3];
        const frames = [...mod.run({ values })];
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["k1"])).toBeCloseTo(0, 9);
        expect(Number(final?.["k3"])).toBeCloseTo(0, 9);
        expect(Number(final?.["k2"])).toBeGreaterThan(0);
    });

    it("guards samples too small for higher cumulants and terminates", () => {
        for (const values of [[5], [4, 6]]) {
            const frames = [...mod.run({ values })];
            checkFrames(frames, values.length);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["hasK3"]).toBe(values.length >= 3);
        }
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
