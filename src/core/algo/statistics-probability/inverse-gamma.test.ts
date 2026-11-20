/**
 * inverse-gamma.test.ts - Closed-form cross-check, moment properties, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./inverse-gamma";
import type { VisualFrame } from "@/types";

function factorial(n: number): number {
    let result = 1;
    for (let i = 2; i <= n; i += 1) result *= i;
    return result;
}

/** Independent inverse gamma density for an integer shape. */
function referencePdf(x: number, alpha: number, beta: number): number {
    return (Math.pow(beta, alpha) / factorial(alpha - 1)) * Math.pow(x, -alpha - 1) * Math.exp(-beta / x);
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

describe("Inverse Gamma Distribution", () => {
    it("matches the closed-form density for integer shapes", () => {
        for (const [alpha, beta] of [[4, 2], [3, 1], [5, 3]]) {
            const frames = [...mod.run({ alpha, beta, points: 200, samples: 1 })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            const xs = final?.meta["xs"] as number[];
            const pdf = final?.meta["pdf"] as number[];
            xs.forEach((x, index) => {
                expect(pdf[index] as number).toBeCloseTo(referencePdf(x, alpha, beta), 8);
            });
        }
    });

    it("normalizes to one and recovers the analytic mean by integration", () => {
        const frames = [...mod.run({ alpha: 4, beta: 2, points: 500, samples: 1 })];
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
        expect(firstMoment).toBeCloseTo(2 / 3, 1);
        expect(final?.meta["mean"] as number).toBeCloseTo(2 / 3, 12);
        expect(final?.meta["variance"] as number).toBeCloseTo(4 / 18, 12);
    });

    it("keeps a monotone cumulative curve and puts the mode left of the median", () => {
        const frames = [...mod.run({ alpha: 4, beta: 2, points: 300, samples: 50 })];
        const final = frames[frames.length - 1];
        const cdf = final?.meta["cdf"] as number[];
        expect(cdf[0]).toBe(0);
        expect(cdf[cdf.length - 1] as number).toBeCloseTo(1, 9);
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i] as number).toBeGreaterThanOrEqual(cdf[i - 1] as number);
        }
        const quantiles = final?.meta["quantiles"] as number[];
        expect(quantiles[0] as number).toBeLessThan(quantiles[1] as number);
        expect(quantiles[1] as number).toBeLessThan(quantiles[2] as number);
        expect(final?.meta["mode"] as number).toBeCloseTo(0.4, 12);
        expect(quantiles[1] as number).toBeGreaterThan(0.4);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
