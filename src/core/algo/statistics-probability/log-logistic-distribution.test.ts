/**
 * log-logistic-distribution.test.ts - Formula cross-check, quantile inversion, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./log-logistic-distribution";
import type { VisualFrame } from "@/types";

function referencePdf(x: number, s: number, k: number): number {
    if (x <= 0) return 0;
    const u = x / s;
    return (k / s) * Math.pow(u, k - 1) / Math.pow(1 + Math.pow(u, k), 2);
}

function referenceCdf(x: number, s: number, k: number): number {
    if (x <= 0) return 0;
    const u = x / s;
    return Math.pow(u, k) / (1 + Math.pow(u, k));
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(Number(frame.meta["points"]) + 1);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Log-Logistic Distribution", () => {
    it("matches independent density and cumulative formulas", () => {
        for (const [scale, shape] of [[1, 2], [2, 3], [0.5, 1.5]]) {
            const frames = [...mod.run({ scale, shape, points: 150 })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            const xs = final?.meta["xs"] as number[];
            const pdf = final?.meta["pdf"] as number[];
            const cdf = final?.meta["cdf"] as number[];
            xs.forEach((x, index) => {
                expect(pdf[index] as number).toBeCloseTo(referencePdf(x, scale, shape), 10);
                expect(cdf[index] as number).toBeCloseTo(referenceCdf(x, scale, shape), 10);
            });
        }
    });

    it("inverts its cumulative with the quantile and normalizes", () => {
        const frames = [...mod.run({ scale: 1, shape: 2, points: 500 })];
        const final = frames[frames.length - 1];
        const quantiles = final?.meta["quantiles"] as number[];
        [0.1, 0.5, 0.9].forEach((p, index) => {
            expect(referenceCdf(quantiles[index] as number, 1, 2)).toBeCloseTo(p, 12);
        });
        expect(referenceCdf(1, 1, 2)).toBeCloseTo(0.5, 12);
        const xs = final?.meta["xs"] as number[];
        const pdf = final?.meta["pdf"] as number[];
        let area = 0;
        for (let i = 1; i < xs.length; i += 1) {
            area += ((pdf[i - 1] as number + pdf[i] as number) / 2) * ((xs[i] as number) - (xs[i - 1] as number));
        }
        expect(area).toBeCloseTo(1, 2);
        expect(final?.meta["mean"] as number).toBeCloseTo(Math.PI / 2, 12);
        const cdf = final?.meta["cdf"] as number[];
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i] as number).toBeGreaterThanOrEqual(cdf[i - 1] as number);
        }
        expect(cdf[cdf.length - 1] as number).toBeCloseTo(1, 2);
    });

    it("leaves the mean undefined for a heavy tail and terminates cleanly", () => {
        const frames = [...mod.run({ scale: 1, shape: 1, points: 100 })];
        expect(frames[frames.length - 1]?.meta["mean"]).toBeNull();
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
