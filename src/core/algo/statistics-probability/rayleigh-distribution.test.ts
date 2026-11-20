/**
 * rayleigh-distribution.test.ts - Independent exponential reference,
 * normalization, monotone CDF, quantile inversion, moments, frame shape,
 * and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./rayleigh-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBe(steps + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(steps + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("RayleighDistribution", () => {
    it("matches an independent exponential evaluation of density and CDF", () => {
        for (const sigma of [0.5, 1, 2]) {
            const frames = [...mod.run({ sigma, maxX: 5 * sigma, steps: 10 })];
            checkFrames(frames, 10);
            const meta = frames[frames.length - 1]!.meta;
            const xs = meta["xs"] as number[];
            const pdf = meta["pdf"] as number[];
            const cdf = meta["cdf"] as number[];
            for (let i = 0; i < xs.length; i += 1) {
                const x = xs[i] ?? 0;
                const factor = Math.exp(-(x * x) / (2 * sigma * sigma));
                expect(pdf[i]).toBeCloseTo((x / (sigma * sigma)) * factor, 10);
                expect(cdf[i]).toBeCloseTo(1 - factor, 10);
            }
        }
    });

    it("normalizes, stays monotone, inverts its CDF, and reports moments", () => {
        const sigma = 1.5;
        const steps = 200;
        const maxX = 12;
        const frames = [...mod.run({ sigma, maxX, steps })];
        checkFrames(frames, steps);
        const meta = frames[frames.length - 1]!.meta;
        const pdf = meta["pdf"] as number[];
        const cdf = meta["cdf"] as number[];
        const quantiles = meta["quantiles"] as number[];
        const xs = meta["xs"] as number[];
        const h = maxX / steps;
        const area = pdf.reduce((s, v, k) => s + (k === 0 || k === pdf.length - 1 ? v / 2 : v), 0) * h;
        expect(area).toBeCloseTo(1, 2);
        expect(Number(meta["area"])).toBeCloseTo(area, 10);
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i]!).toBeGreaterThanOrEqual(cdf[i - 1]!);
        }
        for (let i = 0; i < quantiles.length; i += 1) {
            expect(quantiles[i]).toBeCloseTo(xs[i]!, 4);
        }
        expect(Number(meta["mean"])).toBeCloseTo(sigma * Math.sqrt(Math.PI / 2), 12);
        expect(Number(meta["variance"])).toBeCloseTo((2 - Math.PI / 2) * sigma * sigma, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(15);
        expect(generator.next().done).toBe(true);
    });
});
