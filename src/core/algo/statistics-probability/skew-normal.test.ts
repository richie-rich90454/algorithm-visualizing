/**
 * skew-normal.test.ts - Normal-limit cross-check, moment properties, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./skew-normal";
import type { VisualFrame } from "@/types";

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

describe("Skew Normal Distribution", () => {
    it("reduces exactly to the ordinary normal when alpha is zero", () => {
        const frames = [...mod.run({ xi: 1, omega: 2, alpha: 0, points: 200 })];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        const xs = final?.meta["xs"] as number[];
        const pdf = final?.meta["pdf"] as number[];
        xs.forEach((x, index) => {
            const z = (x - 1) / 2;
            const expected = Math.exp(-(z * z) / 2) / (Math.sqrt(2 * Math.PI) * 2);
            expect(pdf[index] as number).toBeCloseTo(expected, 9);
        });
    });

    it("normalizes to one and recovers the mean by integration", () => {
        const frames = [...mod.run({ alpha: 5, points: 500, zRange: 8 })];
        const final = frames[frames.length - 1];
        const xs = final?.meta["xs"] as number[];
        const pdf = final?.meta["pdf"] as number[];
        let area = 0;
        let firstMoment = 0;
        for (let i = 1; i < xs.length; i += 1) {
            const dx = (xs[i] as number) - (xs[i - 1] as number);
            area += ((pdf[i - 1] as number + pdf[i] as number) / 2) * dx;
            firstMoment += ((xs[i - 1] as number * (pdf[i - 1] as number)) + (xs[i] as number * (pdf[i] as number))) / 2 * dx;
        }
        expect(area).toBeCloseTo(1, 2);
        expect(firstMoment).toBeCloseTo(final?.meta["mean"] as number, 1);
        const delta = 5 / Math.sqrt(26);
        expect(final?.meta["mean"] as number).toBeCloseTo(delta * Math.sqrt(2 / Math.PI), 12);
        expect(final?.meta["variance"] as number).toBeCloseTo(1 - (2 * delta * delta) / Math.PI, 12);
    });

    it("has a monotone cumulative curve and skews in the sign of alpha", () => {
        const positive = [...mod.run({ alpha: 5, points: 300 })];
        const negative = [...mod.run({ alpha: -5, points: 300 })];
        const cdf = positive[positive.length - 1]?.meta["cdf"] as number[];
        expect(cdf[0]).toBe(0);
        expect(cdf[cdf.length - 1] as number).toBeCloseTo(1, 6);
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i] as number).toBeGreaterThanOrEqual(cdf[i - 1] as number);
        }
        expect(positive[positive.length - 1]?.meta["mean"] as number).toBeGreaterThan(0);
        expect(negative[negative.length - 1]?.meta["mean"] as number).toBeLessThan(0);
        const quantiles = positive[positive.length - 1]?.meta["quantiles"] as number[];
        expect(quantiles[0] as number).toBeLessThan(quantiles[1] as number);
        expect(quantiles[1] as number).toBeLessThan(quantiles[2] as number);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
