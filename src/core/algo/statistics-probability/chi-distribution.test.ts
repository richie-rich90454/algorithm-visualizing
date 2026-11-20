/**
 * chi-distribution.test.ts - Closed-form cross-check, distribution properties, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./chi-distribution";
import type { VisualFrame } from "@/types";

/** Factorial for the small integers used by the even-degree reference. */
function factorial(n: number): number {
    let result = 1;
    for (let i = 2; i <= n; i += 1) result *= i;
    return result;
}

/** Independent chi density for an even integer k, where Gamma(k/2) is a factorial. */
function referencePdf(x: number, k: number): number {
    if (x <= 0) return 0;
    const gammaHalf = factorial(k / 2 - 1);
    const denominator = Math.pow(2, k / 2 - 1) * gammaHalf;
    return (Math.pow(x, k - 1) * Math.exp(-(x * x) / 2)) / denominator;
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

describe("Chi Distribution", () => {
    it("matches the closed-form density for even degrees of freedom", () => {
        for (const k of [2, 4, 6]) {
            const frames = [...mod.run({ k, points: 120, samples: 1 })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            const xs = final?.meta["xs"] as number[];
            const pdf = final?.meta["pdf"] as number[];
            expect(xs.length).toBe(pdf.length);
            xs.forEach((x, index) => {
                expect(pdf[index] as number).toBeCloseTo(referencePdf(x, k), 8);
            });
        }
    });

    it("has a normalized density and a monotone CDF approaching one", () => {
        const frames = [...mod.run({ k: 3, points: 400, samples: 1 })];
        const final = frames[frames.length - 1];
        const xs = final?.meta["xs"] as number[];
        const pdf = final?.meta["pdf"] as number[];
        const cdf = final?.meta["cdf"] as number[];
        let area = 0;
        for (let i = 1; i < xs.length; i += 1) {
            area += ((pdf[i - 1] as number + pdf[i] as number) / 2) * ((xs[i] as number) - (xs[i - 1] as number));
            expect(cdf[i] as number).toBeGreaterThanOrEqual(cdf[i - 1] as number);
            expect(cdf[i] as number).toBeLessThanOrEqual(1.0000001);
        }
        expect(area).toBeCloseTo(1, 2);
        expect(cdf[0]).toBe(0);
        expect(cdf[cdf.length - 1] as number).toBeCloseTo(1, 2);
        const quantiles = final?.meta["quantiles"] as number[];
        expect(quantiles[0] as number).toBeLessThan(quantiles[1] as number);
        expect(quantiles[1] as number).toBeLessThan(quantiles[2] as number);
    });

    it("reports a mean consistent with the closed form for k = 2", () => {
        const frames = [...mod.run({ k: 2, points: 200, samples: 1 })];
        const final = frames[frames.length - 1];
        const theory = Math.sqrt(Math.PI / 2);
        expect(final?.meta["theoryMean"] as number).toBeCloseTo(theory, 10);
        expect(final?.meta["theoryVariance"] as number).toBeCloseTo(2 - theory * theory, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
