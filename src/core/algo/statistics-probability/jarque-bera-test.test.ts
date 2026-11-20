/**
 * jarque-bera-test.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./jarque-bera-test";
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

/** Independent computation of the Jarque-Bera statistic from the sample. */
function reference(values: number[]) {
    const n = values.length;
    const mean = values.reduce((total, x) => total + x, 0) / n;
    const m2 = values.reduce((total, x) => total + (x - mean) ** 2, 0) / n;
    const m3 = values.reduce((total, x) => total + (x - mean) ** 3, 0) / n;
    const m4 = values.reduce((total, x) => total + (x - mean) ** 4, 0) / n;
    const skewness = m2 > 0 ? m3 / m2 ** 1.5 : 0;
    const excess = m2 > 0 ? m4 / (m2 * m2) - 3 : 0;
    const statistic = (n / 6) * (skewness ** 2 + (excess ** 2) / 4);
    return { skewness, excess, statistic, pValue: Math.exp(-statistic / 2) };
}

describe("Jarque-Bera Test", () => {
    it("matches an independent statistic computation", () => {
        const samples = [
            [-2, -1, 0, 1, 2, 8],
            [1, 1, 2, 3, 5, 8, 13],
            [3, 3, 3, 3, 3],
        ];
        for (const values of samples) {
            const frames = [...mod.run({ values })];
            checkFrames(frames, values.length);
            const expected = reference(values);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["skewness"])).toBeCloseTo(expected.skewness, 8);
            expect(Number(final?.["excess"])).toBeCloseTo(expected.excess, 8);
            expect(Number(final?.["statistic"])).toBeCloseTo(expected.statistic, 8);
            expect(Number(final?.["pValue"])).toBeCloseTo(expected.pValue, 8);
            expect(Number(final?.["statistic"])).toBeGreaterThanOrEqual(0);
        }
    });

    it("gives zero skewness for a symmetric sample and a finite tail probability", () => {
        const frames = [...mod.run({ values: [-4, -2, 0, 2, 4] })];
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["skewness"])).toBeCloseTo(0, 9);
        expect(Number(final?.["pValue"])).toBeGreaterThanOrEqual(0);
        expect(Number(final?.["pValue"])).toBeLessThanOrEqual(1);
    });

    it("terminates", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
