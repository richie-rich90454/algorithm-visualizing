/**
 * zero-inflated-poisson.test.ts - Independent reference, distribution properties, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./zero-inflated-poisson";
import type { VisualFrame } from "@/types";

/** Factorial of a small nonnegative integer. */
function factorial(n: number): number {
    let result = 1;
    for (let i = 2; i <= n; i += 1) result *= i;
    return result;
}

/** Independent zero-inflated Poisson mass from first principles. */
function referencePmf(k: number, pi: number, lambda: number): number {
    const poisson = (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
    return k === 0 ? pi + (1 - pi) * poisson : (1 - pi) * poisson;
}

function checkFrames(frames: VisualFrame[], maxK: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(maxK + 1);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Zero-Inflated Poisson Distribution", () => {
    it("matches an independent first-principles mass function", () => {
        for (const [pi, lambda] of [
            [0.3, 2.5],
            [0, 4],
            [0.75, 0.8],
        ]) {
            const frames = [...mod.run({ pi, lambda, maxK: 30 })];
            checkFrames(frames, 30);
            const final = frames[frames.length - 1];
            const pmf = final?.meta["pmf"] as number[];
            pmf.forEach((value, k) => {
                expect(value).toBeCloseTo(referencePmf(k, pi as number, lambda as number), 10);
            });
        }
    });

    it("has a normalized mass, monotone cumulative curve, and exact moments", () => {
        const frames = [...mod.run({ pi: 0.4, lambda: 3, maxK: 60 })];
        const final = frames[frames.length - 1];
        const pmf = final?.meta["pmf"] as number[];
        const cdf = final?.meta["cdf"] as number[];
        let total = 0;
        for (let i = 0; i < pmf.length; i += 1) {
            total += pmf[i] as number;
            expect(cdf[i] as number).toBeCloseTo(total, 10);
            expect(cdf[i] as number).toBeGreaterThanOrEqual(cdf[i - 1] === undefined ? 0 : (cdf[i - 1] as number));
        }
        expect(total).toBeCloseTo(1, 10);
        expect(final?.meta["theoryMean"]).toBeCloseTo(0.6 * 3, 10);
        expect(final?.meta["theoryVariance"]).toBeCloseTo(0.6 * 3 * (1 + 0.4 * 3), 10);
        expect((pmf[0] as number)).toBeGreaterThan(referencePmf(1, 0.4, 3));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
