/**
 * generalized-gamma-distribution.test.ts - Nested-family cross-checks, moments, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./generalized-gamma-distribution";
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

describe("Generalized Gamma Distribution", () => {
    it("reduces to the gamma density when d is one", () => {
        const frames = [...mod.run({ a: 2, d: 1, scale: 1, points: 150 })];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["family"]).toBe("gamma");
        const xs = final?.meta["xs"] as number[];
        const pdf = final?.meta["pdf"] as number[];
        xs.forEach((x, index) => {
            const expected = x <= 0 ? 0 : x * Math.exp(-x);
            expect(pdf[index] as number).toBeCloseTo(expected, 9);
        });
        expect(final?.meta["mean"] as number).toBeCloseTo(2, 10);
        expect(final?.meta["variance"] as number).toBeCloseTo(2, 10);
    });

    it("reduces to the Rayleigh density when a equals d", () => {
        const frames = [...mod.run({ a: 2, d: 2, scale: 1, points: 150 })];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["family"]).toBe("weibull");
        const xs = final?.meta["xs"] as number[];
        const pdf = final?.meta["pdf"] as number[];
        xs.forEach((x, index) => {
            const expected = x <= 0 ? 0 : 2 * x * Math.exp(-x * x);
            expect(pdf[index] as number).toBeCloseTo(expected, 9);
        });
        const rayleighMean = Math.sqrt(Math.PI) / 2;
        expect(final?.meta["mean"] as number).toBeCloseTo(rayleighMean, 10);
        expect(final?.meta["variance"] as number).toBeCloseTo(1 - Math.PI / 4, 10);
    });

    it("normalizes a genuine three-parameter case and has a monotone CDF", () => {
        const frames = [...mod.run({ a: 3, d: 2, scale: 1.5, points: 500, xMax: 9 })];
        const final = frames[frames.length - 1];
        expect(final?.meta["family"]).toBe("generalized");
        const xs = final?.meta["xs"] as number[];
        const pdf = final?.meta["pdf"] as number[];
        const cdf = final?.meta["cdf"] as number[];
        let area = 0;
        for (let i = 1; i < xs.length; i += 1) {
            area += ((pdf[i - 1] as number + pdf[i] as number) / 2) * ((xs[i] as number) - (xs[i - 1] as number));
            expect(cdf[i] as number).toBeGreaterThanOrEqual(cdf[i - 1] as number);
        }
        expect(area).toBeCloseTo(1, 2);
        expect(cdf[cdf.length - 1] as number).toBeCloseTo(1, 5);
        const quantiles = final?.meta["quantiles"] as number[];
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
