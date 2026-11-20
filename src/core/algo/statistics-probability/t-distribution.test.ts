/**
 * t-distribution.test.ts - Known density values, symmetry, normal limit,
 * integration, moments, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./t-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBe(steps + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(steps + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("TDistribution", () => {
    it("matches known density at zero for one, two, and many degrees of freedom", () => {
        const cases: Array<{ df: number; expected: number; tolerance: number }> = [
            { df: 1, expected: 1 / Math.PI, tolerance: 8 },
            { df: 2, expected: 1 / (2 * Math.SQRT2), tolerance: 8 },
            { df: 5, expected: 2 / (0.75 * Math.sqrt(Math.PI) * Math.sqrt(5 * Math.PI)), tolerance: 8 },
            { df: 200, expected: 1 / Math.sqrt(2 * Math.PI), tolerance: 2 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ df: testCase.df, maxX: 8, steps: 12 })];
            checkFrames(frames, 12);
            const meta = frames[frames.length - 1]!.meta;
            const xs = meta["xs"] as number[];
            const pdf = meta["pdf"] as number[];
            const atZero = xs.findIndex((x) => Math.abs(x) < 1e-9);
            expect(atZero).toBeGreaterThanOrEqual(0);
            expect(pdf[atZero]).toBeCloseTo(testCase.expected, testCase.tolerance);
        }
    });

    it("is symmetric, has half its mass at zero, and integrates to one", () => {
        const frames = [...mod.run({ df: 5, maxX: 12, steps: 40 })];
        checkFrames(frames, 40);
        const meta = frames[frames.length - 1]!.meta;
        const pdf = meta["pdf"] as number[];
        const cdf = meta["cdf"] as number[];
        const xs = meta["xs"] as number[];
        const atZero = xs.findIndex((x) => Math.abs(x) < 1e-9);
        expect(cdf[atZero]).toBeCloseTo(0.5, 2);
        for (let i = 0; i < pdf.length; i += 1) {
            expect(pdf[i]!).toBeCloseTo(pdf[pdf.length - 1 - i]!, 6);
        }
        expect(Number(meta["area"])).toBeCloseTo(1, 3);
        expect(Number(meta["variance"])).toBeCloseTo(5 / 3, 12);
        expect(meta["varianceDefined"]).toBe(true);
    });

    it("flags undefined variance for a shape of two or less", () => {
        for (const df of [1, 2]) {
            const meta = [...mod.run({ df, steps: 8 })].at(-1)!.meta;
            expect(meta["varianceDefined"]).toBe(false);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(15);
        expect(generator.next().done).toBe(true);
    });
});
