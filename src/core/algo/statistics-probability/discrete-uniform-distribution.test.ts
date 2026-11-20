/**
 * discrete-uniform-distribution.test.ts - Brute-force table check, sampling properties, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./discrete-uniform-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(Number(frame.meta["n"]) + 2);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Discrete Uniform Distribution", () => {
    it("reproduces the probability table by brute force", () => {
        for (const [lower, upper] of [[1, 6], [-3, 3], [5, 5]]) {
            const frames = [...mod.run({ lower, upper, samples: 1 })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            const n = upper - lower + 1;
            const values = final?.meta["values"] as number[];
            const pmf = final?.meta["pmf"] as number[];
            const cdf = final?.meta["cdf"] as number[];
            expect(values.length).toBe(n + 2);
            let total = 0;
            values.forEach((value, index) => {
                const expectedMass = value >= lower && value <= upper ? 1 / n : 0;
                const expectedCdf = value < lower ? 0 : value > upper ? 1 : (value - lower + 1) / n;
                expect(pmf[index] as number).toBeCloseTo(expectedMass, 12);
                expect(cdf[index] as number).toBeCloseTo(expectedCdf, 12);
                if (index > 0) expect(cdf[index] as number).toBeGreaterThanOrEqual(cdf[index - 1] as number);
                total += pmf[index] as number;
            });
            expect(total).toBeCloseTo(1, 12);
        }
    });

    it("matches the closed-form moments and the sampled moments", () => {
        const frames = [...mod.run({ lower: 1, upper: 6, samples: 6000, seed: 42 })];
        const final = frames[frames.length - 1];
        const n = 6;
        expect(final?.meta["mean"] as number).toBeCloseTo(3.5, 12);
        expect(final?.meta["variance"] as number).toBeCloseTo((n * n - 1) / 12, 12);
        expect(final?.meta["sampleMean"] as number).toBeCloseTo(3.5, 1);
        expect(final?.meta["sampleVariance"] as number).toBeCloseTo(35 / 12, 1);
    });

    it("swaps reversed bounds and caps oversized ranges", () => {
        const reversed = [...mod.run({ lower: 6, upper: 1, samples: 1 })];
        expect(reversed[reversed.length - 1]?.meta["n"]).toBe(6);
        const capped = [...mod.run({ lower: 0, upper: 100, samples: 1 })];
        expect(capped[capped.length - 1]?.meta["n"]).toBe(40);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
