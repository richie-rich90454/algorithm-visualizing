/**
 * students-t-test.test.ts - Independent two-pass statistics, closed-form t
 * tail check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./students-t-test";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], sample: number[]): void {
    expect(frames.length).toBe(sample.length + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(sample.length);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent two-pass computation of the t statistic. */
function reference(sample: number[], mu0: number) {
    const n = sample.length;
    const mean = sample.reduce((a, b) => a + b, 0) / n;
    const variance = sample.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1);
    const s = Math.sqrt(variance);
    const se = s / Math.sqrt(n);
    return { mean, s, se, t: (mean - mu0) / se, df: n - 1 };
}

describe("StudentsTTest", () => {
    it("matches an independent two-pass computation", () => {
        const cases: Array<{ sample: number[]; mu0: number }> = [
            { sample: [9, 10, 11, 12, 13], mu0: 10 },
            { sample: [2, 4, 4, 4, 5, 5, 7, 9], mu0: 5 },
            { sample: [1.2, 2.3, 3.1, 4.8, 5.5, 6.0], mu0: 3 },
            { sample: [100, 101, 99, 102, 98], mu0: 100 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.sample);
            const meta = frames[frames.length - 1]?.meta;
            const expected = reference(testCase.sample, testCase.mu0);
            expect(Number(meta?.["mean"])).toBeCloseTo(expected.mean, 10);
            expect(Number(meta?.["sampleStd"])).toBeCloseTo(expected.s, 10);
            expect(Number(meta?.["standardError"])).toBeCloseTo(expected.se, 10);
            expect(Number(meta?.["t"])).toBeCloseTo(expected.t, 8);
            expect(meta?.["df"]).toBe(expected.df);
        }
    });

    it("returns p = 1 when the mean equals the claim", () => {
        const frames = [...mod.run({ sample: [4, 5, 6, 7, 8], mu0: 6 })];
        checkFrames(frames, [4, 5, 6, 7, 8]);
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["t"])).toBeCloseTo(0, 12);
        expect(Number(meta?.["pValue"])).toBeCloseTo(1, 8);
    });

    it("matches the closed-form Cauchy tail for two observations", () => {
        const samples = [
            [0, 2],
            [0, 4],
            [1, 1.5],
            [0, 12.706],
        ];
        for (const sample of samples) {
            const frames = [...mod.run({ sample, mu0: 0 })];
            checkFrames(frames, sample);
            const meta = frames[frames.length - 1]?.meta;
            const t = Math.abs(Number(meta?.["t"]));
            const expectedP = 1 - (2 / Math.PI) * Math.atan(t);
            expect(Number(meta?.["pValue"])).toBeCloseTo(expectedP, 6);
        }
    });

    it("keeps p within bounds over many samples", () => {
        for (let n = 2; n <= 12; n += 1) {
            const sample = Array.from({ length: n }, (_, i) => Math.sin(i * 1.7) * 10);
            const frames = [...mod.run({ sample, mu0: 0 })];
            checkFrames(frames, sample);
            const p = Number(frames[frames.length - 1]?.meta["pValue"]);
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(1);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
