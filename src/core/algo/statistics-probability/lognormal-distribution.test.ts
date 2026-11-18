/**
 * lognormal-distribution.test.ts - Property checks against numerical integration.
 */

import { describe, expect, it } from "vitest";
import mod, { lognormalModel } from "./lognormal-distribution";
import type { VisualFrame } from "@/types";

/** Trapezoidal integration of f over [a, b] with n panels. */
function integrate(f: (x: number) => number, a: number, b: number, n: number): number {
    const h = (b - a) / n;
    let sum = 0.5 * (f(a) + f(b));
    for (let i = 1; i < n; i += 1) {
        sum += f(a + i * h);
    }
    return sum * h;
}

function checkFrames(frames: VisualFrame[], samples: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(samples);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Number.isFinite(frame.meta["mean"] as number)).toBe(true);
    });
}

describe("Lognormal Distribution", () => {
    it("integrates the density to one and matches the analytic mean", () => {
        const mu = 0.3;
        const sigma = 0.6;
        const model = lognormalModel(mu, sigma);
        const upper = Math.exp(mu + 8 * sigma);
        const mass = integrate(model.pdf, 0, upper, 200000);
        expect(Math.abs(mass - 1)).toBeLessThan(1e-4);
        const numericMean = integrate((x) => x * model.pdf(x), 0, upper, 200000);
        expect(Math.abs(numericMean - model.mean) / model.mean).toBeLessThan(1e-3);
        const numericSecondMoment = integrate((x) => x * x * model.pdf(x), 0, upper, 200000);
        const analyticVariance = numericSecondMoment - numericMean * numericMean;
        expect(Math.abs(analyticVariance - model.variance) / model.variance).toBeLessThan(1e-2);
    });

    it("has median cumulative probability one half and a monotone CDF", () => {
        const model = lognormalModel(0, 0.7);
        expect(model.cdf(0)).toBe(0);
        expect(Math.abs(model.cdf(model.median) - 0.5)).toBeLessThan(2e-7);
        let previous = -1;
        for (let i = 1; i <= 200; i += 1) {
            const value = model.cdf(i / 20);
            expect(value).toBeGreaterThanOrEqual(previous);
            expect(value).toBeLessThanOrEqual(1);
            previous = value;
        }
        expect(model.pdf(0)).toBe(0);
        expect(model.pdf(-1)).toBe(0);
    });

    it("matches the numerical CDF and reports closed-form moments in frames", () => {
        const input = mod.defaultInput as { mu: number; sigma: number; x: number; samples: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.samples);
        const final = frames[frames.length - 1]?.meta;
        const model = lognormalModel(input.mu, input.sigma);
        expect(final?.["mu"]).toBe(input.mu);
        expect(final?.["sigma"]).toBe(input.sigma);
        expect(Number(final?.["mean"])).toBeCloseTo(model.mean, 8);
        expect(Number(final?.["median"])).toBeCloseTo(model.median, 8);
        expect(Number(final?.["variance"])).toBeCloseTo(model.variance, 8);
        expect(Number(final?.["pdf"])).toBeCloseTo(model.pdf(input.x), 8);
        const numericCdf = integrate(model.pdf, 0, input.x, 100000);
        expect(Math.abs(Number(final?.["cdf"]) - numericCdf)).toBeLessThan(1e-4);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
