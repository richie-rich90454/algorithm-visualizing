/**
 * phase-type-distribution.test.ts - Closed-form phase-type cross-check, moments, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./phase-type-distribution";
import type { VisualFrame } from "@/types";

/** Independent exponential absorption cumulative for a single phase. */
function referenceSingle(x: number, rate: number): number {
    return 1 - Math.exp(-rate * x);
}

/** Independent cumulative for an exponential(rate a) plus exponential(rate b) sum. */
function referenceSeries(x: number, a: number, b: number): number {
    return 1 - (b * Math.exp(-a * x) - a * Math.exp(-b * x)) / (b - a);
}

function checkFrames(frames: VisualFrame[], points: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(points + 1);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Phase-Type Distribution", () => {
    it("matches a single-phase exponential in closed form", () => {
        const frames = [...mod.run({ alpha: [1], T: [[-2]], points: 100 })];
        checkFrames(frames, 100);
        const final = frames[frames.length - 1];
        const xs = final?.meta["xs"] as number[];
        const cdf = final?.meta["cdf"] as number[];
        expect(final?.meta["meanAbsorption"] as number).toBeCloseTo(0.5, 10);
        for (let i = 0; i <= 100; i += 5) {
            expect(cdf[i] as number).toBeCloseTo(referenceSingle(xs[i] as number, 2), 5);
        }
    });

    it("matches a two-phase series absorption in closed form", () => {
        const frames = [...mod.run({ alpha: [1, 0], T: [[-1, 1], [0, -2]], points: 120 })];
        const final = frames[frames.length - 1];
        const xs = final?.meta["xs"] as number[];
        const cdf = final?.meta["cdf"] as number[];
        expect(final?.meta["meanAbsorption"] as number).toBeCloseTo(1.5, 10);
        for (let i = 0; i <= 120; i += 4) {
            expect(cdf[i] as number).toBeCloseTo(referenceSeries(xs[i] as number, 1, 2), 4);
        }
        expect(cdf[0]).toBe(0);
        expect(cdf[120] as number).toBeCloseTo(1, 3);
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i] as number).toBeGreaterThanOrEqual(cdf[i - 1] as number);
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
