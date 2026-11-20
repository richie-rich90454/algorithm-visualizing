/**
 * autocorrelation-function.test.ts - Closed-form sinusoid check, bounds, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./autocorrelation-function";
import type { VisualFrame } from "@/types";

/** Independent sample autocorrelation computed with explicit loops. */
function referenceAcf(series: number[], maxLag: number): number[] {
    const n = series.length;
    const mean = series.reduce((a, b) => a + b, 0) / n;
    const den = series.reduce((a, x) => a + (x - mean) * (x - mean), 0);
    const result: number[] = [];
    for (let lag = 0; lag <= maxLag; lag += 1) {
        let sum = 0;
        for (let t = lag; t < n; t += 1) sum += (series[t] as number - mean) * (series[t - lag] as number - mean);
        result.push(sum / den);
    }
    return result;
}

function checkFrames(frames: VisualFrame[], maxLag: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(maxLag + 1);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Autocorrelation Function", () => {
    it("matches an independent lagged-sum computation", () => {
        const series = [4, 1, -2, 3, 0, 5, -1, 2, 2, -3, 1, 4];
        const frames = [...mod.run({ series, maxLag: 6 })];
        checkFrames(frames, 6);
        const final = frames[frames.length - 1];
        const acf = final?.meta["acf"] as number[];
        const expected = referenceAcf(series, 6);
        acf.forEach((value, lag) => expect(value).toBeCloseTo(expected[lag] as number, 12));
    });

    it("recovers the cosine autocorrelation of a pure sinusoid", () => {
        const period = 8;
        const series = Array.from({ length: 64 }, (_, t) => Math.cos((2 * Math.PI * t) / period));
        const frames = [...mod.run({ series, maxLag: 16 })];
        const acf = frames[frames.length - 1]?.meta["acf"] as number[];
        expect(acf[0]).toBeCloseTo(1, 10);
        for (let lag = 0; lag <= 16; lag += 1) {
            const biasedCosine = ((64 - lag) / 64) * Math.cos((2 * Math.PI * lag) / period);
            expect(Math.abs((acf[lag] as number) - biasedCosine)).toBeLessThan(0.02);
            expect(acf[lag] as number).toBeGreaterThanOrEqual(-1.0000001);
            expect(acf[lag] as number).toBeLessThanOrEqual(1.0000001);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
