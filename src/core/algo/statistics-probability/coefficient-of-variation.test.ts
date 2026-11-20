/**
 * coefficient-of-variation.test.ts - Independent reference computation,
 * scale invariance, a known textbook value, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./coefficient-of-variation";
import type { VisualFrame } from "@/types";

function reference(values: number[], sample: boolean): number {
    const n = values.length;
    if (n === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    if (Math.abs(mean) < 1e-12) return 0;
    const ss = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0);
    const variance = ss / Math.max(1, n - (sample ? 1 : 0));
    return Math.sqrt(variance) / Math.abs(mean);
}

function checkFrames(frames: VisualFrame[], n: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
    expect(frames[frames.length - 1].entities.every((e) => e.state === "sorted")).toBe(true);
}

describe("CoefficientOfVariation", () => {
    it("matches an independent reference computation", () => {
        const data = [3, 7, 7, 11, 13, 17, 19, 23];
        for (const sample of [false, true]) {
            const frames = [...mod.run({ values: data, sample })];
            checkFrames(frames, data.length);
            expect(Number(frames[frames.length - 1].meta["cv"])).toBeCloseTo(reference(data, sample), 10);
        }
    });

    it("is invariant under positive scaling", () => {
        const base = [2, 4, 4, 5, 7, 9];
        const scaled = base.map((v) => v * 7.5);
        const cv = (values: number[]) => Number([...mod.run({ values })].at(-1)?.meta["cv"]);
        expect(cv(scaled)).toBeCloseTo(cv(base), 10);
    });

    it("reproduces the known textbook value and handles edge cases", () => {
        const cv = (values: number[]) => Number([...mod.run({ values })].at(-1)?.meta["cv"]);
        expect(cv([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(0.4, 10);
        expect(cv([5, 5, 5])).toBeCloseTo(0, 10);
        expect(cv([])).toBe(0);
        expect(Number([...mod.run({ values: [0, 0, 0] })].at(-1)?.meta["meanIsZero"])).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBe(2 * 8 + 3);
        expect(generator.next().done).toBe(true);
    });
});
