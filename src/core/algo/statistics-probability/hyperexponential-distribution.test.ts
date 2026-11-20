/**
 * hyperexponential-distribution.test.ts - Mixture cross-check, integration, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hyperexponential-distribution";
import type { VisualFrame } from "@/types";

/** Reference mixture cumulative written component by component. */
function referenceCdf(x: number, weights: number[], rates: number[]): number {
    if (x <= 0) return 0;
    let total = 0;
    for (let i = 0; i < rates.length; i += 1) total += weights[i] as number * (1 - Math.exp(-rates[i] as number * x));
    return total;
}

/** Reference mixture density. */
function referencePdf(x: number, weights: number[], rates: number[]): number {
    if (x < 0) return 0;
    let total = 0;
    for (let i = 0; i < rates.length; i += 1) total += weights[i] as number * rates[i] as number * Math.exp(-rates[i] as number * x);
    return total;
}

/** Composite Simpson integral over [0, end]. */
function integrate(fn: (x: number) => number, end: number, panels: number): number {
    const h = end / panels;
    let sum = fn(0) + fn(end);
    for (let i = 1; i < panels; i += 1) sum += (i % 2 === 0 ? 2 : 4) * fn(i * h);
    return (sum * h) / 3;
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

describe("Hyperexponential Distribution", () => {
    it("matches an independent mixture and integrates density into cumulative", () => {
        const weights = [0.6, 0.25, 0.15];
        const rates = [5, 1, 0.25];
        const frames = [...mod.run({ weights, rates, points: 150 })];
        checkFrames(frames, 150);
        const final = frames[frames.length - 1];
        const xs = final?.meta["xs"] as number[];
        const cdf = final?.meta["cdf"] as number[];
        for (let i = 0; i <= 150; i += 3) {
            expect(cdf[i] as number).toBeCloseTo(referenceCdf(xs[i] as number, weights, rates), 8);
            expect(cdf[i] as number).toBeCloseTo(integrate((x) => referencePdf(x, weights, rates), xs[i] as number, 20000), 3);
        }
        expect(cdf[0]).toBe(0);
        expect(cdf[150] as number).toBeGreaterThan(0.9);
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i] as number).toBeGreaterThanOrEqual(cdf[i - 1] as number);
        }
    });

    it("reports exact mixture moments and consistent quantiles", () => {
        const weights = [0.7, 0.3];
        const rates = [4, 0.5];
        const frames = [...mod.run({ weights, rates, points: 60 })];
        const final = frames[frames.length - 1];
        const mean = 0.7 / 4 + 0.3 / 0.5;
        const second = 2 * 0.7 / 16 + 2 * 0.3 / 0.25;
        expect(final?.meta["mean"] as number).toBeCloseTo(mean, 10);
        expect(final?.meta["variance"] as number).toBeCloseTo(second - mean * mean, 10);
        const quantiles = final?.meta["quantiles"] as number[];
        const targets = [0.1, 0.5, 0.9];
        quantiles.forEach((q, i) => {
            expect(referenceCdf(q, weights, rates)).toBeCloseTo(targets[i] as number, 4);
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
